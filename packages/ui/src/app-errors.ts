import {
	type AppErrorCode,
	isAppErrorCode,
} from "@repo/db/queries/domain-errors";
import {
	admin_error_end_before_start,
	admin_error_event_already_cancelled,
	admin_error_event_incomplete,
	admin_error_event_not_draft,
	admin_error_forbidden,
	admin_error_item_limit_above_event,
	admin_error_max_seats_below_registered,
	admin_error_not_found,
	error_already_organizer,
	error_captcha,
	error_email_not_allowed,
	error_email_not_verified,
	error_event_waitlisted,
	error_group_closed,
	error_group_deadline_passed,
	error_group_full,
	error_group_not_found,
	error_group_places_unavailable,
	error_invitation_invalid,
	error_item_not_in_group,
	error_last_organizer,
	error_not_group_owner,
	error_rate_limited,
	error_user_not_found,
	event_cancelled_closed,
	event_details_not_found,
	events_event_ended,
	events_item_ended,
	events_item_full,
	events_item_not_found,
	events_item_not_registrable,
	events_register_already,
	events_register_full,
	events_register_login_required,
	events_unregister_not_registered,
} from "@repo/i18n/paraglide/messages";

/** One message per error code the API can send; the type makes the map complete. */
const APP_ERROR_MESSAGES: Record<AppErrorCode, () => string> = {
	EVENT_NOT_FOUND: event_details_not_found,
	EVENT_FULL: events_register_full,
	EVENT_ENDED: events_event_ended,
	EVENT_WAITLISTED: error_event_waitlisted,
	ALREADY_REGISTERED: events_register_already,
	NOT_REGISTERED: events_unregister_not_registered,
	ITEM_NOT_FOUND: events_item_not_found,
	ITEM_FULL: events_item_full,
	ITEM_NOT_REGISTRABLE: events_item_not_registrable,
	ITEM_ENDED: events_item_ended,
	ITEM_LIMIT_ABOVE_EVENT: admin_error_item_limit_above_event,
	END_BEFORE_START: admin_error_end_before_start,
	GROUP_PLACES_UNAVAILABLE: error_group_places_unavailable,
	GROUP_FULL: error_group_full,
	GROUP_CLOSED: error_group_closed,
	GROUP_DEADLINE_PASSED: error_group_deadline_passed,
	GROUP_NOT_FOUND: error_group_not_found,
	NOT_GROUP_OWNER: error_not_group_owner,
	INVITATION_INVALID: error_invitation_invalid,
	EMAIL_NOT_VERIFIED: error_email_not_verified,
	ITEM_NOT_IN_GROUP: error_item_not_in_group,
	MAX_SEATS_BELOW_REGISTERED: admin_error_max_seats_below_registered,
	USER_NOT_FOUND: error_user_not_found,
	ALREADY_ORGANIZER: error_already_organizer,
	LAST_ORGANIZER: error_last_organizer,
	EVENT_INCOMPLETE: admin_error_event_incomplete,
	EVENT_NOT_DRAFT: admin_error_event_not_draft,
	EVENT_CANCELLED: event_cancelled_closed,
	EVENT_ALREADY_CANCELLED: admin_error_event_already_cancelled,
	UNAUTHORIZED: events_register_login_required,
	FORBIDDEN: admin_error_forbidden,
	NOT_FOUND: admin_error_not_found,
	RATE_LIMITED: error_rate_limited,
	CAPTCHA_REQUIRED: error_captcha,
	CAPTCHA_FAILED: error_captcha,
	EMAIL_NOT_ALLOWED: error_email_not_allowed,
};

/** The error code carried by a server error (`Error(code)` or a `{ code }` body), if any. */
export function getAppErrorCode(error: unknown): AppErrorCode | null {
	const candidate =
		error instanceof Error
			? error.message
			: error && typeof error === "object" && "code" in error
				? (error as { code: unknown }).code
				: null;
	return isAppErrorCode(candidate) ? candidate : null;
}

/** User-facing message for a known error code, otherwise `fallback()`. */
export function appErrorMessage(
	error: unknown,
	fallback: () => string,
): string {
	const code = getAppErrorCode(error);
	return code ? APP_ERROR_MESSAGES[code]() : fallback();
}
