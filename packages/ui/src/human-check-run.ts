import { error_captcha_unavailable } from "@repo/i18n/paraglide/messages";

/** Error codes meaning "the server did not accept the proof": try once more. */
const REJECTED = new Set([
	"MISSING_RESPONSE",
	"VERIFICATION_FAILED",
	"CAPTCHA_REQUIRED",
	"CAPTCHA_FAILED",
]);

function codeOf(error: unknown): string | undefined {
	if (!error || typeof error !== "object") return undefined;
	const { code, message } = error as { code?: unknown; message?: unknown };
	return typeof code === "string"
		? code
		: typeof message === "string"
			? message
			: undefined;
}

export function isHumanCheckRejection(error: unknown): boolean {
	return REJECTED.has(codeOf(error) ?? "");
}

/** A readable message for the person, with the code beside it for the error mapping. */
export function humanCheckError(
	code: "CAPTCHA_UNAVAILABLE" | "CAPTCHA_CANCELLED",
	message: string,
): Error {
	return Object.assign(new Error(message), { code });
}

/** A token, or an error saying the check could not run (a cancelled check passes as it is). */
async function tokenOrFail(
	getToken: () => Promise<string | undefined>,
): Promise<string | undefined> {
	try {
		return await getToken();
	} catch (error) {
		if (codeOf(error) === "CAPTCHA_CANCELLED") throw error;
		throw humanCheckError("CAPTCHA_UNAVAILABLE", error_captcha_unavailable());
	}
}

/**
 * Runs `action` with a fresh human-check token. When the server rejects the proof, the
 * action runs once more with a new token; a token that cannot be had stops before it.
 */
export async function runWithHumanCheck<T>(
	getToken: () => Promise<string | undefined>,
	action: (token: string | undefined) => Promise<T>,
): Promise<T> {
	const token = await tokenOrFail(getToken);
	try {
		return await action(token);
	} catch (error) {
		if (!isHumanCheckRejection(error)) throw error;
	}
	return action(await tokenOrFail(getToken));
}
