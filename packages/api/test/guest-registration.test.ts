import { db } from "@repo/db/client";
import { events } from "@repo/db/schema/events";
import { env } from "@repo/env";
import { getBoss } from "@repo/jobs/client";
import { QUEUE_EMAILS } from "@repo/jobs/queues";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createEvent, resetDb } from "../../db/test/helpers";
import { requestGuestRegistration } from "../src/registrations/guest-registration";

beforeEach(async () => {
	await resetDb();
	// Starting pg-boss creates its schema (a fresh database has none).
	await getBoss();
	await db.execute(sql`DELETE FROM pgboss.job WHERE name = ${QUEUE_EMAILS}`);
});

afterAll(async () => {
	await (await getBoss()).stop();
});

async function queuedEmails() {
	return db.execute<{ data: Record<string, string> }>(
		sql`SELECT data FROM pgboss.job WHERE name = ${QUEUE_EMAILS} AND state = 'created'`,
	);
}

describe("requestGuestRegistration", () => {
	it("queues a confirmation e-mail with a link to the confirm page", async () => {
		const eventId = await createEvent();
		await db.update(events).set({ title: "Koncert" }).where(eq(events.id, eventId));
		await requestGuestRegistration({
			eventId,
			email: "gosc@x.test",
			name: "Gość",
			locale: "pl",
			answers: {},
		});
		const [job] = await queuedEmails();
		expect(job?.data).toMatchObject({
			kind: "guest-confirmation",
			to: "gosc@x.test",
			eventTitle: "Koncert",
			locale: "pl",
		});
		const url = new URL(job?.data.url ?? "");
		expect(url.origin).toBe(new URL(env.BETTER_AUTH_URL).origin);
		expect(url.pathname).toBe("/pl/guest/confirm");
		expect(url.searchParams.get("token")).toMatch(/^[\w-]{43}$/);
	});

	it("queues nothing when the event refuses guests", async () => {
		const eventId = await createEvent();
		await db.update(events).set({ visibility: "authenticated" }).where(eq(events.id, eventId));
		await expect(
			requestGuestRegistration({ eventId, email: "g@x.test", name: "G", locale: "en", answers: {} }),
		).rejects.toThrow("GUESTS_NOT_ALLOWED");
		expect(await queuedEmails()).toHaveLength(0);
	});
});

describe("POST /guest-registration/confirm", () => {
	async function guestToken(eventId: string, email = "gosc@x.test") {
		const { createGuestRequest } = await import("@repo/db/queries/guest-requests");
		const { token } = await createGuestRequest({
			eventId,
			email,
			name: "Gość Testowy",
			locale: "pl",
			answers: {},
		});
		return token;
	}

	async function confirm(token: string) {
		const { auth } = await import("../src/auth/better-auth");
		return auth.handler(
			new Request(`${env.BETTER_AUTH_URL}/api/auth/guest-registration/confirm`, {
				method: "POST",
				headers: { "content-type": "application/json", origin: env.BETTER_AUTH_URL },
				body: JSON.stringify({ token }),
			}),
		);
	}

	async function registrationOf(eventId: string, email: string) {
		const { eventRegistrations } = await import("@repo/db/schema/event-registrations");
		const { authUsers } = await import("@repo/db/schema/better-auth");
		const [row] = await db
			.select({ state: eventRegistrations.state, name: authUsers.name })
			.from(eventRegistrations)
			.innerJoin(authUsers, eq(authUsers.id, eventRegistrations.userId))
			.where(eq(authUsers.email, email));
		return row && { ...row, eventId };
	}

	it("registers once and signs the guest in", async () => {
		const eventId = await createEvent();
		const token = await guestToken(eventId);

		const first = await confirm(token);
		expect(first.status).toBe(200);
		expect(first.headers.get("set-cookie")).toContain("session_token");
		expect(await first.json()).toMatchObject({ eventId, state: "registered" });
		expect(await registrationOf(eventId, "gosc@x.test")).toMatchObject({
			state: "registered",
			name: "Gość Testowy",
		});

		const second = await confirm(token);
		expect(second.status).toBe(400);
		expect(await second.json()).toMatchObject({ code: "GUEST_LINK_INVALID" });
	});

	it("re-checks access at confirmation: a revoked invite link or a signed-in-only switch", async () => {
		const { createGuestRequest } = await import("@repo/db/queries/guest-requests");
		const inviteOnly = await createEvent();
		await db
			.update(events)
			.set({ visibility: "private", inviteToken: "old-link" })
			.where(eq(events.id, inviteOnly));
		const { token: invited } = await createGuestRequest({
			eventId: inviteOnly,
			email: "invited@x.test",
			name: "Zaproszony",
			locale: "pl",
			answers: {},
			inviteToken: "old-link",
		});
		await db.update(events).set({ inviteToken: "new-link" }).where(eq(events.id, inviteOnly));
		const revoked = await confirm(invited);
		expect(revoked.status).toBe(400);
		expect(await revoked.json()).toMatchObject({ code: "EVENT_NOT_FOUND" });

		const publicEvent = await createEvent();
		const token = await guestToken(publicEvent, "later@x.test");
		await db.update(events).set({ visibility: "authenticated" }).where(eq(events.id, publicEvent));
		const switched = await confirm(token);
		expect(await switched.json()).toMatchObject({ code: "GUESTS_NOT_ALLOWED" });
		expect(await registrationOf(publicEvent, "later@x.test")).toBeUndefined();
	});

	it("puts the guest on the waitlist when the event filled up meanwhile", async () => {
		const { createUser } = await import("../../db/test/helpers");
		const { registerForEvent } = await import("@repo/db/queries/event-registrations");
		const eventId = await createEvent({ maxSeats: 1 });
		const token = await guestToken(eventId);
		await registerForEvent(eventId, await createUser(), "pl");

		const response = await confirm(token);
		expect(await response.json()).toMatchObject({ state: "waitlisted" });
	});

	it("removes a stranger's password from an unverified account first", async () => {
		const { createUser, credentialHash } = await import("../../db/test/helpers");
		const { authAccounts, authUsers } = await import("@repo/db/schema/better-auth");
		const squatter = await createUser("owner@x.test");
		await db.update(authUsers).set({ emailVerified: false }).where(eq(authUsers.id, squatter));
		await db.insert(authAccounts).values({
			id: crypto.randomUUID(),
			accountId: squatter,
			providerId: "credential",
			userId: squatter,
			password: "hash",
		});
		const eventId = await createEvent();

		const response = await confirm(await guestToken(eventId, "owner@x.test"));
		expect(response.status).toBe(200);
		expect(await credentialHash(squatter)).toBe("");
		expect((await registrationOf(eventId, "owner@x.test"))?.state).toBe("registered");
	});
});
