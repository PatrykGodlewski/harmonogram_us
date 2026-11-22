import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@repo/db/client";
import { registerForEvent } from "@repo/db/queries/event-registrations";
import { events } from "@repo/db/schema/events";
import { createEvent, createUser, resetDb } from "../../db/test/helpers";
import { canViewEvent } from "../src/events/access";

beforeEach(resetDb);

async function event(set: Partial<typeof events.$inferInsert>): Promise<string> {
	const id = await createEvent();
	if (Object.keys(set).length > 0) {
		await db.update(events).set(set).where(eq(events.id, id));
	}
	return id;
}

describe("canViewEvent (event page and its files)", () => {
	it("lets anyone see a published public event, and nobody a draft", async () => {
		expect(await canViewEvent(await event({}), null, undefined)).toBe(true);
		expect(await canViewEvent(await event({ status: "cancelled" }), null, undefined)).toBe(true);
		const draft = await event({ status: "draft" });
		expect(await canViewEvent(draft, null, undefined)).toBe(false);
		expect(await canViewEvent(draft, await createUser(), undefined)).toBe(false);
	});

	it("needs a signed-in viewer for a signed-in-only event", async () => {
		const id = await event({ visibility: "authenticated" });
		expect(await canViewEvent(id, null, undefined)).toBe(false);
		expect(await canViewEvent(id, await createUser(), undefined)).toBe(true);
	});

	it("needs the invite secret or a registration for an invite-only event", async () => {
		const id = await event({ visibility: "private", inviteToken: "secret-1" });
		const registered = await createUser();
		await registerForEvent(id, registered, "pl");
		expect(await canViewEvent(id, null, undefined)).toBe(false);
		expect(await canViewEvent(id, null, "wrong")).toBe(false);
		expect(await canViewEvent(id, null, "secret-1")).toBe(true);
		expect(await canViewEvent(id, registered, undefined)).toBe(true);
	});

	it("is false for an unknown event", async () => {
		expect(await canViewEvent("missing", null, undefined)).toBe(false);
	});
});
