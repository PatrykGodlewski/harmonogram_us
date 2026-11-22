import { type SQL, sql } from "drizzle-orm";
import { db, type TransactionClient } from "../client";
import type { QuestionKind } from "../schema/event-questions";
import { surveyAnswers, surveyResponses } from "../schema/surveys";
import { DomainError } from "./domain-errors";
import { type EventQuestion, listEventQuestions } from "./event-questions";
import { effectiveEventEndSql } from "./event-registrations";
import { type Answers, normalizeAnswers } from "./registration-answers";

/** How long after the event its survey takes answers (and its e-mail may go). */
export const SURVEY_OPEN_DAYS = 30;

/** Text answers shown per question in the summary (the total is always given). */
const SUMMARY_TEXT_LIMIT = 100;

/** E-mails claimed per run; the next run (15 minutes later) takes the rest. */
const CLAIM_BATCH = 500;

/**
 * The survey of a published event takes answers from people who held a place,
 * from the event end for SURVEY_OPEN_DAYS days. `registration` and `event` are
 * SQL aliases; `at` is the moment checked.
 */
function surveyOpenSql(registration: SQL, event: SQL, at: SQL): SQL<boolean> {
	return sql<boolean>`(${registration}.state = 'registered'
		AND ${event}.status = 'published'
		AND ${effectiveEventEndSql(event)} <= ${at}
		AND ${effectiveEventEndSql(event)} > ${at} - make_interval(days => ${SURVEY_OPEN_DAYS})
		AND EXISTS (SELECT 1 FROM event_questions q WHERE q.event_id = ${event}.id AND q.form = 'survey'))`;
}

export type SurveyForm = {
	status: "open" | "answered" | "closed";
	eventTitle: string;
	locale: "pl" | "en";
	questions: EventQuestion[];
};

/**
 * The survey a registration may answer; null when the registration does not
 * exist, never held a place, or its event has no survey.
 */
export async function getSurveyForRegistration(
	registrationId: string,
): Promise<SurveyForm | null> {
	const [row] = await db.execute<{
		event_id: string;
		title: string;
		locale: "pl" | "en";
		answered: boolean;
		open: boolean;
	}>(sql`
		SELECT e.id AS event_id, e.title, r.locale,
			r.survey_answered_at IS NOT NULL AS answered,
			${surveyOpenSql(sql`r`, sql`e`, sql`now()`)} AS open
		FROM event_registrations r
		JOIN events e ON e.id = r.event_id
		WHERE r.id = ${registrationId} AND r.state = 'registered'`);
	if (!row) {
		return null;
	}
	const questions = await listEventQuestions(row.event_id, "survey");
	if (questions.length === 0) {
		return null;
	}
	return {
		status: row.answered ? "answered" : row.open ? "open" : "closed",
		eventTitle: row.title,
		locale: row.locale,
		questions,
	};
}

/**
 * Stores a registration's survey answers, once. The claim on
 * `survey_answered_at` and the answers share one transaction, so two
 * submissions from the same link store one response; the stored answers carry
 * no link back to the registration.
 */
export async function submitSurvey(
	registrationId: string,
	answers: Answers,
): Promise<void> {
	await db.transaction(async (tx) => {
		const [claimed] = await tx.execute<{ event_id: string }>(sql`
			UPDATE event_registrations r SET survey_answered_at = now()
			FROM events e
			WHERE r.id = ${registrationId} AND e.id = r.event_id
				AND r.survey_answered_at IS NULL
				AND ${surveyOpenSql(sql`r`, sql`e`, sql`now()`)}
			RETURNING r.event_id`);
		if (!claimed) {
			const [current] = await tx.execute<{ answered: boolean }>(sql`
				SELECT survey_answered_at IS NOT NULL AS answered
				FROM event_registrations WHERE id = ${registrationId}`);
			throw new DomainError(
				current?.answered ? "SURVEY_ANSWERED" : "SURVEY_CLOSED",
			);
		}
		const questions = await listEventQuestions(claimed.event_id, "survey");
		const kept = normalizeAnswers(questions, answers, { requireAll: true });
		const [response] = await tx
			.insert(surveyResponses)
			.values({ eventId: claimed.event_id })
			.returning({ id: surveyResponses.id });
		if (response && kept.length > 0) {
			await tx
				.insert(surveyAnswers)
				.values(kept.map((answer) => ({ responseId: response.id, ...answer })));
		}
	});
}

/**
 * Claims everyone whose survey is open by `now` and who has not been e-mailed
 * the link (one statement, `SKIP LOCKED`, so two workers never claim the same
 * person) and hands them to `onRecipients`, in the same transaction.
 */
export async function queueSurveyInvitations(
	now: Date,
	onRecipients: (
		tx: TransactionClient,
		registrationIds: string[],
	) => Promise<void>,
): Promise<{ registrations: number }> {
	const at = sql`${now.toISOString()}::timestamptz`;
	return db.transaction(async (tx) => {
		const claimed = await tx.execute<{ id: string }>(sql`
			UPDATE event_registrations SET survey_emailed_at = ${at}
			WHERE id IN (
				SELECT r.id FROM event_registrations r
				JOIN events e ON e.id = r.event_id
				WHERE r.survey_emailed_at IS NULL AND r.survey_answered_at IS NULL
					AND ${surveyOpenSql(sql`r`, sql`e`, at)}
				ORDER BY r.created_at
				LIMIT ${CLAIM_BATCH}
				FOR UPDATE OF r SKIP LOCKED
			)
			RETURNING id`);
		if (claimed.length > 0) {
			await onRecipients(
				tx,
				claimed.map((row) => row.id),
			);
		}
		return { registrations: claimed.length };
	});
}

type SummaryBase = { id: string; label: string };

export type SurveyQuestionSummary = SummaryBase &
	(
		| { kind: "rating"; average: number | null; counts: number[] }
		| {
				kind: "choice" | "yesno";
				options: { value: string; count: number }[];
		  }
		| { kind: "text"; total: number; answers: string[] }
	);

export type SurveySummary = {
	responses: number;
	/** People who held a place (everyone the survey is meant for). */
	invited: number;
	questions: SurveyQuestionSummary[];
};

/** Counts per question and answer, plus the latest text answers (capped). */
export async function getSurveySummary(
	eventId: string,
): Promise<SurveySummary> {
	const [questions, totals, counts, texts] = await Promise.all([
		listEventQuestions(eventId, "survey"),
		db.execute<{ responses: number; invited: number }>(sql`
			SELECT
				(SELECT count(*)::int FROM survey_responses WHERE event_id = ${eventId}) AS responses,
				(SELECT count(*)::int FROM event_registrations
					WHERE event_id = ${eventId} AND state = 'registered') AS invited`),
		db.execute<{ question_id: string; value: string; count: number }>(sql`
			SELECT a.question_id, a.value, count(*)::int AS count
			FROM survey_answers a
			JOIN event_questions q ON q.id = a.question_id
			WHERE q.event_id = ${eventId} AND q.form = 'survey' AND q.kind <> 'text'
			GROUP BY a.question_id, a.value`),
		db.execute<{ question_id: string; value: string; total: number }>(sql`
			SELECT question_id, value, total FROM (
				SELECT a.question_id, a.value,
					count(*) OVER (PARTITION BY a.question_id)::int AS total,
					row_number() OVER (PARTITION BY a.question_id ORDER BY r.created_at DESC) AS n
				FROM survey_answers a
				JOIN survey_responses r ON r.id = a.response_id
				JOIN event_questions q ON q.id = a.question_id
				WHERE q.event_id = ${eventId} AND q.form = 'survey' AND q.kind = 'text'
			) ranked
			WHERE n <= ${SUMMARY_TEXT_LIMIT}
			ORDER BY question_id, n`),
	]);

	const countOf = (questionId: string, value: string) =>
		counts.find((row) => row.question_id === questionId && row.value === value)
			?.count ?? 0;

	return {
		responses: totals[0]?.responses ?? 0,
		invited: totals[0]?.invited ?? 0,
		questions: questions.map((question): SurveyQuestionSummary => {
			const base = { id: question.id, label: question.label };
			const kind: QuestionKind = question.kind;
			if (kind === "rating") {
				const ratingCounts = [1, 2, 3, 4, 5].map((n) =>
					countOf(question.id, String(n)),
				);
				const given = ratingCounts.reduce((sum, n) => sum + n, 0);
				const sum = ratingCounts.reduce((acc, n, i) => acc + n * (i + 1), 0);
				return {
					...base,
					kind,
					average: given === 0 ? null : Math.round((sum / given) * 10) / 10,
					counts: ratingCounts,
				};
			}
			if (kind === "text") {
				const rows = texts.filter((row) => row.question_id === question.id);
				return {
					...base,
					kind,
					total: rows[0]?.total ?? 0,
					answers: rows.map((row) => row.value),
				};
			}
			const values = kind === "yesno" ? ["yes", "no"] : question.options;
			return {
				...base,
				kind,
				options: values.map((value) => ({
					value,
					count: countOf(question.id, value),
				})),
			};
		}),
	};
}
