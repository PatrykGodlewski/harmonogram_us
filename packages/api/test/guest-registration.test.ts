import { db } from "@repo/db/client";
import { events } from "@repo/db/schema/events";
import { env } from "@repo/env";
import { QUEUE_EMAILS } from "@repo/jobs/queues";
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createEvent, resetDb } from "../../db/test/helpers";
import { requestGuestRegistration } from "../src/registrations/guest-registration";

beforeEach(async () => {
	await resetDb();
	await db.execute(sql`DELETE FROM pgboss.job WHERE name = ${QUEUE_EMAILS}`);
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
