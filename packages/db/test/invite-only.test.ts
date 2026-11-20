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
