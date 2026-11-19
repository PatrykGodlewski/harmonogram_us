import { expect } from "@playwright/test";

export type MailMessage = { subject: string; text: string; links: string[] };

const mailpit = () => process.env.E2E_MAILPIT_URL ?? "http://localhost:18025";

type SearchResult = { messages: { ID: string; Subject: string }[] };
type MessageDetail = { Subject: string; Text: string; HTML: string };

/** The newest message to `email`, waiting up to 15 s for it to arrive. */
export async function latestMessageTo(email: string): Promise<MailMessage> {
	let id = "";
	await expect
		.poll(
			async () => {
				const res = await fetch(
					`${mailpit()}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}&limit=1`,
				);
				const body = (await res.json()) as SearchResult;
				id = body.messages[0]?.ID ?? "";
				return id;
			},
			{ timeout: 15_000, message: `no e-mail to ${email}` },
		)
		.not.toBe("");
	const res = await fetch(`${mailpit()}/api/v1/message/${id}`);
	const message = (await res.json()) as MessageDetail;
	const links = [...message.HTML.matchAll(/href="([^"]+)"/g)].map((m) =>
		(m[1] ?? "").replaceAll("&amp;", "&"),
	);
	return { subject: message.Subject, text: message.Text, links };
}

/** Number of messages to `email` right now (no waiting). */
export async function messageCountTo(email: string): Promise<number> {
	const res = await fetch(
		`${mailpit()}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`,
	);
	const body = (await res.json()) as SearchResult;
	return body.messages.length;
}
