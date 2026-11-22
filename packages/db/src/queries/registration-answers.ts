import { and, asc, eq } from "drizzle-orm";
import type { TransactionClient } from "../client";
import {
	eventQuestions,
	type QuestionKind,
	registrationAnswers,
} from "../schema/event-questions";
import { DomainError } from "./domain-errors";

/** Answers by question id: text, the chosen option, or "yes" / "no". */
export type Answers = Record<string, string>;

const MAX_TEXT_ANSWER = 2000;
const RATINGS = ["1", "2", "3", "4", "5"];

export type QuestionRule = {
	id: string;
	kind: QuestionKind;
	options: string[];
	required: boolean;
};

/**
 * The answers worth keeping (trimmed, blanks dropped, unknown questions
 * ignored); ANSWERS_INVALID for a missing required answer (when `requireAll`),
 * a choice outside the options, a yes/no that is neither, a rating outside
 * 1–5, or too long a text.
 */
export function normalizeAnswers(
	questions: QuestionRule[],
	answers: Answers,
	{ requireAll }: { requireAll: boolean },
): { questionId: string; value: string }[] {
	const kept: { questionId: string; value: string }[] = [];
	for (const question of questions) {
		const value = (answers[question.id] ?? "").trim();
		if (!value) {
			if (question.required && requireAll) {
				throw new DomainError("ANSWERS_INVALID");
			}
			continue;
		}
		const valid =
			question.kind === "choice"
				? question.options.includes(value)
				: question.kind === "yesno"
					? value === "yes" || value === "no"
					: question.kind === "rating"
						? RATINGS.includes(value)
						: value.length <= MAX_TEXT_ANSWER;
		if (!valid) {
			throw new DomainError("ANSWERS_INVALID");
		}
		kept.push({ questionId: question.id, value });
	}
	return kept;
}

async function questionRules(
	tx: TransactionClient,
	eventId: string,
): Promise<QuestionRule[]> {
	return tx
		.select({
			id: eventQuestions.id,
			kind: eventQuestions.kind,
			options: eventQuestions.options,
			required: eventQuestions.required,
		})
		.from(eventQuestions)
		.where(
			and(
				eq(eventQuestions.eventId, eventId),
				eq(eventQuestions.form, "registration"),
			),
		)
		.orderBy(asc(eventQuestions.position));
}

/** Whether registering for the event needs answers (some question is required). */
export async function hasRequiredQuestions(
	tx: TransactionClient,
	eventId: string,
): Promise<boolean> {
	const [row] = await tx
		.select({ id: eventQuestions.id })
		.from(eventQuestions)
		.where(
			and(
				eq(eventQuestions.eventId, eventId),
				eq(eventQuestions.form, "registration"),
				eq(eventQuestions.required, true),
			),
		)
		.limit(1);
	return Boolean(row);
}

/** Replaces a registration's answers with validated ones (in the caller's transaction). */
export async function saveAnswers(
	tx: TransactionClient,
	registrationId: string,
	eventId: string,
	answers: Answers,
	options: { requireAll: boolean },
): Promise<void> {
	const kept = normalizeAnswers(
		await questionRules(tx, eventId),
		answers,
		options,
	);
	await tx
		.delete(registrationAnswers)
		.where(eq(registrationAnswers.registrationId, registrationId));
	if (kept.length > 0) {
		await tx
			.insert(registrationAnswers)
			.values(kept.map((answer) => ({ registrationId, ...answer })));
	}
}

/** ANSWERS_INVALID unless the answers satisfy the event's questions (all required ones given). */
export async function assertAnswersValid(
	tx: TransactionClient,
	eventId: string,
	answers: Answers,
): Promise<void> {
	normalizeAnswers(await questionRules(tx, eventId), answers, {
		requireAll: true,
	});
}
