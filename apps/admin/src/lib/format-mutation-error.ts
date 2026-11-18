import { appErrorMessage } from "@repo/ui/app-errors";

/** Message for a failed admin action: the code's message, else the server's message, else `fallback`. */
export function formatMutationError(
	error: unknown,
	fallbackMessage: () => string,
): string {
	return appErrorMessage(error, () => {
		if (!(error instanceof Error)) {
			return fallbackMessage();
		}
		const cause = error.cause;
		if (cause instanceof Error && cause.message.trim().length > 0) {
			return cause.message;
		}
		return error.message.trim().length > 0 ? error.message : fallbackMessage();
	});
}
