import { type AppErrorCode, DomainError } from "@repo/db/queries/domain-errors";

/** HTTP status per error code; any code not listed is a conflict with the current state (409). */
const STATUS: Partial<Record<AppErrorCode, number>> = {
	UNAUTHORIZED: 401,
	WITHDRAW_LINK_INVALID: 400,
	GUEST_LINK_INVALID: 400,
	GUESTS_NOT_ALLOWED: 403,
	REAUTH_REQUIRED: 401,
	FORBIDDEN: 403,
	NOT_GROUP_OWNER: 403,
	EMAIL_NOT_VERIFIED: 403,
	NOT_FOUND: 404,
	EVENT_NOT_FOUND: 404,
	ITEM_NOT_FOUND: 404,
	GROUP_NOT_FOUND: 404,
	USER_NOT_FOUND: 404,
	TICKET_NOT_FOUND: 404,
	RATE_LIMITED: 429,
	CAPTCHA_REQUIRED: 400,
	CAPTCHA_FAILED: 400,
	EMAIL_NOT_ALLOWED: 400,
	END_BEFORE_START: 400,
	ITEM_LIMIT_ABOVE_EVENT: 400,
	MAX_SEATS_BELOW_REGISTERED: 400,
	EVENT_INCOMPLETE: 400,
	FILE_TYPE: 400,
	FILE_TOO_LARGE: 413,
};

/** A client-facing error: the code travels as the message, `status` becomes the HTTP status. */
export type AppError = Error & { status: number };

/** The only way the API raises a client-facing error. */
export function appError(code: AppErrorCode): AppError {
	return Object.assign(new Error(code), { status: STATUS[code] ?? 409 });
}

/** The HTTP status an error asks for, when it's a client-facing one. */
export function appErrorStatus(error: unknown): number | undefined {
	const status = (error as { status?: unknown } | null)?.status;
	return error instanceof Error && typeof status === "number"
		? status
		: undefined;
}

/** Runs `fn`, rethrowing domain errors as app errors so clients can map the code to a message. */
export async function withDomainErrors<T>(fn: () => Promise<T>): Promise<T> {
	try {
		return await fn();
	} catch (error) {
		if (error instanceof DomainError) {
			throw appError(error.code);
		}
		throw error;
	}
}
