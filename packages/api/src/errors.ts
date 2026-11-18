import { EventRegistrationError } from "@repo/db/queries/event-registrations";

/** Runs `fn`, rethrowing domain errors as `Error(code)` so clients can map the code to a message. */
export async function withDomainErrors<T>(fn: () => Promise<T>): Promise<T> {
	try {
		return await fn();
	} catch (error) {
		if (error instanceof EventRegistrationError) {
			throw new Error(error.code);
		}
		throw error;
	}
}
