import type { EventQuestion, QuestionForm } from "@repo/api/admin/questions";
import {
	deleteEventQuestionServer,
	eventQuestionsQueryOptions,
	moveEventQuestionServer,
} from "@repo/api/admin/questions";
import { surveySummaryQueryOptions } from "@repo/api/admin/survey-summary";
import {
	admin_action_cancel,
	admin_error_generic,
	questions_add,
	questions_delete,
	questions_delete_body,
	questions_delete_title,
	questions_down,
	questions_edit,
	questions_empty,
	questions_required,
	questions_title,
	questions_up,
	survey_questions_add,
	survey_questions_empty,
	survey_questions_title,
} from "@repo/i18n/paraglide/messages";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@repo/ui/components/alert-dialog";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { formatMutationError } from "~/lib/format-mutation-error";
import { QuestionDialog } from "./question-dialog";
import { QUESTION_KIND_LABELS } from "./question-kinds";

const TEXTS = {
	registration: {
		title: questions_title,
		empty: questions_empty,
		add: questions_add,
	},
	survey: {
		title: survey_questions_title,
		empty: survey_questions_empty,
		add: survey_questions_add,
	},
} as const;

/**
 * What people answer when they register (none keeps registering to one tap),
 * or in the survey after the event.
 */
export function QuestionsCard({
	eventId,
	form,
}: {
	eventId: string;
	form: QuestionForm;
}) {
	const headingId = useId();
	const queryClient = useQueryClient();
	const texts = TEXTS[form];
	const { data: questions = [] } = useQuery(
		eventQuestionsQueryOptions(eventId, form),
	);
	const [editing, setEditing] = useState<EventQuestion | "new" | null>(null);
	const refresh = () =>
		Promise.all([
			queryClient.invalidateQueries(eventQuestionsQueryOptions(eventId, form)),
			// The survey summary lists the questions too.
			form === "survey"
				? queryClient.invalidateQueries(surveySummaryQueryOptions(eventId))
				: null,
		]);
	const handleError = (error: unknown) =>
		toast.error(formatMutationError(error, admin_error_generic));

	const moveMutation = useMutation({
		mutationFn: (input: { id: string; direction: "up" | "down" }) =>
			moveEventQuestionServer({ data: input }),
		onSuccess: refresh,
		onError: handleError,
	});
	const deleteMutation = useMutation({
		mutationFn: (id: string) => deleteEventQuestionServer({ data: { id } }),
		onSuccess: refresh,
		onError: handleError,
	});
	const busy = moveMutation.isPending || deleteMutation.isPending;

	return (
		<section aria-labelledby={headingId} className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h2 id={headingId} className="text-lg font-semibold">
					{texts.title()}
				</h2>
				<Button variant="outline" onClick={() => setEditing("new")}>
					{texts.add()}
				</Button>
			</div>
			{questions.length === 0 ? (
				<p className="text-sm text-muted-foreground">{texts.empty()}</p>
			) : (
				<ol className="divide-y rounded-lg border">
					{questions.map((question, index) => (
						<li
							key={question.id}
							className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
						>
							<div className="flex min-w-0 flex-col gap-1">
								<p className="font-medium break-words">{question.label}</p>
								<div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
									<span>{QUESTION_KIND_LABELS[question.kind]()}</span>
									{question.options.length > 0 ? (
										<span>{question.options.join(", ")}</span>
									) : null}
									{question.required ? (
										<Badge variant="secondary">{questions_required()}</Badge>
									) : null}
								</div>
							</div>
							<div className="flex flex-wrap gap-2">
								<Button
									size="sm"
									variant="ghost"
									disabled={busy || index === 0}
									onClick={() =>
										moveMutation.mutate({ id: question.id, direction: "up" })
									}
								>
									{questions_up()}
								</Button>
								<Button
									size="sm"
									variant="ghost"
									disabled={busy || index === questions.length - 1}
									onClick={() =>
										moveMutation.mutate({ id: question.id, direction: "down" })
									}
								>
									{questions_down()}
								</Button>
								<Button
									size="sm"
									variant="outline"
									onClick={() => setEditing(question)}
								>
									{questions_edit()}
								</Button>
								<AlertDialog>
									<AlertDialogTrigger asChild>
										<Button size="sm" variant="outline" disabled={busy}>
											{questions_delete()}
										</Button>
									</AlertDialogTrigger>
									<AlertDialogContent>
										<AlertDialogHeader>
											<AlertDialogTitle>
												{questions_delete_title({ label: question.label })}
											</AlertDialogTitle>
											<AlertDialogDescription>
												{questions_delete_body()}
											</AlertDialogDescription>
										</AlertDialogHeader>
										<AlertDialogFooter>
											<AlertDialogCancel>
												{admin_action_cancel()}
											</AlertDialogCancel>
											<AlertDialogAction
												onClick={() => deleteMutation.mutate(question.id)}
											>
												{questions_delete()}
											</AlertDialogAction>
										</AlertDialogFooter>
									</AlertDialogContent>
								</AlertDialog>
							</div>
						</li>
					))}
				</ol>
			)}
			<QuestionDialog
				eventId={eventId}
				form={form}
				question={editing === "new" ? null : editing}
				open={editing !== null}
				onOpenChange={(open) => {
					if (!open) setEditing(null);
				}}
				onSaved={refresh}
			/>
		</section>
	);
}
