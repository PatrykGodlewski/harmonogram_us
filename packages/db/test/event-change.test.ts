import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/client";
import {
	type EventChangeNotice,
	registerForEvent,
} from "../src/queries/event-registrations";
import { updateEvent } from "../src/queries/events";
import { eventLocations } from "../src/schema/event-lookups";
import { events } from "../src/schema/events";
import { createEvent, createUser, hoursFromNow, resetDb } from "./helpers";

beforeEach(resetDb);

function collect() {
	const notices: EventChangeNotice[] = [];
	return {
		notices,
		hooks: {
			onChanged: async () => {},
			onEventChanged: async (_tx: unknown, notice: EventChangeNotice) => {
				notices.push(notice);
			},
		},
	};
}

describe("event change notices", () => {
	it("a new date on a published event reaches registered and waitlisted people", async () => {
		const eventId = await createEvent({ maxSeats: 1, date: hoursFromNow(48) });
		await registerForEvent(eventId, await createUser(), "pl");
		await registerForEvent(eventId, await createUser(), "pl");
		const { notices, hooks } = collect();
		const newDate = hoursFromNow(72);

		await updateEvent({ id: eventId, date: newDate }, hooks);

		expect(notices).toHaveLength(1);
		expect(notices[0]?.registrationIds).toHaveLength(2);
		expect(notices[0]?.after.date).toEqual(newDate);
		expect(notices[0]?.before.date).not.toEqual(newDate);
	});

	it("a new room is a change of place, with readable old and new places", async () => {
		await db.insert(eventLocations).values({ id: "aula", slug: "aula", label: "Aula" });
		const eventId = await createEvent();
		await db.update(events).set({ locationId: "aula", room: "A1" }).where(eq(events.id, eventId));
		await registerForEvent(eventId, await createUser(), "pl");
		const { notices, hooks } = collect();

		await updateEvent({ id: eventId, room: "B105" }, hooks);

		expect(notices[0]?.before.place).toBe("Aula · A1");
		expect(notices[0]?.after.place).toBe("Aula · B105");
	});

	it("drafts and description-only edits tell nobody; a new date re-arms the reminder", async () => {
		const draft = await createEvent();
		await db.update(events).set({ status: "draft" }).where(eq(events.id, draft));
		const published = await createEvent({ date: hoursFromNow(20) });
		await registerForEvent(published, await createUser(), "pl");
		await db.update(events).set({ reminderSentAt: new Date() }).where(eq(events.id, published));
		const { notices, hooks } = collect();

		await updateEvent({ id: draft, date: hoursFromNow(80) }, hooks);
		await updateEvent({ id: published, description: "Nowy opis" }, hooks);
		expect(notices).toHaveLength(0);

		await updateEvent({ id: published, date: hoursFromNow(90) }, hooks);
		const [row] = await db.select({ sent: events.reminderSentAt }).from(events).where(eq(events.id, published));
		expect(row?.sent).toBeNull();
	});

	it("an event that already ended tells nobody, and a reminder already past stays sent", async () => {
		const ended = await createEvent({ date: hoursFromNow(-48) });
		await registerForEvent(await createEvent(), await createUser(), "pl");
		const { notices, hooks } = collect();
		await updateEvent({ id: ended, date: hoursFromNow(-47) }, hooks);
		expect(notices).toHaveLength(0);

		const soon = await createEvent({ date: hoursFromNow(20) });
		const sentAt = new Date();
		await db.update(events).set({ reminderSentAt: sentAt }).where(eq(events.id, soon));
		// Moved 30 minutes: the 24 h reminder time is still in the past, so no second reminder.
		await updateEvent({ id: soon, date: hoursFromNow(20.5) }, hooks);
		const [row] = await db.select({ sent: events.reminderSentAt }).from(events).where(eq(events.id, soon));
		expect(row?.sent).toEqual(sentAt);
	});
});
