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
import { createEvent, resetDb } from "./helpers";

const hash = (token: string) =>
	createHash("sha256").update(token).digest("base64url");

async function request(eventId: string) {
	return createGuestRequest({
		eventId,
		email: "Gosc@X.test",
		name: "Gość Testowy",
		locale: "pl",
		answers: { q1: "Informatyka" },
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
