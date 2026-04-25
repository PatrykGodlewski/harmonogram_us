import { render } from "@react-email/render";
import { env } from "@repo/env";
import { baseLocale, type Locale } from "@repo/i18n/paraglide/runtime";
import nodemailer from "nodemailer";
import { MagicLinkEmail } from "./magic-link-email";

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
}) {
	const from = env.SMTP_FROM ?? "noreply@harmonogram.local";
	await transport.sendMail({
		from,
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
