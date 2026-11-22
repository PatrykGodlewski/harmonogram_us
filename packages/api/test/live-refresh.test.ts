import { describe, expect, it } from "vitest";
import { LIVE_REFRESH_MS } from "../src/events/live-refresh";
import { myRegistrationListQueryOptions } from "../src/events/my-registration-list";
import { myRegistrationsQueryOptions } from "../src/events/my-registrations";
import { ticketQueryOptions } from "../src/events/ticket";
import {
	eventDetailsQueryOptions,
	eventsQueryOptions,
} from "../src/events/queries";

const entry = (state: "registered" | "waitlisted") => ({
	eventId: "e1",
	state,
	waitlistPosition: state === "waitlisted" ? 1 : null,
});

describe("open pages refresh their data", () => {
	it("every 15 s for the event list and the event page", () => {
		expect(LIVE_REFRESH_MS).toBe(15_000);
		expect(eventsQueryOptions({}).refetchInterval).toBe(LIVE_REFRESH_MS);
		expect(eventDetailsQueryOptions("e1").refetchInterval).toBe(LIVE_REFRESH_MS);
		expect(eventDetailsQueryOptions("e1", "secret").refetchInterval).toBe(LIVE_REFRESH_MS);
	});

	it("the user's registrations only while they wait on a waitlist (a promotion happens elsewhere)", () => {
		// TanStack Query calls the interval with the query, not its data.
		const interval = myRegistrationsQueryOptions.refetchInterval as (query: {
			state: { data: unknown };
		}) => number | false;
		const withStates = (states: ("registered" | "waitlisted")[]) => ({
			state: { data: { events: states.map(entry), agendaItemIds: [] } },
		});
		expect(interval({ state: { data: undefined } })).toBe(false);
		expect(interval(withStates(["registered"]))).toBe(false);
		expect(interval(withStates(["registered", "waitlisted"]))).toBe(LIVE_REFRESH_MS);
	});

	it("the account page's list too, while one of its rows waits on a waitlist", () => {
		const interval = myRegistrationListQueryOptions.refetchInterval as (query: {
			state: { data: unknown };
		}) => number | false;
		const rows = (states: ("registered" | "waitlisted")[]) => ({
			state: { data: states.map((state) => ({ state })) },
		});
		expect(interval({ state: { data: undefined } })).toBe(false);
		expect(interval(rows(["registered"]))).toBe(false);
		expect(interval(rows(["registered", "waitlisted"]))).toBe(LIVE_REFRESH_MS);
	});

	it("an open ticket while its registration waits on a waitlist (it turns into a QR code on promotion)", () => {
		const interval = ticketQueryOptions("r1").refetchInterval as (query: {
			state: { data: unknown };
		}) => number | false;
		expect(interval({ state: { data: undefined } })).toBe(false);
		expect(interval({ state: { data: null } })).toBe(false);
		expect(interval({ state: { data: { state: "registered" } } })).toBe(false);
		expect(interval({ state: { data: { state: "waitlisted" } } })).toBe(LIVE_REFRESH_MS);
	});
});
