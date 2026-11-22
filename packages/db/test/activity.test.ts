import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/client";
import { getMonthlyActivity } from "../src/queries/activity";
import { eventRegistrations } from "../src/schema/event-registrations";
import { events } from "../src/schema/events";
import { createEvent, createUser, resetDb } from "./helpers";

const ZONE = "Europe/Warsaw";
const NOW = new Date("2026-11-21T12:00:00Z");

async function addRegistration(
	eventId: string,
	createdAt: Date,
	state: "registered" | "rejected" = "registered",
) {
	await db.insert(eventRegistrations).values({
		id: crypto.randomUUID(),
		eventId,
		userId: await createUser(),
		state,
		createdAt,
	});
}

beforeEach(async () => {
	await resetDb();
});

describe("getMonthlyActivity", () => {
	it("counts events and registrations per month, without drafts and rejections", async () => {
		const published = await createEvent({ date: new Date("2026-11-10T10:00:00Z") });
		const cancelled = await createEvent({ date: new Date("2026-10-05T10:00:00Z") });
		const draft = await createEvent({ date: new Date("2026-11-12T10:00:00Z") });
		await db.update(events).set({ status: "published" }).where(eq(events.id, published));
		await db.update(events).set({ status: "cancelled" }).where(eq(events.id, cancelled));
		await db.update(events).set({ status: "draft" }).where(eq(events.id, draft));
		await addRegistration(published, new Date("2026-11-02T10:00:00Z"));
		await addRegistration(published, new Date("2026-11-03T10:00:00Z"));
		await addRegistration(published, new Date("2026-11-04T10:00:00Z"), "rejected");

		const activity = await getMonthlyActivity(12, ZONE, NOW);
		expect(activity.at(-1)).toEqual({ month: "2026-11", events: 1, registrations: 2 });
		expect(activity.at(-2)).toEqual({ month: "2026-10", events: 1, registrations: 0 });
	});

	it("returns every month, oldest first, with zeros", async () => {
		const activity = await getMonthlyActivity(12, ZONE, NOW);
		expect(activity).toHaveLength(12);
		expect(activity[0]).toEqual({ month: "2025-12", events: 0, registrations: 0 });
		expect(activity.at(-1)?.month).toBe("2026-11");
	});

	it("puts a registration in the local month", async () => {
		const event = await createEvent({ date: new Date("2026-11-10T10:00:00Z") });
		// 23:30 UTC on 31 October is 00:30 on 1 November in Warsaw.
		await addRegistration(event, new Date("2026-10-31T23:30:00Z"));
		const activity = await getMonthlyActivity(2, ZONE, NOW);
		expect(activity).toEqual([
			{ month: "2026-10", events: 0, registrations: 0 },
			{ month: "2026-11", events: 1, registrations: 1 },
		]);
	});
});
