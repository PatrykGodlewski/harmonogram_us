import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@repo/db/client";
import { registerForEvent } from "@repo/db/queries/event-registrations";
import { getEventAccess } from "@repo/db/queries/events";
import { events } from "@repo/db/schema/events";
import { createEvent, createUser, resetDb } from "../../db/test/helpers";
import { canViewEvent, eventViewAccess } from "../src/events/access";

vi.mock("@repo/db/queries/events", async (importOriginal) => {
	const original = await importOriginal<typeof import("@repo/db/queries/events")>();
	return { ...original, getEventAccess: vi.fn(original.getEventAccess) };
});

beforeEach(async () => {
	await resetDb();
	vi.mocked(getEventAccess).mockClear();
});

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

describe("eventViewAccess (sign in, or not found)", () => {
	it("asks a signed-out visitor to sign in only for a published signed-in-only event", async () => {
		expect(await eventViewAccess(await event({ visibility: "authenticated" }), null, undefined)).toBe(
			"sign-in",
		);
	});

	it("hides drafts, cancelled, invite-only and unknown events instead of asking to sign in", async () => {
		const draft = await event({ visibility: "authenticated", status: "draft" });
		expect(await eventViewAccess(draft, null, undefined)).toBe("hidden");
		expect(await eventViewAccess(draft, await createUser(), undefined)).toBe("hidden");
		const cancelled = await event({ visibility: "authenticated", status: "cancelled" });
		expect(await eventViewAccess(cancelled, null, undefined)).toBe("hidden");
		expect(await eventViewAccess(cancelled, await createUser(), undefined)).toBe("allowed");
		const invite = await event({ visibility: "private", inviteToken: "secret-1" });
		expect(await eventViewAccess(invite, null, undefined)).toBe("hidden");
		expect(await eventViewAccess(invite, await createUser(), "wrong")).toBe("hidden");
		expect(await eventViewAccess("missing", null, undefined)).toBe("hidden");
	});

	it("allows whoever may open the event page", async () => {
		expect(await eventViewAccess(await event({}), null, undefined)).toBe("allowed");
		const signedIn = await event({ visibility: "authenticated" });
		expect(await eventViewAccess(signedIn, await createUser(), undefined)).toBe("allowed");
		const invite = await event({ visibility: "private", inviteToken: "secret-1" });
		expect(await eventViewAccess(invite, null, "secret-1")).toBe("allowed");
	});

	it("reads the event's access data once", async () => {
		const id = await event({ visibility: "private", inviteToken: "secret-1" });
		vi.mocked(getEventAccess).mockClear();
		expect(await canViewEvent(id, null, "secret-1")).toBe(true);
		expect(getEventAccess).toHaveBeenCalledTimes(1);
	});
});
