import type { EventQuestion } from "@repo/api/admin/questions";
import { updateRegistrantAnswersServer } from "@repo/api/admin/registrants";
import {
	admin_answers_edit,
	admin_error_generic,
	answers_save,
	answers_saved,
} from "@repo/i18n/paraglide/messages";
import { Button } from "@repo/ui/components/button";
import { RegistrationAnswersDialog } from "@repo/ui/composed/registration-answers-dialog";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { formatMutationError } from "~/lib/format-mutation-error";

type EditAnswersProps = {
	eventId: string;
	registrationId: string;
	questions: EventQuestion[];
	answers: Record<string, string>;
	onSaved: () => Promise<unknown>;
};

/** An organiser corrects someone's answers (required ones may stay empty). */
export function EditAnswers({
	eventId,
	registrationId,
	questions,
	answers,
	onSaved,
}: EditAnswersProps) {
	const [open, setOpen] = useState(false);
	const saveMutation = useMutation({
		mutationFn: (next: Record<string, string>) =>
			updateRegistrantAnswersServer({
				data: { eventId, registrationId, answers: next },
			}),
		onSuccess: async () => {
			toast.success(answers_saved());
			await onSaved();
		},
		onError: (error) =>
			toast.error(formatMutationError(error, admin_error_generic)),
	});

	return (
		<>
			<Button
				size="sm"
				variant="outline"
				disabled={saveMutation.isPending}
				onClick={() => setOpen(true)}
			>
				{admin_answers_edit()}
			</Button>
			<RegistrationAnswersDialog
				// The organiser may leave required answers empty, as when adding someone.
				questions={questions.map((question) => ({
					...question,
					required: false,
				}))}
				open={open}
				onOpenChange={setOpen}
				initial={answers}
				submitLabel={answers_save()}
				onSubmit={(next) => saveMutation.mutate(next)}
			/>
		</>
	);
}
