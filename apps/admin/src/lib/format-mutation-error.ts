import {
	admin_error_forbidden,
	admin_error_item_limit_above_event,
	admin_error_max_seats_below_registered,
} from "@repo/i18n/paraglide/messages";

/** Domain error codes thrown by admin server functions, mapped to messages. */
const ERROR_CODE_MESSAGES: Record<string, () => string> = {
	MAX_SEATS_BELOW_REGISTERED: admin_error_max_seats_below_registered,
	ITEM_LIMIT_ABOVE_EVENT: admin_error_item_limit_above_event,
	FORBIDDEN: admin_error_forbidden,
};

export function formatMutationError(
	error: unknown,
	fallbackMessage: () => string,
): string {
	if (!(error instanceof Error)) {
		return fallbackMessage();
	}

	const codeMessage = ERROR_CODE_MESSAGES[error.message];
	if (codeMessage) {
		return codeMessage();
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
