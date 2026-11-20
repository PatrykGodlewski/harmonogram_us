import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/client";
import { registerForEvent } from "../src/queries/event-registrations";
import { cancelEvent, updateEvent } from "../src/queries/events";
import { registrationGroups } from "../src/schema/groups";
import { events } from "../src/schema/events";
import {
	collectChanges,
	createEvent,
	createGroupRow,
	createUser,
	hoursFromNow,
	rejectionCode,
	resetDb,
	stateOf,
} from "./helpers";

beforeEach(resetDb);

describe("cancelEvent", () => {
	it("reports every registered and waitlisted person, keeps them, closes registration", async () => {
		const eventId = await createEvent({ maxSeats: 1 });
		const x = await createUser();
		const y = await createUser();
		await registerForEvent(eventId, x, "pl");
		await registerForEvent(eventId, y, "pl");
		const { changes, hooks } = collectChanges();

		await cancelEvent(eventId, hooks);

		expect(changes.map((c) => c.change)).toEqual(["cancelled", "cancelled"]);
		expect(await stateOf(eventId, x)).toBe("registered");
		expect(await stateOf(eventId, y)).toBe("waitlisted");
		const [row] = await db
			.select({ status: events.status, cancelledAt: events.cancelledAt })
			.from(events)
			.where(eq(events.id, eventId));
		expect(row?.status).toBe("cancelled");
		expect(row?.cancelledAt).toBeInstanceOf(Date);
		const z = await createUser();
		expect(await rejectionCode(registerForEvent(eventId, z, "pl"))).toBe(
			"EVENT_CANCELLED",
		);
	});

	it("closes the event's open groups", async () => {
		const eventId = await createEvent({ maxSeats: 10, date: hoursFromNow(240) });
		const owner = await createUser();
		const groupId = await createGroupRow(eventId, owner, { places: 3 });
		await cancelEvent(eventId);
		const [group] = await db
			.select({ status: registrationGroups.status })
			.from(registrationGroups)
			.where(eq(registrationGroups.id, groupId));
		expect(group?.status).toBe("closed");
	});

	it("refuses drafts, a second cancel and events that ended", async () => {
		const draft = await createEvent();
		await db.update(events).set({ status: "draft" }).where(eq(events.id, draft));
		expect(await rejectionCode(cancelEvent(draft))).toBe("EVENT_NOT_FOUND");

		const once = await createEvent();
		await cancelEvent(once);
		expect(await rejectionCode(cancelEvent(once))).toBe(
			"EVENT_ALREADY_CANCELLED",
		);

		const ended = await createEvent({ date: hoursFromNow(-48) });
		expect(await rejectionCode(cancelEvent(ended))).toBe("EVENT_ENDED");
	});

	it("a registration racing the cancellation is either reported or refused", async () => {
		for (let round = 0; round < 5; round++) {
			const eventId = await createEvent({ maxSeats: 5 });
			const userId = await createUser();
			const { changes, hooks } = collectChanges();
			const [registered] = await Promise.all([
				rejectionCode(registerForEvent(eventId, userId, "pl")),
				cancelEvent(eventId, hooks),
			]);
			if (registered === "EVENT_CANCELLED") {
				expect(changes).toHaveLength(0);
			} else {
				expect(changes).toHaveLength(1);
			}
		}
	});

	it("a cancelled event can't be edited and promotes nobody", async () => {
		const eventId = await createEvent({ maxSeats: 1 });
		await registerForEvent(eventId, await createUser(), "pl");
		const waiting = await createUser();
		await registerForEvent(eventId, waiting, "pl");
		await cancelEvent(eventId);
		const { changes, hooks } = collectChanges();
		expect(
			await rejectionCode(updateEvent({ id: eventId, maxSeats: 5 }, hooks)),
		).toBe("EVENT_CANCELLED");
		expect(changes).toHaveLength(0);
		expect(await stateOf(eventId, waiting)).toBe("waitlisted");
	});
});
