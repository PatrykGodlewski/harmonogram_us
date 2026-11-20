import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/client";
import { getCertificate } from "../src/queries/certificates";
import { registerForEvent } from "../src/queries/event-registrations";
import { listMyRegistrations } from "../src/queries/my-registrations";
import { eventRegistrations } from "../src/schema/event-registrations";
import { events } from "../src/schema/events";
import { createEvent, createUser, resetDb } from "./helpers";

beforeEach(resetDb);

/** An event the user registered for, then (optionally) attended; the event is moved into the past. */
async function attended(opts: { present: boolean; enabled?: boolean; ended?: boolean }) {
	const eventId = await createEvent();
	const userId = await createUser();
	await registerForEvent(eventId, userId, "pl");
	if (opts.present) {
		await db
			.update(eventRegistrations)
			.set({ checkedInAt: new Date() })
			.where(eq(eventRegistrations.userId, userId));
	}
	await db
		.update(events)
		.set({
			certificatesEnabled: opts.enabled ?? true,
			...(opts.ended === false
				? {}
				: { date: new Date(Date.now() - 3 * 86_400_000), endsAt: new Date(Date.now() - 2 * 86_400_000) }),
		})
		.where(eq(events.id, eventId));
	const [row] = await db
		.select({ id: eventRegistrations.id })
		.from(eventRegistrations)
		.where(eq(eventRegistrations.userId, userId));
	return { eventId, userId, registrationId: row?.id ?? "" };
}

describe("certificates", () => {
	it("an attendee of an ended event with certificates gets one, with name and event", async () => {
		const { userId, registrationId } = await attended({ present: true });
		const certificate = await getCertificate(registrationId, userId);
		expect(certificate).toMatchObject({ name: "Test User", eventTitle: "Test event", locale: "pl" });
		const [item] = await listMyRegistrations(userId);
		expect(item?.certificateAvailable).toBe(true);
	});

	it("nobody else, no absentee, not before the end, not when switched off", async () => {
		const present = await attended({ present: true });
		expect(await getCertificate(present.registrationId, await createUser())).toBeNull();
		const absent = await attended({ present: false });
		expect(await getCertificate(absent.registrationId, absent.userId)).toBeNull();
		expect((await listMyRegistrations(absent.userId))[0]?.certificateAvailable).toBe(false);
		const upcoming = await attended({ present: true, ended: false });
		expect(await getCertificate(upcoming.registrationId, upcoming.userId)).toBeNull();
		const off = await attended({ present: true, enabled: false });
		expect(await getCertificate(off.registrationId, off.userId)).toBeNull();
	});
});
