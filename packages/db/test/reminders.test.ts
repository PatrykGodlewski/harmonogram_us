import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/client";
import { registerForEvent } from "../src/queries/event-registrations";
import { cancelEvent } from "../src/queries/events";
import { queueDueReminders } from "../src/queries/reminders";
import { events } from "../src/schema/events";
import { createEvent, createUser, hoursFromNow, resetDb } from "./helpers";

beforeEach(resetDb);

function collect() {
	const sent: { eventId: string; ids: string[] }[] = [];
	return {
		sent,
		onRecipients: async (_tx: unknown, ids: string[], eventId: string) => {
			sent.push({ eventId, ids });
		},
	};
}

describe("queueDueReminders", () => {
	it("reminds registered people (not the waitlist) once, inside the reminder window", async () => {
		const eventId = await createEvent({ maxSeats: 1, date: hoursFromNow(23) });
		await registerForEvent(eventId, await createUser(), "pl");
		await registerForEvent(eventId, await createUser(), "pl");
		const { sent, onRecipients } = collect();

		expect((await queueDueReminders(new Date(), onRecipients)).events).toBe(1);
		expect(sent).toHaveLength(1);
		expect(sent[0]?.ids).toHaveLength(1);

		expect((await queueDueReminders(new Date(), onRecipients)).events).toBe(0);
		expect(sent).toHaveLength(1);
	});

	it("waits until the window opens, and skips switched-off, cancelled and draft events", async () => {
		const later = await createEvent({ date: hoursFromNow(30) });
		await registerForEvent(later, await createUser(), "pl");
		const off = await createEvent({ date: hoursFromNow(5) });
		await db.update(events).set({ reminderHoursBefore: null }).where(eq(events.id, off));
		await registerForEvent(off, await createUser(), "pl");
		const cancelled = await createEvent({ date: hoursFromNow(5) });
		await registerForEvent(cancelled, await createUser(), "pl");
		await cancelEvent(cancelled);
		const draft = await createEvent({ date: hoursFromNow(5) });
		await db.update(events).set({ status: "draft" }).where(eq(events.id, draft));
		const { sent, onRecipients } = collect();

		await queueDueReminders(new Date(), onRecipients);

		expect(sent).toHaveLength(0);
		// 30 h before the start, with a 24 h reminder, it's due 7 h from now.
		await queueDueReminders(hoursFromNow(7), onRecipients);
		expect(sent.map((s) => s.eventId)).toEqual([later]);
	});
});
