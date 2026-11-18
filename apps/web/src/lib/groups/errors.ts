import {
	error_captcha,
	error_email_not_allowed,
	error_email_not_verified,
	error_group_closed,
	error_group_deadline_passed,
	error_group_full,
	error_group_not_found,
	error_group_places_unavailable,
	error_invitation_invalid,
	error_item_not_in_group,
	error_not_group_owner,
	error_rate_limited,
	events_event_ended,
	events_item_full,
} from "@repo/i18n/paraglide/messages";

const GROUP_ERROR_MESSAGES: Record<string, () => string> = {
	GROUP_PLACES_UNAVAILABLE: error_group_places_unavailable,
	GROUP_FULL: error_group_full,
	GROUP_CLOSED: error_group_closed,
	GROUP_DEADLINE_PASSED: error_group_deadline_passed,
	GROUP_NOT_FOUND: error_group_not_found,
	NOT_GROUP_OWNER: error_not_group_owner,
	INVITATION_INVALID: error_invitation_invalid,
	EMAIL_NOT_VERIFIED: error_email_not_verified,
	EMAIL_NOT_ALLOWED: error_email_not_allowed,
	ITEM_NOT_IN_GROUP: error_item_not_in_group,
	ITEM_FULL: events_item_full,
	EVENT_ENDED: events_event_ended,
	RATE_LIMITED: error_rate_limited,
	CAPTCHA_REQUIRED: error_captcha,
	CAPTCHA_FAILED: error_captcha,
};

/** Message for a domain error code (thrown as `Error(code)` or returned as `{ code }`). */
export function groupErrorMessage(
	error: unknown,
	fallback: () => string,
): string {
	const code =
		error instanceof Error
			? error.message
			: error && typeof error === "object" && "code" in error
				? String((error as { code: unknown }).code)
				: null;
	const message = code ? GROUP_ERROR_MESSAGES[code] : undefined;
	return message ? message() : fallback();
}
