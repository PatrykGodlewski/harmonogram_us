/** Server-only: the personal survey link sent after an event (F20). */
import { env } from "@repo/env";
import { isSignedTokenValid, signedToken } from "../security/signed-token";

export function surveyToken(registrationId: string): string {
	return signedToken("survey", registrationId);
}

export function isSurveyTokenValid(
	registrationId: string,
	token: string,
): boolean {
	return isSignedTokenValid("survey", registrationId, token);
}

export function surveyUrl(registrationId: string, locale: "pl" | "en"): string {
	const url = new URL(
		`/${locale}/surveys/${encodeURIComponent(registrationId)}`,
		env.BETTER_AUTH_URL,
	);
	url.searchParams.set("token", surveyToken(registrationId));
	return url.toString();
}
