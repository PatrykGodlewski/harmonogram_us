/** Server-only: HMAC tokens that tie an e-mail link to one registration and one purpose. */
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@repo/env";

export type TokenPurpose = "withdraw" | "survey";

/** No column is needed and the link cannot be forged or reused for another purpose. */
export function signedToken(purpose: TokenPurpose, id: string): string {
	return createHmac("sha256", env.BETTER_AUTH_SECRET)
		.update(`${purpose}:${id}`)
		.digest("base64url");
}

export function isSignedTokenValid(
	purpose: TokenPurpose,
	id: string,
	token: string,
): boolean {
	const expected = Buffer.from(signedToken(purpose, id));
	const given = Buffer.from(token);
	return given.length === expected.length && timingSafeEqual(given, expected);
}
