import type { GuestForm } from "@repo/api/events/guest-form";
import {
	guest_dialog_description,
	guest_dialog_title,
	guest_error_generic,
	guest_field_email,
	guest_field_name,
	guest_sent_body,
	guest_sent_title,
	guest_submit,
	privacy_link,
	privacy_notice_short,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import { appErrorMessage } from "@repo/ui/app-errors";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { useHumanCheck } from "@repo/ui/composed/auth/human-check";
import {
	AnswerField,
	type Answers,
} from "@repo/ui/composed/registration-answers-dialog";
import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type FormEvent, useId, useState } from "react";

type GuestRegistrationFormProps = {
	form: GuestForm;
	/** The secret of an invite link (invite-only events). */
	invite?: string;
};

/**
 * Registration without a password (F17): name, e-mail and the event's questions; the
 * link in the e-mail confirms it and signs the person in. Nothing is reserved until then.
 */
export function GuestRegistrationForm({
	form,
	invite,
}: GuestRegistrationFormProps) {
	const nameId = useId();
	const emailId = useId();
	const titleId = useId();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [answers, setAnswers] = useState<Answers>({});
	const [missing, setMissing] = useState<ReadonlySet<string>>(new Set());
	const humanCheck = useHumanCheck();

	const request = useMutation({
		mutationFn: () =>
			humanCheck(async (token) => {
				const response = await fetch("/api/auth/guest-registration/request", {
					method: "POST",
					headers: {
						"content-type": "application/json",
						...(token ? { "x-captcha-response": token } : {}),
					},
					body: JSON.stringify({
						eventId: form.eventId,
						email,
						name,
						locale: getLocale(),
						answers,
						inviteToken: invite,
					}),
				});
				if (!response.ok) {
					throw await response.json().catch(() => ({}));
				}
			}),
	});

	const handleSubmit = (event: FormEvent) => {
		event.preventDefault();
		const unanswered = new Set(
			form.questions
				.filter(
					(question) => question.required && !answers[question.id]?.trim(),
				)
				.map((question) => question.id),
		);
		setMissing(unanswered);
		if (unanswered.size === 0) request.mutate();
	};

	if (request.isSuccess) {
		return (
			<Alert role="status">
				<AlertTitle>{guest_sent_title()}</AlertTitle>
				<AlertDescription>{guest_sent_body({ email })}</AlertDescription>
			</Alert>
		);
	}

	return (
		<form
			aria-labelledby={titleId}
			onSubmit={handleSubmit}
			noValidate
			className="flex flex-col gap-4"
		>
			<div className="flex flex-col gap-1">
				<h2 id={titleId} className="font-semibold">
					{guest_dialog_title()}
				</h2>
				<p className="text-sm text-muted-foreground">
					{guest_dialog_description()}
				</p>
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor={nameId}>{guest_field_name()}</Label>
				<Input
					id={nameId}
					autoComplete="name"
					required
					maxLength={200}
					value={name}
					onChange={(event) => setName(event.target.value)}
				/>
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor={emailId}>{guest_field_email()}</Label>
				<Input
					id={emailId}
					type="email"
					autoComplete="email"
					required
					value={email}
					onChange={(event) => setEmail(event.target.value)}
				/>
			</div>
			{form.questions.map((question) => (
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
			<p className="text-sm text-muted-foreground">
				{privacy_notice_short()}{" "}
				<Link to="/privacy" className="underline underline-offset-2">
					{privacy_link()}
				</Link>
			</p>
			{request.isError ? (
				<Alert variant="destructive">
					<AlertDescription>
						{appErrorMessage(request.error, guest_error_generic)}
					</AlertDescription>
				</Alert>
			) : null}
			<Button
				type="submit"
				disabled={request.isPending || !name.trim() || !email.trim()}
			>
				{guest_submit()}
			</Button>
		</form>
	);
}
