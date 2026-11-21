/** Server-only: signed links that let a person withdraw a registration from an e-mail (F17). */
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@repo/env";

/** HMAC of the registration id; no column is needed and the link cannot be forged. */
export function withdrawToken(registrationId: string): string {
	return createHmac("sha256", env.BETTER_AUTH_SECRET)
		.update(`withdraw:${registrationId}`)
		.digest("base64url");
}

export function isWithdrawTokenValid(
	registrationId: string,
	token: string,
): boolean {
	const expected = Buffer.from(withdrawToken(registrationId));
	const given = Buffer.from(token);
	return given.length === expected.length && timingSafeEqual(given, expected);
}

/** The withdraw page for an e-mail (it asks before withdrawing: mail scanners open links). */
export function withdrawUrl(
	registrationId: string,
	locale: "pl" | "en",
): string {
	const url = new URL(
		`/${locale}/registrations/${encodeURIComponent(registrationId)}/withdraw`,
		env.BETTER_AUTH_URL,
	);
	url.searchParams.set("token", withdrawToken(registrationId));
	return url.toString();
}
