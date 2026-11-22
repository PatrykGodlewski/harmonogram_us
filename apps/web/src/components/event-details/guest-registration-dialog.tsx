import { env } from "@repo/env/client";
import {
	guest_dialog_description,
	guest_dialog_title,
	guest_error_generic,
	guest_field_email,
	guest_field_name,
	guest_register_button,
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
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Captcha } from "@repo/ui/composed/auth/captcha";
import {
	AnswerField,
	type AnswerQuestion,
	type Answers,
} from "@repo/ui/composed/registration-answers-dialog";
import { useMutation } from "@tanstack/react-query";
import { Link, useSearch } from "@tanstack/react-router";
import { type FormEvent, useId, useState } from "react";

type GuestRegistrationDialogProps = {
	eventId: string;
	questions: AnswerQuestion[];
	/** False until the live page has taken over (an open dialog would be lost). */
	interactive: boolean;
};

/**
 * Registration for visitors without an account (F17): name, e-mail and the event's
 * questions; the link in the e-mail confirms it. Nothing is reserved until then.
 */
export function GuestRegistrationDialog({
	eventId,
	questions,
	interactive,
}: GuestRegistrationDialogProps) {
	const nameId = useId();
	const emailId = useId();
	const { invite } = useSearch({ strict: false }) as { invite?: string };
	const captchaSiteKey = env.VITE_TURNSTILE_SITE_KEY;
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [answers, setAnswers] = useState<Answers>({});
	const [missing, setMissing] = useState<ReadonlySet<string>>(new Set());
	const [captchaToken, setCaptchaToken] = useState<string | null>(null);

	const request = useMutation({
		mutationFn: async () => {
			const response = await fetch("/api/auth/guest-registration/request", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					...(captchaToken ? { "x-captcha-response": captchaToken } : {}),
				},
				body: JSON.stringify({
					eventId,
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
		},
	});

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
		if (unanswered.size === 0) request.mutate();
	};

	const captchaMissing = Boolean(captchaSiteKey) && !captchaToken;
	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button
					size="sm"
					variant="outline"
					className="w-full sm:w-auto"
					disabled={!interactive}
				>
					{guest_register_button()}
				</Button>
			</DialogTrigger>
			<DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{guest_dialog_title()}</DialogTitle>
					<DialogDescription>{guest_dialog_description()}</DialogDescription>
				</DialogHeader>
				{request.isSuccess ? (
					<Alert role="status">
						<AlertTitle>{guest_sent_title()}</AlertTitle>
						<AlertDescription>{guest_sent_body({ email })}</AlertDescription>
					</Alert>
				) : (
					<form
						onSubmit={handleSubmit}
						noValidate
						className="flex flex-col gap-4"
					>
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
						{questions.map((question) => (
							<AnswerField
								key={question.id}
								question={question}
								value={answers[question.id] ?? ""}
								isMissing={missing.has(question.id)}
								onChange={(value) =>
									setAnswers((current) => ({
										...current,
										[question.id]: value,
									}))
								}
							/>
						))}
						<p className="text-sm text-muted-foreground">
							{privacy_notice_short()}{" "}
							<Link to="/privacy" className="underline underline-offset-2">
								{privacy_link()}
							</Link>
						</p>
						{captchaSiteKey ? (
							<Captcha siteKey={captchaSiteKey} onToken={setCaptchaToken} />
						) : null}
						{request.isError ? (
							<Alert variant="destructive">
								<AlertDescription>
									{appErrorMessage(request.error, guest_error_generic)}
								</AlertDescription>
							</Alert>
						) : null}
						<Button
							type="submit"
							disabled={
								request.isPending ||
								captchaMissing ||
								!name.trim() ||
								!email.trim()
							}
						>
							{guest_submit()}
						</Button>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
