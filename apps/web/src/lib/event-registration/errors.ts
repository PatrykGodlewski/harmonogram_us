import {
	events_event_ended,
	events_item_ended,
	events_item_full,
	events_item_not_found,
	events_item_not_registrable,
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
	"EVENT_ENDED",
	"ITEM_FULL",
	"ITEM_ENDED",
	"ITEM_NOT_FOUND",
	"ITEM_NOT_REGISTRABLE",
	"UNAUTHORIZED",
] as const;

export type DomainErrorCode = (typeof EVENT_REGISTRATION_ERROR_CODES)[number];

const REGISTRATION_ERROR_MESSAGES: Partial<
	Record<DomainErrorCode, () => string>
> = {
	ALREADY_REGISTERED: events_register_already,
	EVENT_FULL: events_register_full,
	NOT_REGISTERED: events_unregister_not_registered,
	EVENT_ENDED: events_event_ended,
	ITEM_FULL: events_item_full,
	ITEM_ENDED: events_item_ended,
	ITEM_NOT_FOUND: events_item_not_found,
	ITEM_NOT_REGISTRABLE: events_item_not_registrable,
};

function isDomainErrorCode(value: string): value is DomainErrorCode {
	return EVENT_REGISTRATION_ERROR_CODES.some((code) => code === value);
}

export function getDomainErrorCode(error: unknown): DomainErrorCode | null {
	if (!(error instanceof Error)) {
		return null;
	}

	return isDomainErrorCode(error.message) ? error.message : null;
}

export function showRegistrationErrorToast(
	error: unknown,
	fallbackMessage: () => string,
) {
	const code = getDomainErrorCode(error);
	const message = code ? REGISTRATION_ERROR_MESSAGES[code]?.() : undefined;

	if (message) {
		toast.error(message);
		return;
	}

	toast.error(error instanceof Error ? error.message : fallbackMessage());
}
