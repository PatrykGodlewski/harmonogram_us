import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/client";
import {
	isRegisteredForEvent,
	registerForEvent,
} from "../src/queries/event-registrations";
import {
	createEvent,
	getEventById,
	getEventOnlineUrl,
	getEventPage,
	publishEvent,
} from "../src/queries/events";
import { eventLocations, eventTypes } from "../src/schema/event-lookups";
import { events } from "../src/schema/events";
import { createUser, resetDb } from "./helpers";

beforeEach(resetDb);

async function draft(values: Partial<typeof events.$inferInsert> = {}) {
	await db
		.insert(eventTypes)
		.values({ id: "t", slug: "t", label: "T" })
		.onConflictDoNothing();
	const event = await createEvent({
		title: "Szkic",
		date: new Date(Date.now() + 86_400_000),
		maxSeats: 5,
		typeId: "t",
		organizerId: null,
	});
	if (!event) throw new Error("no event");
	if (Object.keys(values).length > 0) {
		await db.update(events).set(values).where(eq(events.id, event.id));
	}
	return event.id;
}

describe("event status", () => {
	it("a new event is a draft", async () => {
		const id = await draft();
		expect((await getEventById(id, "manage"))?.status).toBe("draft");
	});

	it("the public list and page skip drafts; the panel sees them", async () => {
		const id = await draft();
		const page = await getEventPage({ audience: "public" }, 20);
		expect(page.events.map((e) => e.id)).not.toContain(id);
		expect(await getEventById(id, "public")).toBeNull();
		expect(await getEventById(id, "manage")).not.toBeNull();
	});

	it("registering for a draft is 'event not found'", async () => {
		const id = await draft();
		const userId = await createUser();
		await expect(registerForEvent(id, userId, "pl")).rejects.toMatchObject({
			code: "EVENT_NOT_FOUND",
		});
	});

	it("publishing needs a place for on-site and a link for online events", async () => {
		const onsite = await draft();
		await expect(publishEvent(onsite)).rejects.toMatchObject({
			code: "EVENT_INCOMPLETE",
		});
		const online = await draft({ attendanceMode: "online" });
		await expect(publishEvent(online)).rejects.toMatchObject({
			code: "EVENT_INCOMPLETE",
		});
		await db
			.insert(eventLocations)
			.values({ id: "aula", slug: "aula", label: "Aula" });
		const hybrid = await draft({
			attendanceMode: "hybrid",
			locationId: "aula",
		});
		await expect(publishEvent(hybrid)).rejects.toMatchObject({
			code: "EVENT_INCOMPLETE",
		});
	});

	it("createEvent stores the format and the online link", async () => {
		await db
			.insert(eventTypes)
			.values({ id: "t", slug: "t", label: "T" })
			.onConflictDoNothing();
		const event = await createEvent({
			title: "Online",
			date: new Date(Date.now() + 86_400_000),
			maxSeats: 5,
			typeId: "t",
			organizerId: null,
			attendanceMode: "online",
			onlineUrl: "https://meet.example.test/a",
		});
		expect(event).toMatchObject({
			attendanceMode: "online",
			onlineUrl: "https://meet.example.test/a",
		});
	});

	it("publishes once; a second publish is refused", async () => {
		const id = await draft({
			attendanceMode: "online",
			onlineUrl: "https://meet.example.test/x",
		});
		const published = await publishEvent(id);
		expect(published.status).toBe("published");
		expect(published.publishedAt).toBeInstanceOf(Date);
		const page = await getEventPage({ audience: "public" }, 20);
		expect(page.events.map((e) => e.id)).toContain(id);
		await expect(publishEvent(id)).rejects.toMatchObject({
			code: "EVENT_NOT_DRAFT",
		});
	});

	it("the public list and page never carry the meeting link; it is read on its own", async () => {
		const id = await draft({
			status: "published",
			attendanceMode: "online",
			onlineUrl: "https://meet.example.test/secret",
		});
		const page = await getEventPage({ audience: "public" }, 20);
		expect(page.events.find((e) => e.id === id)?.onlineUrl).toBeNull();
		expect((await getEventById(id, "public"))?.onlineUrl).toBeNull();
		expect((await getEventById(id, "manage"))?.onlineUrl).toBe(
			"https://meet.example.test/secret",
		);
		expect(await getEventOnlineUrl(id)).toBe("https://meet.example.test/secret");
	});

	it("isRegisteredForEvent is true only for a registered (not waitlisted) person", async () => {
		const id = await draft({ status: "published", maxSeats: 1 });
		const first = await createUser();
		const second = await createUser();
		await registerForEvent(id, first, "pl");
		await registerForEvent(id, second, "pl");
		expect(await isRegisteredForEvent(id, first)).toBe(true);
		expect(await isRegisteredForEvent(id, second)).toBe(false);
		expect(await isRegisteredForEvent(id, await createUser())).toBe(false);
	});
});
