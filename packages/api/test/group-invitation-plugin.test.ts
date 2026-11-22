import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@repo/db/client";
import { createGroup } from "@repo/db/queries/groups";
import {
	authAccounts,
	authSessions,
	authUsers,
	authVerifications,
} from "@repo/db/schema/better-auth";
import { registrationGroupMembers } from "@repo/db/schema/groups";
import { env } from "@repo/env";
import {
	createEvent,
	createUser,
	hoursFromNow,
	invitationToken,
	resetDb,
} from "../../db/test/helpers";
import { auth } from "../src/auth/better-auth";

beforeEach(resetDb);

async function invite(email = "kid@x.test") {
	const eventId = await createEvent({ date: hoursFromNow(24 * 10) });
	const owner = await createUser();
	const created = await createGroup({
		eventId,
		ownerUserId: owner,
		places: 2,
		itemIds: [],
		emails: [email],
		joinLinkEnabled: false,
	});
	const memberId = created.invited[0]?.memberId ?? "";
	return { eventId, token: await invitationToken(memberId), memberId };
}

function accept(token: string) {
	return auth.handler(
		new Request(`${env.BETTER_AUTH_URL}/api/auth/group-invitation/accept`, {
			method: "POST",
			headers: { "content-type": "application/json", origin: env.BETTER_AUTH_URL },
			body: JSON.stringify({ token }),
		}),
	);
}

describe("POST /group-invitation/accept", () => {
	it("valid token → 200, session cookie, member confirmed, new verified user", async () => {
		const { token, eventId, memberId } = await invite();
		const response = await accept(token);
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ eventId, redirectTo: `/events/${eventId}?joined=1` });
		expect(response.headers.get("set-cookie")).toMatch(/session_token=/);
		const [member] = await db.select().from(registrationGroupMembers).where(eq(registrationGroupMembers.id, memberId));
		expect(member?.status).toBe("confirmed");
		const [user] = await db.select().from(authUsers).where(eq(authUsers.email, "kid@x.test"));
		expect(user?.emailVerified).toBe(true);
	});

	it("reused token → 400 INVITATION_INVALID", async () => {
		const { token } = await invite();
		await accept(token);
		const second = await accept(token);
		expect(second.status).toBe(400);
		expect(await second.json()).toMatchObject({ code: "INVITATION_INVALID" });
	});

	it("unverified password account gets reset before session", async () => {
		const { token } = await invite("victim@x.test");
		const squatter = await createUser("victim@x.test");
		await db.update(authUsers).set({ emailVerified: false }).where(eq(authUsers.id, squatter));
		await db.insert(authAccounts).values({ id: crypto.randomUUID(), accountId: squatter, providerId: "credential", userId: squatter, password: "hash" });
		const oldSession = crypto.randomUUID();
		await db.insert(authSessions).values({ id: oldSession, token: crypto.randomUUID(), userId: squatter, expiresAt: hoursFromNow(24) });

		const response = await accept(token);
		expect(response.status).toBe(200);
		expect(await db.select().from(authAccounts).where(eq(authAccounts.userId, squatter))).toHaveLength(0);
		expect(await db.select().from(authSessions).where(eq(authSessions.id, oldSession))).toHaveLength(0);
		const [user] = await db.select().from(authUsers).where(eq(authUsers.id, squatter));
		expect(user?.emailVerified).toBe(true);
	});
});

describe("POST /group-invitation/accept concurrency", () => {
	it("double confirm for a brand-new email → one 200, one 400 (never 500)", async () => {
		const { token } = await invite("fresh@x.test");
		const [first, second] = await Promise.all([accept(token), accept(token)]);
		expect([first.status, second.status].sort()).toEqual([200, 400]);
		const users = await db.select().from(authUsers).where(eq(authUsers.email, "fresh@x.test"));
		expect(users).toHaveLength(1);
	});
});

describe("magic-link verify", () => {
	it("resets an unverified account's password and sessions before signing in", async () => {
		const squatter = await createUser("owner@x.test");
		await db.update(authUsers).set({ emailVerified: false }).where(eq(authUsers.id, squatter));
		await db.insert(authAccounts).values({ id: crypto.randomUUID(), accountId: squatter, providerId: "credential", userId: squatter, password: "hash" });
		await db.insert(authVerifications).values({
			id: crypto.randomUUID(),
			// Better Auth 1.7 magic-link record (storeToken: "hashed").
			identifier: `magic-link:${createHash("sha256").update("magic-token").digest("base64url")}`,
			value: JSON.stringify({ type: "magic-link", email: "owner@x.test" }),
			expiresAt: hoursFromNow(1),
		});

		const [before] = await db.select({ calendarToken: authUsers.calendarToken }).from(authUsers).where(eq(authUsers.id, squatter));

		const response = await auth.handler(
			new Request(`${env.BETTER_AUTH_URL}/api/auth/magic-link/verify?token=magic-token&callbackURL=/`),
		);
		expect([200, 302]).toContain(response.status);
		expect(await db.select().from(authAccounts).where(eq(authAccounts.userId, squatter))).toHaveLength(0);
		const [user] = await db.select().from(authUsers).where(eq(authUsers.id, squatter));
		expect(user?.emailVerified).toBe(true);
		// Our reset (not only Better Auth's) ran: the stranger's calendar feed link is dead.
		expect(user?.calendarToken).not.toBe(before?.calendarToken);
	});
});

