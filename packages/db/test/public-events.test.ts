import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/client";
import { registerForEvent } from "../src/queries/event-registrations";
import { listUpcomingPublicEvents } from "../src/queries/public-events";
import { eventFaculties, eventLocations, eventTypes } from "../src/schema/event-lookups";
import { events } from "../src/schema/events";
import { createEvent, createUser, resetDb } from "./helpers";

const HOUR = 3_600_000;

beforeEach(resetDb);

async function event(
	title: string,
	startsInHours: number,
	set: Partial<typeof events.$inferInsert> = {},
): Promise<string> {
	const id = await createEvent({ date: new Date(Date.now() + startsInHours * HOUR) });
	await db
		.update(events)
		.set({ title, ...set })
		.where(eq(events.id, id));
	return id;
}

describe("listUpcomingPublicEvents", () => {
	it("lists only published public events that have not ended, nearest first", async () => {
		await event("Later", 48);
		await event("Sooner", 2);
		await event("Running", -2, { endsAt: new Date(Date.now() + HOUR) });
		await event("Ended", -5, { endsAt: new Date(Date.now() - HOUR) });
		await event("Draft", 3, { status: "draft" });
		await event("Cancelled", 3, { status: "cancelled" });
		await event("Signed-in only", 3, { visibility: "authenticated" });
		await event("Invite only", 3, { visibility: "private", inviteToken: "secret" });

		const listed = await listUpcomingPublicEvents(new Date(), { limit: 20 });
		expect(listed.map((e) => e.title)).toEqual(["Running", "Sooner", "Later"]);
	});

	it("filters by faculty and type slug (as the site's filters do) and respects the limit", async () => {
		// Created in the panel: a generated id, a slug from the name
		await db.insert(eventFaculties).values({ id: "0b6d-uuid", slug: "fiz", label: "Wydział Fizyki" });
		await db.insert(eventTypes).values({ id: "4f1e-uuid", slug: "wyklad", label: "Wykład" });
		await event("Physics 1", 1, { facultyId: "0b6d-uuid" });
		await event("Physics 2", 2, { facultyId: "0b6d-uuid", typeId: "4f1e-uuid" });
		await event("Other", 3);

		const physics = await listUpcomingPublicEvents(new Date(), { limit: 20, facultySlug: "fiz" });
		expect(physics.map((e) => e.title)).toEqual(["Physics 1", "Physics 2"]);
		expect(physics[0]?.faculty).toEqual({ slug: "fiz", label: "Wydział Fizyki" });
		expect(await listUpcomingPublicEvents(new Date(), { limit: 20, facultySlug: "0b6d-uuid" })).toEqual([]);
		const lectures = await listUpcomingPublicEvents(new Date(), { limit: 20, typeSlug: "wyklad" });
		expect(lectures.map((e) => e.title)).toEqual(["Physics 2"]);
		expect(lectures[0]?.type).toEqual({ slug: "wyklad", label: "Wykład" });
		expect((await listUpcomingPublicEvents(new Date(), { limit: 1 })).map((e) => e.title)).toEqual([
			"Physics 1",
		]);
	});

	it("gives the place, mode and seats left", async () => {
		await db.insert(eventLocations).values({ id: "aula", slug: "aula", label: "Aula" });
		const id = await event("Seminar", 5, { locationId: "aula", room: "B105", maxSeats: 10 });
		await registerForEvent(id, await createUser(), "pl");

		const [listed] = await listUpcomingPublicEvents(new Date(), { limit: 5 });
		expect(listed).toMatchObject({
			id,
			title: "Seminar",
			place: "Aula · B105",
			attendanceMode: "onsite",
			type: { slug: "test-type", label: "Test" },
			faculty: null,
			seatsRemaining: 9,
		});
		expect(listed?.startsAt).toBeInstanceOf(Date);
		expect(listed?.endsAt).toBeInstanceOf(Date);
	});
});
