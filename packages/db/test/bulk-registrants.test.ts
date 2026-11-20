import { beforeEach, describe, expect, it } from "vitest";
import { setCheckedInMany } from "../src/queries/check-in";
import {
	getEventRegistrants,
	registerForEvent,
	removeRegistrants,
} from "../src/queries/event-registrations";
import { messageRegistrants } from "../src/queries/event-message";
import { collectChanges, createEvent, createUser, resetDb, stateOf } from "./helpers";

beforeEach(resetDb);

async function eventWith(maxSeats: number, people: number) {
	const eventId = await createEvent({ maxSeats });
	const users: string[] = [];
	for (let n = 0; n < people; n++) {
		const userId = await createUser();
		users.push(userId);
		await registerForEvent(eventId, userId, "pl");
	}
	const registrants = await getEventRegistrants(eventId);
	return { eventId, users, ids: registrants.map((r) => r.registrationId) };
}

describe("bulk actions on registrants", () => {
	it("checks in several registered people at once and skips the waitlist", async () => {
		const { eventId, ids } = await eventWith(2, 3);
		const result = await setCheckedInMany(eventId, ids, true);
		expect(result.updated).toBe(2);
		const present = (await getEventRegistrants(eventId)).filter((r) => r.checkedInAt);
		expect(present).toHaveLength(2);
	});

	it("removes the selected people, promotes the waitlist once, and ignores ids that are gone", async () => {
		const { eventId, users, ids } = await eventWith(2, 3);
		const { changes, hooks } = collectChanges();
		const result = await removeRegistrants(
			eventId,
			[ids[0] ?? "", ids[1] ?? "", "already-gone"],
			hooks,
		);
		expect(result.removed).toBe(2);
		expect(await stateOf(eventId, users[2] ?? "")).toBe("registered");
		expect(changes.map((c) => c.change)).toEqual(["promoted"]);
	});

	it("messages exactly the selected people", async () => {
		const { eventId, ids } = await eventWith(5, 3);
		const reached: string[] = [];
		const result = await messageRegistrants(
			eventId,
			{ registrationIds: [ids[0] ?? "", ids[2] ?? ""] },
			async (_tx, chosen) => {
				reached.push(...chosen);
			},
		);
		expect(result.recipients).toBe(2);
		expect(reached.sort()).toEqual([ids[0], ids[2]].sort());
	});
});
