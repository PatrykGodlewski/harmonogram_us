/** @jsxRuntime automatic */
/** @jsxImportSource react */
// Explicit so the templates compile the same under every runner (tsx in the worker applies its tsconfig only to its own files).

import { render } from "@react-email/render";
import { env } from "@repo/env";
import { baseLocale, type Locale } from "@repo/i18n/paraglide/runtime";
import nodemailer from "nodemailer";
import {
	EventMessageEmail,
	type EventMessageEmailProps,
} from "./event-message-email";
import {
	GroupInvitationEmail,
	type GroupInvitationEmailProps,
} from "./group-invitation-email";
import { MagicLinkEmail } from "./magic-link-email";
import {
	RegistrationEmail,
	type RegistrationEmailProps,
} from "./registration-email";

const transport = env.SMTP_HOST
	? nodemailer.createTransport({
			host: env.SMTP_HOST,
			port: env.SMTP_PORT ?? 587,
			secure: (env.SMTP_PORT ?? 587) === 465,
			auth:
				env.SMTP_USER && env.SMTP_PASSWORD
					? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
					: undefined,
		})
	: nodemailer.createTransport({ jsonTransport: true });

export async function sendTransactionalEmail(params: {
	to: string;
	subject: string;
	text: string;
	html?: string;
	/** Where replies go (an organizer's address); the sender stays SMTP_FROM. */
	replyTo?: string;
}) {
	const from = env.SMTP_FROM;
	await transport.sendMail({
		from,
		replyTo: params.replyTo,
		to: params.to,
		subject: params.subject,
		text: params.text,
		html: params.html,
	});
}

export async function renderMagicLinkEmail(params: {
	url: string;
	locale?: Locale;
}) {
	const locale = params.locale ?? baseLocale;
	return render(<MagicLinkEmail url={params.url} locale={locale} />);
}

export async function renderGroupInvitationEmail(
	props: GroupInvitationEmailProps,
) {
	return render(<GroupInvitationEmail {...props} />);
}

export async function renderRegistrationEmail(props: RegistrationEmailProps) {
	return render(<RegistrationEmail {...props} />);
}

export async function renderEventMessageEmail(props: EventMessageEmailProps) {
	return render(<EventMessageEmail {...props} />);
}
