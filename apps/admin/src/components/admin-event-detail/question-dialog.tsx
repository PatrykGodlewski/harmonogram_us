import type { EventQuestion } from "@repo/api/admin/questions";
import {
	createEventQuestionServer,
	updateEventQuestionServer,
} from "@repo/api/admin/questions";
import {
	admin_action_cancel,
	admin_action_save,
	admin_error_generic,
	questions_dialog_add,
	questions_dialog_edit,
	questions_kind,
	questions_label,
	questions_options,
	questions_options_hint,
	questions_required_field,
	questions_saved,
} from "@repo/i18n/paraglide/messages";
import { Button } from "@repo/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { Textarea } from "@repo/ui/components/textarea";
import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { formatMutationError } from "~/lib/format-mutation-error";
import { QUESTION_KIND_LABELS } from "./question-kinds";

type Kind = EventQuestion["kind"];

type QuestionDialogProps = {
	eventId: string;
	/** null: a new question. */
	question: EventQuestion | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSaved: () => Promise<unknown>;
};

export function QuestionDialog({
	eventId,
	question,
	open,
	onOpenChange,
	onSaved,
}: QuestionDialogProps) {
	const labelId = useId();
	const kindId = useId();
	const optionsId = useId();
	const optionsHintId = useId();
	const requiredId = useId();
	const [label, setLabel] = useState("");
	const [kind, setKind] = useState<Kind>("text");
	const [options, setOptions] = useState("");
	const [required, setRequired] = useState(false);

	// Start from the question each time the dialog opens.
	useEffect(() => {
		if (open) {
			setLabel(question?.label ?? "");
			setKind(question?.kind ?? "text");
			setOptions(question?.options.join("\n") ?? "");
			setRequired(question?.required ?? false);
		}
	}, [open, question]);

	const saveMutation = useMutation({
		mutationFn: () => {
			const fields = {
				label: label.trim(),
				kind,
				options: kind === "choice" ? options.split("\n") : [],
				required,
			};
			return question
				? updateEventQuestionServer({ data: { id: question.id, ...fields } })
				: createEventQuestionServer({ data: { eventId, ...fields } });
		},
		onSuccess: async () => {
			toast.success(questions_saved());
			await onSaved();
			onOpenChange(false);
		},
		onError: (error) =>
			toast.error(formatMutationError(error, admin_error_generic)),
	});

	const handleSubmit = (event: FormEvent) => {
		event.preventDefault();
		if (label.trim()) {
			saveMutation.mutate();
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>
						{question ? questions_dialog_edit() : questions_dialog_add()}
					</DialogTitle>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="flex flex-col gap-4">
					<div className="flex flex-col gap-2">
						<Label htmlFor={labelId}>{questions_label()}</Label>
						<Input
							id={labelId}
							required
							maxLength={300}
							value={label}
							onChange={(event) => setLabel(event.target.value)}
						/>
					</div>
					<div className="flex flex-col gap-2">
						<Label htmlFor={kindId}>{questions_kind()}</Label>
						<Select
							value={kind}
							onValueChange={(value) => setKind(value as Kind)}
						>
							<SelectTrigger id={kindId} className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{(Object.keys(QUESTION_KIND_LABELS) as Kind[]).map((key) => (
									<SelectItem key={key} value={key}>
										{QUESTION_KIND_LABELS[key]()}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					{kind === "choice" ? (
						<div className="flex flex-col gap-2">
							<Label htmlFor={optionsId}>{questions_options()}</Label>
							<Textarea
								id={optionsId}
								rows={4}
								required
								aria-describedby={optionsHintId}
								value={options}
								onChange={(event) => setOptions(event.target.value)}
							/>
							<p id={optionsHintId} className="text-xs text-muted-foreground">
								{questions_options_hint()}
							</p>
						</div>
					) : null}
					<div className="flex items-center gap-2">
						<input
							id={requiredId}
							type="checkbox"
							className="size-4 accent-primary"
							checked={required}
							onChange={(event) => setRequired(event.target.checked)}
						/>
						<Label htmlFor={requiredId}>{questions_required_field()}</Label>
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							{admin_action_cancel()}
						</Button>
						<Button type="submit" disabled={saveMutation.isPending}>
							{admin_action_save()}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
