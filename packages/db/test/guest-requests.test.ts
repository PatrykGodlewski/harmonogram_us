import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/client";
import {
	createGuestRequest,
	pruneExpiredGuestRequests,
	takeGuestRequest,
} from "../src/queries/guest-requests";
import { guestRegistrationRequests } from "../src/schema/guest-requests";
import { eventQuestions } from "../src/schema/event-questions";
import { events } from "../src/schema/events";
import { createEvent, rejectionCode, resetDb } from "./helpers";

const hash = (token: string) =>
	createHash("sha256").update(token).digest("base64url");

async function request(eventId: string, extra: { answers?: Record<string, string>; inviteToken?: string } = {}) {
	return createGuestRequest({
		eventId,
		email: "Gosc@X.test",
		name: "Gość Testowy",
		locale: "pl",
		answers: extra.answers ?? { q1: "Informatyka" },
		inviteToken: extra.inviteToken,
	});
}

beforeEach(async () => {
	await resetDb();
});

describe("guest registration requests", () => {
	it("stores only a hash of the token", async () => {
		const eventId = await createEvent();
		const { token } = await request(eventId);
		const rows = await db.select().from(guestRegistrationRequests);
		expect(rows).toHaveLength(1);
		expect(rows[0]?.tokenHash).toBe(hash(token));
		expect(JSON.stringify(rows)).not.toContain(token);
		expect(rows[0]?.email).toBe("gosc@x.test");
	});

	it("can be taken once", async () => {
		const eventId = await createEvent();
		const { token } = await request(eventId);
		expect(await takeGuestRequest(token)).toMatchObject({
			eventId,
			email: "gosc@x.test",
			name: "Gość Testowy",
			locale: "pl",
			answers: { q1: "Informatyka" },
			inviteToken: null,
		});
		expect(await takeGuestRequest(token)).toBeNull();
		expect(await takeGuestRequest("unknown")).toBeNull();
	});

	it("cannot be taken after it expires", async () => {
		const eventId = await createEvent();
		const { token } = await request(eventId);
		await db
			.update(guestRegistrationRequests)
			.set({ expiresAt: new Date(Date.now() - 1000) })
			.where(eq(guestRegistrationRequests.tokenHash, hash(token)));
		expect(await takeGuestRequest(token)).toBeNull();
	});

	it("runs the hook in the same transaction, with the token", async () => {
		const eventId = await createEvent();
		let seen = "";
		const { token } = await createGuestRequest(
			{ eventId, email: "a@x.test", name: "A", locale: "en", answers: {} },
			async (_tx, hookToken) => {
				seen = hookToken;
			},
		);
		expect(seen).toBe(token);
	});

	it("accepts guests on every published event; invite-only ones need the link", async () => {
		// The e-mail link signs the guest in, so signed-in-only events take guests too.
		const signedInOnly = await createEvent();
		await db.update(events).set({ visibility: "authenticated" }).where(eq(events.id, signedInOnly));
		expect(await rejectionCode(request(signedInOnly))).toBe("RESOLVED");

		const draft = await createEvent();
		await db.update(events).set({ status: "draft" }).where(eq(events.id, draft));
		expect(await rejectionCode(request(draft))).toBe("EVENT_NOT_FOUND");

		const inviteOnly = await createEvent();
		await db.update(events).set({ visibility: "private", inviteToken: "secret-link" }).where(eq(events.id, inviteOnly));
		expect(await rejectionCode(request(inviteOnly))).toBe("EVENT_NOT_FOUND");
		expect(await rejectionCode(request(inviteOnly, { inviteToken: "secret-link" }))).toBe("RESOLVED");
		expect(await db.select().from(guestRegistrationRequests)).toHaveLength(2);
	});

	it("refuses a missing required answer", async () => {
		const eventId = await createEvent();
		await db.insert(eventQuestions).values({
			id: "q-required",
			eventId,
			label: "Kierunek",
			kind: "text",
			required: true,
			position: 0,
		});
		expect(await rejectionCode(request(eventId, { answers: {} }))).toBe("ANSWERS_INVALID");
		expect(await rejectionCode(request(eventId, { answers: { "q-required": "Fizyka" } }))).toBe("RESOLVED");
	});

	it("prune removes only expired requests", async () => {
		const eventId = await createEvent();
		const expired = await request(eventId);
		await request(eventId);
		await db
			.update(guestRegistrationRequests)
			.set({ expiresAt: new Date(Date.now() - 1000) })
			.where(eq(guestRegistrationRequests.tokenHash, hash(expired.token)));
		expect(await pruneExpiredGuestRequests()).toBe(1);
		expect(await db.select().from(guestRegistrationRequests)).toHaveLength(1);
	});
});

describe("withdrawing by link", () => {
	it("withdraws a registration and refuses a rejected one (it must not ask again)", async () => {
		const { registerForEvent } = await import("../src/queries/event-registrations");
		const { rejectRegistrations } = await import("../src/queries/registration-approval");
		const { withdrawRegistrationByLink } = await import("../src/queries/event-registrations");
		const { createUser, stateOf } = await import("./helpers");
		const { eventRegistrations } = await import("../src/schema/event-registrations");
		const eventId = await createEvent({ requiresApproval: true });
		const kept = await createUser("kept@x.test");
		const rejected = await createUser("rejected@x.test");
		await registerForEvent(eventId, kept, "pl");
		await registerForEvent(eventId, rejected, "pl");
		const idOf = async (userId: string) =>
			(
				await db
					.select({ id: eventRegistrations.id })
					.from(eventRegistrations)
					.where(eq(eventRegistrations.userId, userId))
			)[0]?.id ?? "";
		const rejectedId = await idOf(rejected);
		await rejectRegistrations(eventId, [rejectedId]);

		expect(await rejectionCode(withdrawRegistrationByLink(rejectedId))).toBe("NOT_REGISTERED");
		expect(await stateOf(eventId, rejected)).toBe("rejected");

		await withdrawRegistrationByLink(await idOf(kept));
		expect(await stateOf(eventId, kept)).toBeNull();
	});
});
