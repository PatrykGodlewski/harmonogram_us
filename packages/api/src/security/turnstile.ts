import { env } from "@repo/env";
import { appError } from "../errors";

/** Verifies a Cloudflare Turnstile token. Skipped when no secret is configured. */
export async function assertTurnstile(
	token: string | undefined,
	ip: string | undefined,
) {
	if (!env.TURNSTILE_SECRET_KEY) {
		return;
	}
	if (!token) {
		throw appError("CAPTCHA_REQUIRED");
	}
	const body = new URLSearchParams({
		secret: env.TURNSTILE_SECRET_KEY,
		response: token,
	});
	if (ip) {
		body.set("remoteip", ip);
	}
	const response = await fetch(
		"https://challenges.cloudflare.com/turnstile/v0/siteverify",
		{ method: "POST", body },
	);
	const result = (await response.json().catch(() => null)) as {
		success?: boolean;
	} | null;
	if (!result?.success) {
		throw appError("CAPTCHA_FAILED");
	}
}
