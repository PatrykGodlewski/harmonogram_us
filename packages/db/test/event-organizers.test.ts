import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/client";
import {
	addEventOrganizer,
	canCreateEvents,
	canManageEvent,
	hasPanelAccess,
	listEventOrganizers,
	listManagedEventIds,
	removeEventOrganizer,
} from "../src/queries/event-organizers";
import { createEvent } from "../src/queries/events";
import { authUsers } from "../src/schema/better-auth";
import { eventTypes } from "../src/schema/event-lookups";
import { createUser, resetDb } from "./helpers";

beforeEach(resetDb);

async function setRole(userId: string, role: string) {
	await db.update(authUsers).set({ role }).where(eq(authUsers.id, userId));
}

async function newEvent(organizerId: string | null) {
	await db
		.insert(eventTypes)
		.values({ id: "t", slug: "t", label: "T" })
		.onConflictDoNothing();
	const event = await createEvent({
		title: "E",
		date: new Date(Date.now() + 86_400_000),
		maxSeats: 5,
		typeId: "t",
		organizerId,
	});
	if (!event) throw new Error("no event");
	return event.id;
}

async function rejects(promise: Promise<unknown>, code: string) {
	await expect(promise).rejects.toMatchObject({ code });
}

describe("event organizers", () => {
	it("the creator becomes an organizer", async () => {
		const creator = await createUser();
		await setRole(creator, "organizer");
		const eventId = await newEvent(creator);
		expect(await canManageEvent(creator, eventId)).toBe(true);
		const organizers = await listEventOrganizers(eventId);
		expect(organizers.map((o) => o.userId)).toEqual([creator]);
	});

	it("a foreign organizer cannot manage, an admin can", async () => {
		const creator = await createUser();
		const other = await createUser();
		const admin = await createUser();
		await setRole(other, "organizer");
		await setRole(admin, "admin");
		const eventId = await newEvent(creator);
		expect(await canManageEvent(other, eventId)).toBe(false);
		expect(await canManageEvent(admin, eventId)).toBe(true);
	});

	it("adds an existing account by e-mail, case-insensitively", async () => {
		const creator = await createUser();
		const colleague = await createUser("kolega@e2e.test");
		const eventId = await newEvent(creator);
		const added = await addEventOrganizer(eventId, "  Kolega@E2E.test ");
		expect(added).toMatchObject({
			userId: colleague,
			email: "kolega@e2e.test",
		});
		expect(await canManageEvent(colleague, eventId)).toBe(true);
		await rejects(
			addEventOrganizer(eventId, "kolega@e2e.test"),
			"ALREADY_ORGANIZER",
		);
		await rejects(
			addEventOrganizer(eventId, "nobody@e2e.test"),
			"USER_NOT_FOUND",
		);
	});

	it("panel access: creators by role, plain users only as co-organizers", async () => {
		const organizer = await createUser();
		const plain = await createUser("plain@e2e.test");
		const stranger = await createUser();
		await setRole(organizer, "organizer");
		expect(await canCreateEvents(organizer)).toBe(true);
		expect(await canCreateEvents(plain)).toBe(false);
		expect(await hasPanelAccess(organizer)).toBe(true);
		const eventId = await newEvent(organizer);
		await addEventOrganizer(eventId, "plain@e2e.test");
		expect(await hasPanelAccess(plain)).toBe(true);
		expect(await hasPanelAccess(stranger)).toBe(false);
		expect(await listManagedEventIds(plain)).toEqual([eventId]);
	});

	it("lists all events for an admin", async () => {
		const admin = await createUser();
		await setRole(admin, "admin");
		expect(await listManagedEventIds(admin)).toBe("all");
	});

	it("cannot remove the last organizer", async () => {
		const creator = await createUser();
		const colleague = await createUser("c@e2e.test");
		const eventId = await newEvent(creator);
		await addEventOrganizer(eventId, "c@e2e.test");
		await removeEventOrganizer(eventId, colleague);
		expect(await canManageEvent(colleague, eventId)).toBe(false);
		await rejects(removeEventOrganizer(eventId, creator), "LAST_ORGANIZER");
	});

	it("the database rejects unknown roles", async () => {
		const userId = await createUser();
		await expect(
			db.execute(
				sql`UPDATE "user" SET role = 'superuser' WHERE id = ${userId}`,
			),
		).rejects.toThrow();
	});
});
