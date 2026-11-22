import { submitSurveyServer, surveyQueryOptions } from "@repo/api/surveys/page";
import {
	error_survey_answered,
	error_survey_closed,
	error_survey_link_invalid,
	survey_error_generic,
	survey_intro,
	survey_submit,
	survey_thanks,
	survey_title,
	title_survey,
} from "@repo/i18n/paraglide/messages";
import { studentsPageHead } from "@repo/router-utils/metadata/page-head";
import { appErrorMessage } from "@repo/ui/app-errors";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import {
	AnswerField,
	type Answers,
	unansweredRequired,
} from "@repo/ui/composed/registration-answers-dialog";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { z } from "zod";

export const Route = createFileRoute("/surveys/$registrationId")({
	validateSearch: z.object({ token: z.string().max(200).catch("") }),
	loaderDeps: ({ search }) => ({ token: search.token }),
	loader: ({ context: { queryClient }, params, deps }) =>
		queryClient.ensureQueryData(
			surveyQueryOptions(params.registrationId, deps.token),
		),
	head: () => studentsPageHead(title_survey()),
	component: SurveyPage,
});

/** The survey after an event, opened from the personal e-mail link (F20). */
function SurveyPage() {
	const { registrationId } = Route.useParams();
	const { token } = Route.useSearch();
	const { data: survey } = useSuspenseQuery(
		surveyQueryOptions(registrationId, token),
	);

	if (survey.status === "invalid") {
		return (
			<SurveyLayout title={title_survey()}>
				<Alert variant="destructive">
					<AlertDescription>{error_survey_link_invalid()}</AlertDescription>
				</Alert>
			</SurveyLayout>
		);
	}
	const title = survey_title({ event: survey.eventTitle });
	if (survey.status !== "open") {
		return (
			<SurveyLayout title={title}>
				<p className="text-muted-foreground">
					{survey.status === "answered"
						? error_survey_answered()
						: error_survey_closed()}
				</p>
			</SurveyLayout>
		);
	}
	return (
		<SurveyLayout title={title}>
			<SurveyForm
				registrationId={registrationId}
				token={token}
				questions={survey.questions}
			/>
		</SurveyLayout>
	);
}

function SurveyLayout({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<main className="mx-auto flex w-full max-w-md flex-col gap-4 p-4 sm:p-8">
			<h1 className="text-2xl font-semibold break-words">{title}</h1>
			{children}
		</main>
	);
}

function SurveyForm({
	registrationId,
	token,
	questions,
}: {
	registrationId: string;
	token: string;
	questions: Parameters<typeof unansweredRequired>[0];
}) {
	const [answers, setAnswers] = useState<Answers>({});
	const [missing, setMissing] = useState<ReadonlySet<string>>(new Set());
	const submit = useMutation({
		mutationFn: () =>
			submitSurveyServer({ data: { registrationId, token, answers } }),
	});

	const handleSubmit = (event: FormEvent) => {
		event.preventDefault();
		const unanswered = unansweredRequired(questions, answers);
		setMissing(unanswered);
		if (unanswered.size === 0) {
			submit.mutate();
		}
	};

	if (submit.isSuccess) {
		return (
			<Alert role="status">
				<AlertDescription>{survey_thanks()}</AlertDescription>
			</Alert>
		);
	}
	return (
		<form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
			<p className="text-muted-foreground">{survey_intro()}</p>
			{questions.map((question) => (
				<AnswerField
					key={question.id}
					question={question}
					value={answers[question.id] ?? ""}
					isMissing={missing.has(question.id)}
					onChange={(value) =>
						setAnswers((current) => ({ ...current, [question.id]: value }))
					}
				/>
			))}
			{submit.isError ? (
				<Alert variant="destructive">
					<AlertDescription>
						{appErrorMessage(submit.error, survey_error_generic)}
					</AlertDescription>
				</Alert>
			) : null}
			<Button type="submit" disabled={submit.isPending}>
				{survey_submit()}
			</Button>
		</form>
	);
}
