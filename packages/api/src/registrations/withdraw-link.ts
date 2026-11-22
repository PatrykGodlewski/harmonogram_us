/** Server-only: signed links that let a person withdraw a registration from an e-mail (F17). */
import { env } from "@repo/env";
import { isSignedTokenValid, signedToken } from "../security/signed-token";

export function withdrawToken(registrationId: string): string {
	return signedToken("withdraw", registrationId);
}

export function isWithdrawTokenValid(
	registrationId: string,
	token: string,
): boolean {
	return isSignedTokenValid("withdraw", registrationId, token);
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
