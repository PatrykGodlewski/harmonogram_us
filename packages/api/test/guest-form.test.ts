import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@repo/db/client";
import { createEventQuestion } from "@repo/db/queries/event-questions";
import { events } from "@repo/db/schema/events";
import { createEvent, hoursFromNow, resetDb } from "../../db/test/helpers";
import { loadGuestForm } from "../src/events/guest-form-load";

beforeEach(resetDb);

const code = (promise: Promise<unknown>) =>
	promise.then(
		() => "RESOLVED",
		(error: unknown) => (error instanceof Error ? error.message : String(error)),
	);

describe("loadGuestForm", () => {
	it("gives the title and registration questions of an open event, signed-in-only too", async () => {
		const eventId = await createEvent();
		await db.update(events).set({ title: "Festiwal", visibility: "authenticated" }).where(eq(events.id, eventId));
		await createEventQuestion({ eventId, label: "Kierunek", kind: "text", required: true });
		const form = await loadGuestForm(eventId, undefined);
		expect(form).toMatchObject({ eventId, title: "Festiwal" });
		expect(form.questions.map((question) => question.label)).toEqual(["Kierunek"]);
	});

	it("is not found for drafts, cancelled and ended events, and invite-only ones without the link", async () => {
		const draft = await createEvent();
		await db.update(events).set({ status: "draft" }).where(eq(events.id, draft));
		const cancelled = await createEvent();
		await db.update(events).set({ status: "cancelled" }).where(eq(events.id, cancelled));
		const ended = await createEvent({ date: hoursFromNow(-48), endsAt: hoursFromNow(-24) });
		const inviteOnly = await createEvent();
		await db.update(events).set({ visibility: "private", inviteToken: "secret" }).where(eq(events.id, inviteOnly));

		for (const eventId of [draft, cancelled, ended, inviteOnly]) {
			expect(await code(loadGuestForm(eventId, undefined))).toBe("EVENT_NOT_FOUND");
		}
		expect(await code(loadGuestForm(inviteOnly, "secret"))).toBe("RESOLVED");
		expect(await code(loadGuestForm("missing", undefined))).toBe("EVENT_NOT_FOUND");
	});
});
