import { type AppErrorCode, DomainError } from "@repo/db/queries/domain-errors";

/** The only way the API raises a client-facing error: the code travels as the message. */
export function appError(code: AppErrorCode): Error {
	return new Error(code);
}

/** Runs `fn`, rethrowing domain errors as `Error(code)` so clients can map the code to a message. */
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
