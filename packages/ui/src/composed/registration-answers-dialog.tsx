import {
	answers_cancel,
	answers_choose,
	answers_no,
	answers_none,
	answers_optional,
	answers_rating_anchors,
	answers_required,
	answers_title,
	answers_yes,
} from "@repo/i18n/paraglide/messages";
import { type FormEvent, useEffect, useId, useState } from "react";
import { Button } from "../components/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "../components/dialog";
import { FormMessage } from "../components/form-message";
import { Input } from "../components/input";
import { Label } from "../components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../components/select";

/** A registration or survey question as the form needs it. */
export type AnswerQuestion = {
	id: string;
	label: string;
	kind: "text" | "choice" | "yesno" | "rating";
	options: string[];
	required: boolean;
};
type Question = AnswerQuestion;
const RATINGS = ["1", "2", "3", "4", "5"];
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

/** Ids of required questions without an answer (the server checks again). */
export function unansweredRequired(
	questions: AnswerQuestion[],
	answers: Answers,
): ReadonlySet<string> {
	return new Set(
		questions
			.filter((question) => question.required && !answers[question.id]?.trim())
			.map((question) => question.id),
	);
}

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
		const unanswered = unansweredRequired(questions, answers);
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

export function AnswerField({
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
	const hintId = useId();
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
	const hasHint = question.kind === "rating";
	const describedBy =
		[hasHint ? hintId : null, isMissing ? errorId : null]
			.filter(Boolean)
			.join(" ") || undefined;
	const choices =
		question.kind === "yesno"
			? [
					{ value: "yes", label: answers_yes() },
					{ value: "no", label: answers_no() },
				]
			: question.kind === "rating"
				? RATINGS.map((rating) => ({ value: rating, label: rating }))
				: question.options.map((option) => ({ value: option, label: option }));
	// Radix Select has no empty value: an optional question gets a "no answer" choice.
	const NO_ANSWER = "__none__";

	return (
		<div className="flex flex-col gap-2">
			{label}
			{hasHint ? (
				<p id={hintId} className="text-sm text-muted-foreground">
					{answers_rating_anchors()}
				</p>
			) : null}
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
				<Select
					value={value}
					onValueChange={(next) => onChange(next === NO_ANSWER ? "" : next)}
				>
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
						{question.required ? null : (
							<SelectItem value={NO_ANSWER}>{answers_none()}</SelectItem>
						)}
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
