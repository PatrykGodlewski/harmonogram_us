import { describe, expect, it } from "vitest";
import { LIVE_REFRESH_MS } from "../src/events/live-refresh";
import { myRegistrationsQueryOptions } from "../src/events/my-registrations";
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
});
