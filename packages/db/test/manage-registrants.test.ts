import { beforeEach, describe, expect, it } from "vitest";
import {
	addRegistrantByEmail,
	registerForEvent,
	removeRegistrant,
} from "../src/queries/event-registrations";
import {
	collectChanges,
	createEvent,
	createUser,
	rejectionCode,
	resetDb,
	stateOf,
} from "./helpers";

beforeEach(resetDb);

describe("organizer manages registrants", () => {
	it("adds a person by e-mail; a full event puts them on the waitlist", async () => {
		const eventId = await createEvent({ maxSeats: 1 });
		const first = await createUser("first@x.test");
		const second = await createUser("second@x.test");
		const { changes, hooks } = collectChanges();

		const added = await addRegistrantByEmail(eventId, " First@X.test ", "pl", hooks);
		expect(added.state).toBe("registered");
		const waiting = await addRegistrantByEmail(eventId, "second@x.test", "pl", hooks);
		expect(waiting.state).toBe("waitlisted");

		expect(await stateOf(eventId, first)).toBe("registered");
		expect(await stateOf(eventId, second)).toBe("waitlisted");
		expect(changes.map((c) => c.change)).toEqual(["confirmed", "waitlisted"]);
		expect(
			await rejectionCode(addRegistrantByEmail(eventId, "nobody@x.test", "pl")),
		).toBe("USER_NOT_FOUND");
		expect(
			await rejectionCode(addRegistrantByEmail(eventId, "first@x.test", "pl")),
		).toBe("ALREADY_REGISTERED");
	});

	it("removing a registered person promotes the first on the waitlist", async () => {
		const eventId = await createEvent({ maxSeats: 1 });
		const holder = await createUser();
		const waiting = await createUser();
		await registerForEvent(eventId, holder, "pl");
		await registerForEvent(eventId, waiting, "pl");
		const holderReg = await addRegistrantIdOf(eventId, holder);
		const { changes, hooks } = collectChanges();

		await removeRegistrant(eventId, holderReg, hooks);

		expect(await stateOf(eventId, holder)).toBeNull();
		expect(await stateOf(eventId, waiting)).toBe("registered");
		expect(changes.map((c) => c.change)).toEqual(["promoted"]);
	});

	it("a registration of another event is 'not registered'", async () => {
		const eventId = await createEvent();
		const other = await createEvent();
		const userId = await createUser();
		await registerForEvent(other, userId, "pl");
		const registrationId = await addRegistrantIdOf(other, userId);
		expect(await rejectionCode(removeRegistrant(eventId, registrationId))).toBe(
			"NOT_REGISTERED",
		);
	});
});

async function addRegistrantIdOf(eventId: string, userId: string) {
	const { db } = await import("../src/client");
	const { eventRegistrations } = await import("../src/schema/event-registrations");
	const { and, eq } = await import("drizzle-orm");
	const [row] = await db
		.select({ id: eventRegistrations.id })
		.from(eventRegistrations)
		.where(and(eq(eventRegistrations.eventId, eventId), eq(eventRegistrations.userId, userId)));
	return row?.id ?? "";
}
