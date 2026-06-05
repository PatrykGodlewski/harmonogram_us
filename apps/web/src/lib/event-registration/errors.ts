import {
	events_register_already,
	events_register_full,
	events_unregister_not_registered,
} from "@repo/i18n/paraglide/messages";
import { toast } from "sonner";

export const EVENT_REGISTRATION_ERROR_CODES = [
	"ALREADY_REGISTERED",
	"EVENT_FULL",
	"NOT_REGISTERED",
	"EVENT_NOT_FOUND",
	"UNAUTHORIZED",
] as const;

export type EventRegistrationErrorCode =
	(typeof EVENT_REGISTRATION_ERROR_CODES)[number];

const REGISTRATION_ERROR_MESSAGES: Partial<
	Record<EventRegistrationErrorCode, () => string>
> = {
	ALREADY_REGISTERED: events_register_already,
	EVENT_FULL: events_register_full,
	NOT_REGISTERED: events_unregister_not_registered,
};

function isEventRegistrationErrorCode(
	value: string,
): value is EventRegistrationErrorCode {
	return EVENT_REGISTRATION_ERROR_CODES.some((code) => code === value);
}

export function getRegistrationErrorCode(
	error: unknown,
): EventRegistrationErrorCode | null {
	if (!(error instanceof Error)) {
		return null;
	}

	return isEventRegistrationErrorCode(error.message) ? error.message : null;
}

export function showRegistrationErrorToast(
	error: unknown,
	fallbackMessage: () => string,
) {
	const code = getRegistrationErrorCode(error);
	const message = code ? REGISTRATION_ERROR_MESSAGES[code]?.() : undefined;

	if (message) {
		toast.error(message);
		return;
	}

	toast.error(error instanceof Error ? error.message : fallbackMessage());
}
