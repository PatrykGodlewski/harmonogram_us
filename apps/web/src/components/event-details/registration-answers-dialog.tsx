import type { EventDetails } from "@repo/api/events/queries";
import {
	answers_cancel,
	answers_choose,
	answers_no,
	answers_optional,
	answers_required,
	answers_title,
	answers_yes,
} from "@repo/i18n/paraglide/messages";
import { Button } from "@repo/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/dialog";
import { FormMessage } from "@repo/ui/components/form-message";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { type FormEvent, useEffect, useId, useState } from "react";

type Question = EventDetails["questions"][number];
export type Answers = Record<string, string>;

type RegistrationAnswersDialogProps = {
	questions: Question[];
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Starting answers (editing); empty for a new registration. */
	initial?: Answers;
	submitLabel: string;
	onSubmit: (answers: Answers) => void;
};

/** The event's questions; required ones are checked here and again on the server. */
export function RegistrationAnswersDialog({
	questions,
	open,
	onOpenChange,
	initial,
	submitLabel,
	onSubmit,
}: RegistrationAnswersDialogProps) {
	const formId = useId();
	const [answers, setAnswers] = useState<Answers>({});
	const [missing, setMissing] = useState<ReadonlySet<string>>(new Set());

	useEffect(() => {
		if (open) {
			setAnswers(initial ?? {});
			setMissing(new Set());
		}
	}, [open, initial]);

	const setAnswer = (id: string, value: string) =>
		setAnswers((current) => ({ ...current, [id]: value }));

	const handleSubmit = (event: FormEvent) => {
		event.preventDefault();
		const unanswered = new Set(
			questions
				.filter(
					(question) => question.required && !answers[question.id]?.trim(),
				)
				.map((question) => question.id),
		);
		setMissing(unanswered);
		if (unanswered.size === 0) {
			onSubmit(answers);
			onOpenChange(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{answers_title()}</DialogTitle>
				</DialogHeader>
				<form
					id={formId}
					onSubmit={handleSubmit}
					noValidate
					className="flex flex-col gap-4"
				>
					{questions.map((question) => (
						<AnswerField
							key={question.id}
							question={question}
							value={answers[question.id] ?? ""}
							isMissing={missing.has(question.id)}
							onChange={(value) => setAnswer(question.id, value)}
						/>
					))}
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
						>
							{answers_cancel()}
						</Button>
						<Button type="submit">{submitLabel}</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function AnswerField({
	question,
	value,
	isMissing,
	onChange,
}: {
	question: Question;
	value: string;
	isMissing: boolean;
	onChange: (value: string) => void;
}) {
	const fieldId = useId();
	const errorId = useId();
	const label = (
		<Label htmlFor={fieldId}>
			{question.label}
			{question.required ? (
				<span aria-hidden="true"> *</span>
			) : (
				<span className="font-normal text-muted-foreground">
					{" "}
					{answers_optional()}
				</span>
			)}
		</Label>
	);
	const describedBy = isMissing ? errorId : undefined;
	const choices =
		question.kind === "yesno"
			? [
					{ value: "yes", label: answers_yes() },
					{ value: "no", label: answers_no() },
				]
			: question.options.map((option) => ({ value: option, label: option }));

	return (
		<div className="flex flex-col gap-2">
			{label}
			{question.kind === "text" ? (
				<Input
					id={fieldId}
					maxLength={2000}
					required={question.required}
					aria-invalid={isMissing}
					aria-describedby={describedBy}
					value={value}
					onChange={(event) => onChange(event.target.value)}
				/>
			) : (
				<Select value={value} onValueChange={onChange}>
					<SelectTrigger
						id={fieldId}
						className="w-full"
						aria-invalid={isMissing}
						aria-describedby={describedBy}
						aria-required={question.required}
					>
						<SelectValue placeholder={answers_choose()} />
					</SelectTrigger>
					<SelectContent>
						{choices.map((choice) => (
							<SelectItem key={choice.value} value={choice.value}>
								{choice.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			)}
			{isMissing ? (
				<FormMessage id={errorId}>{answers_required()}</FormMessage>
			) : null}
		</div>
	);
}
