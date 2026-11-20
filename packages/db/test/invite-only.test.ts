import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/client";
import { listPublicCalendarEntries } from "../src/queries/calendar";
import { registerForEvent } from "../src/queries/event-registrations";
import {
	getEventAccess,
	getEventById,
	getEventPage,
	regenerateInviteToken,
	updateEvent,
} from "../src/queries/events";
import { events } from "../src/schema/events";
import { createEvent, createUser, resetDb } from "./helpers";

beforeEach(resetDb);

const signedIn = { kind: "public", signedIn: true } as const;

async function privateEvent(): Promise<string> {
	const id = await createEvent();
	await updateEvent({ id, visibility: "private" });
	return id;
}

describe("invite-only events", () => {
	it("are never listed or in the campus feed, even for signed-in people", async () => {
		const id = await privateEvent();
		expect(
			(await getEventPage({ audience: signedIn }, 20)).events.map((e) => e.id),
		).not.toContain(id);
		expect(await getEventById(id, signedIn)).toBeNull();
		expect(
			(await listPublicCalendarEntries(new Date())).map((e) => e.id),
		).not.toContain(id);
		expect(
			(await getEventById(id, { ...signedIn, includePrivate: true }))?.id,
		).toBe(id);
	});

	it("get an invite token when made private, and a new one on demand", async () => {
		const id = await privateEvent();
		const first = (await getEventAccess(id))?.inviteToken;
		expect(first).toMatch(/^[0-9a-f]{32,}$/);
		await updateEvent({ id, title: "Inny tytuł" });
		expect((await getEventAccess(id))?.inviteToken).toBe(first);
		const second = await regenerateInviteToken(id);
		expect(second).not.toBe(first);
		expect((await getEventAccess(id))?.inviteToken).toBe(second);
	});

	it("access info says who already holds a registration", async () => {
		const id = await privateEvent();
		const user = await createUser();
		expect((await getEventAccess(id, user))?.hasRegistration).toBe(false);
		await registerForEvent(id, user, "pl");
		expect((await getEventAccess(id, user))?.hasRegistration).toBe(true);
	});

	it("the public read never carries the token", async () => {
		const id = await privateEvent();
		const event = await getEventById(id, { ...signedIn, includePrivate: true });
		expect(event && "inviteToken" in event).toBe(false);
		const [row] = await db.select().from(events).where(eq(events.id, id));
		expect(row?.inviteToken).toBeTruthy();
	});
});

describe("invite links stay consistent", () => {
	it("a duplicated invite-only event gets its own link", async () => {
		const { duplicateEvent } = await import("../src/queries/event-duplicate");
		const id = await privateEvent();
		const actor = await createUser();
		const copy = await duplicateEvent({
			eventId: id,
			date: new Date(Date.now() + 20 * 86_400_000),
			actorId: actor,
		});
		const token = (await getEventAccess(copy.id))?.inviteToken;
		expect(token).toBeTruthy();
		expect(token).not.toBe((await getEventAccess(id))?.inviteToken);
	});

	it("leaving invite-only drops the link, so going back makes a new one", async () => {
		const id = await privateEvent();
		const first = (await getEventAccess(id))?.inviteToken;
		await updateEvent({ id, visibility: "public" });
		expect((await getEventAccess(id))?.inviteToken).toBeNull();
		await updateEvent({ id, visibility: "private" });
		expect((await getEventAccess(id))?.inviteToken).not.toBe(first);
	});

	it("an invite-only event cannot exist without a link", async () => {
		const id = await privateEvent();
		await expect(
			db.update(events).set({ inviteToken: null }).where(eq(events.id, id)),
		).rejects.toThrow();
	});

	it("a declined request does not open the event", async () => {
		const { eventRegistrations } = await import("../src/schema/event-registrations");
		const id = await privateEvent();
		const user = await createUser();
		await registerForEvent(id, user, "pl");
		await db.update(eventRegistrations).set({ state: "rejected" }).where(eq(eventRegistrations.userId, user));
		expect((await getEventAccess(id, user))?.hasRegistration).toBe(false);
	});
});
