export function formatMutationError(
	error: unknown,
	fallbackMessage: () => string,
): string {
	if (!(error instanceof Error)) {
		return fallbackMessage();
	}

	const cause = error.cause;
	if (cause instanceof Error && cause.message.trim().length > 0) {
		return cause.message;
	}

	if (error.message.trim().length > 0) {
		return error.message;
	}

	return fallbackMessage();
}
