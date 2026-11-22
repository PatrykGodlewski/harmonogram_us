import {
	myAnswersQueryOptions,
	updateMyAnswersServer,
} from "@repo/api/events/my-answers";
import {
	answers_edit,
	answers_save,
	answers_saved,
	error_title,
} from "@repo/i18n/paraglide/messages";
import { appErrorMessage } from "@repo/ui/app-errors";
import { Button } from "@repo/ui/components/button";
import {
	type AnswerQuestion,
	RegistrationAnswersDialog,
} from "@repo/ui/composed/registration-answers-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

/** Lets a registered person change their answers while the event is open. */
export function EditAnswersButton({
	eventId,
	questions,
	interactive,
}: {
	eventId: string;
	questions: AnswerQuestion[];
	/** false in the server-rendered copy, before the live page takes over. */
	interactive: boolean;
}) {
	const [open, setOpen] = useState(false);
	const queryClient = useQueryClient();
	const { data: mine } = useQuery({
		...myAnswersQueryOptions(eventId),
		enabled: open,
	});
	const saveMutation = useMutation({
		mutationFn: (answers: Record<string, string>) =>
			updateMyAnswersServer({ data: { eventId, answers } }),
		onSuccess: async () => {
			toast.success(answers_saved());
			await queryClient.invalidateQueries(myAnswersQueryOptions(eventId));
		},
		onError: (error) => toast.error(appErrorMessage(error, error_title)),
	});

	return (
		<>
			<Button
				size="sm"
				variant="outline"
				className="self-start"
				disabled={!interactive || saveMutation.isPending}
				onClick={() => setOpen(true)}
			>
				{answers_edit()}
			</Button>
			<RegistrationAnswersDialog
				questions={questions}
				open={open && mine !== undefined}
				onOpenChange={setOpen}
				initial={mine?.answers}
				submitLabel={answers_save()}
				onSubmit={(answers) => saveMutation.mutate(answers)}
			/>
		</>
	);
}
