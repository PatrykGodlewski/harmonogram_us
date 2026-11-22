import {
	type SurveyQuestionSummary,
	surveySummaryQueryOptions,
} from "@repo/api/admin/survey-summary";
import {
	answers_no,
	answers_yes,
	survey_results_average,
	survey_results_no_answers,
	survey_results_option,
	survey_results_responses,
	survey_results_text_shown,
	survey_results_title,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import { useQuery } from "@tanstack/react-query";
import { useId } from "react";

/** Anonymous survey results (F20): shown once the event has survey questions. */
export function SurveySummaryCard({ eventId }: { eventId: string }) {
	const headingId = useId();
	const { data: summary } = useQuery(surveySummaryQueryOptions(eventId));
	if (!summary || summary.questions.length === 0) {
		return null;
	}

	return (
		<section aria-labelledby={headingId} className="flex flex-col gap-3">
			<h2 id={headingId} className="text-lg font-semibold">
				{survey_results_title()}
			</h2>
			<p className="text-sm text-muted-foreground">
				{survey_results_responses({
					responses: summary.responses,
					invited: summary.invited,
				})}
			</p>
			<ul className="flex flex-col gap-3">
				{summary.questions.map((question) => (
					<li key={question.id} className="rounded-lg border p-3">
						<h3 className="font-medium break-words">{question.label}</h3>
						<QuestionResult question={question} />
					</li>
				))}
			</ul>
		</section>
	);
}

function QuestionResult({ question }: { question: SurveyQuestionSummary }) {
	const locale = getLocale();
	if (question.kind === "text") {
		if (question.total === 0) {
			return <NoAnswers />;
		}
		return (
			<div className="mt-2 flex flex-col gap-2 text-sm">
				<ul className="flex flex-col gap-1">
					{question.answers.map((answer, index) => (
						// Answers are anonymous and may repeat: the position is the identity.
						// biome-ignore lint/suspicious/noArrayIndexKey: see above
						<li key={index} className="break-words whitespace-pre-wrap">
							„{answer}”
						</li>
					))}
				</ul>
				{question.total > question.answers.length ? (
					<p className="text-muted-foreground">
						{survey_results_text_shown({
							shown: question.answers.length,
							total: question.total,
						})}
					</p>
				) : null}
			</div>
		);
	}

	const rows =
		question.kind === "rating"
			? question.counts.map((count, index) => ({
					label: String(index + 1),
					count,
				}))
			: question.options.map((option) => ({
					label:
						question.kind === "yesno"
							? option.value === "yes"
								? answers_yes()
								: answers_no()
							: option.value,
					count: option.count,
				}));
	const given = rows.reduce((sum, row) => sum + row.count, 0);
	if (given === 0) {
		return <NoAnswers />;
	}
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});

	return (
		<div className="mt-2 flex flex-col gap-2 text-sm">
			{question.kind === "rating" && question.average !== null ? (
				<p className="text-base font-semibold">
					{survey_results_average({
						average: new Intl.NumberFormat(locale, {
							minimumFractionDigits: 1,
							maximumFractionDigits: 1,
						}).format(question.average),
					})}
				</p>
			) : null}
			<ul className="flex flex-col gap-1">
				{rows.map((row) => (
					<li key={row.label} className="flex flex-col gap-1">
						<span>
							{survey_results_option({
								option: row.label,
								count: row.count,
								share: percent.format(row.count / given),
							})}
						</span>
						<span
							aria-hidden="true"
							className="h-1.5 rounded-full bg-primary"
							style={{ width: `${(row.count / given) * 100}%` }}
						/>
					</li>
				))}
			</ul>
		</div>
	);
}

function NoAnswers() {
	return (
		<p className="mt-2 text-sm text-muted-foreground">
			{survey_results_no_answers()}
		</p>
	);
}
