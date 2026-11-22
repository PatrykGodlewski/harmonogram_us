import type { EventDetails } from "@repo/api/events/queries";
import type { Approval } from "~/lib/registration/approval";

export type EventDetailsData = EventDetails;
export type AgendaItemData = EventDetails["agenda"][number];
export type AgendaItemRef = Pick<AgendaItemData, "id" | "title">;

export type ItemSeatCount = {
	seatsRemaining: number | null;
	maxSeats: number | null;
	registeredCount: number;
};

export type EventDetailsRegistrations = {
	isEventRegistered: boolean;
	registeredItemIds: ReadonlySet<string>;
	/** 1-based waitlist position, or null when not waitlisted. */
	waitlistPosition: number | null;
	approval: Approval;
	/** An action on this page is in flight (buttons wait for it). */
	isBusy: boolean;
	registerEvent: (answers?: Record<string, string>) => void;
	unregisterEvent: () => void;
	registerItem: (item: AgendaItemRef) => void;
	unregisterItem: (item: AgendaItemRef) => void;
};
