import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/client";
import { eventRegistrations } from "../src/schema/event-registrations";
import { events } from "../src/schema/events";
import { registrationGroupMembers, registrationGroups } from "../src/schema/groups";
import {
	addMemberRow,
	createEvent,
	createGroupRow,
	createItem,
	createUser,
	expectConstraintViolation,
	hoursFromNow,
	readEventCount,
	readItemCount,
	resetDb,
} from "./helpers";

beforeEach(resetDb);

async function setup() {
	const eventId = await createEvent({ maxSeats: 30 });
	const i1 = await createItem(eventId, { maxSeats: 20, title: "i1" });
	const i2 = await createItem(eventId, { maxSeats: 20, title: "i2" });
	const owner = await createUser();
	return { eventId, i1, i2, owner };
}

describe("group holds in seat counts", () => {
	it("open group holds places on event and default items", async () => {
		const { eventId, i1, i2, owner } = await setup();
		await createGroupRow(eventId, owner, { places: 5, itemIds: [i1] });
		expect((await readEventCount(eventId))?.seatsRemaining).toBe(25);
		expect((await readItemCount(i1))?.seatsRemaining).toBe(15);
		expect((await readItemCount(i2))?.seatsRemaining).toBe(20);
	});

	it("pending member with split item moves hold", async () => {
		const { eventId, i1, i2, owner } = await setup();
		const groupId = await createGroupRow(eventId, owner, { places: 2, itemIds: [i1] });
		await addMemberRow(groupId, "a@x.test", { itemIds: [i2] });
		expect((await readItemCount(i1))?.seatsRemaining).toBe(19);
		expect((await readItemCount(i2))?.seatsRemaining).toBe(19);
		expect((await readEventCount(eventId))?.seatsRemaining).toBe(28);
	});

	it("confirming converts hold to registration without changing counts", async () => {
		const { eventId, owner } = await setup();
		const groupId = await createGroupRow(eventId, owner, { places: 2 });
		const student = await createUser();
		const registrationId = crypto.randomUUID();
		await db.transaction(async (tx) => {
			await tx
				.insert(eventRegistrations)
				.values({ id: registrationId, eventId, userId: student, groupId });
			await tx.insert(registrationGroupMembers).values({
				groupId,
				email: "s@x.test",
				status: "confirmed",
				invitedVia: "email",
				userId: student,
				eventRegistrationId: registrationId,
			});
		});
		expect((await readEventCount(eventId))?.seatsRemaining).toBe(28);
	});

	it("closing group releases unclaimed holds", async () => {
		const { eventId, owner } = await setup();
		const groupId = await createGroupRow(eventId, owner, { places: 5 });
		const student = await createUser();
		const registrationId = crypto.randomUUID();
		await db.transaction(async (tx) => {
			await tx
				.insert(eventRegistrations)
				.values({ id: registrationId, eventId, userId: student, groupId });
			await tx.insert(registrationGroupMembers).values({
				groupId,
				email: "s@x.test",
				status: "confirmed",
				invitedVia: "email",
				userId: student,
				eventRegistrationId: registrationId,
			});
		});
		await db
			.update(registrationGroups)
			.set({ status: "closed" })
			.where(eq(registrationGroups.id, groupId));
		expect((await readEventCount(eventId))?.seatsRemaining).toBe(29);
	});

	it("group bigger than free seats is rejected", async () => {
		const eventId = await createEvent({ maxSeats: 3 });
		for (let i = 0; i < 2; i++) {
			await db
				.insert(eventRegistrations)
				.values({ id: crypto.randomUUID(), eventId, userId: await createUser() });
		}
		await expectConstraintViolation(
			createGroupRow(eventId, await createUser(), { places: 2 }),
			"event_seat_counts_seats_remaining_nonnegative",
		);
	});

	it("deleting the confirmed registration deletes the member and returns the place to the group", async () => {
		const { eventId, owner } = await setup();
		const groupId = await createGroupRow(eventId, owner, { places: 2 });
		const student = await createUser();
		const registrationId = crypto.randomUUID();
		await db
			.insert(eventRegistrations)
			.values({ id: registrationId, eventId, userId: student, groupId });
		await addMemberRow(groupId, "s@x.test", {
			status: "confirmed",
			userId: student,
			eventRegistrationId: registrationId,
		});
		await db.delete(eventRegistrations).where(eq(eventRegistrations.id, registrationId));
		const members = await db
			.select()
			.from(registrationGroupMembers)
			.where(eq(registrationGroupMembers.groupId, groupId));
		expect(members).toHaveLength(0);
		expect((await readEventCount(eventId))?.seatsRemaining).toBe(28);
	});

	it("group_deadline uses group_deadline_hours", async () => {
		const date = hoursFromNow(100);
		const eventId = await createEvent({ date });
		await db.update(events).set({ groupDeadlineHours: 48 }).where(eq(events.id, eventId));
		const [row] = await db.execute<{ deadline: string }>(
			sql`SELECT group_deadline(${eventId})::text AS deadline`,
		);
		expect(new Date(row?.deadline ?? "").getTime()).toBe(
			date.getTime() - 48 * 3_600_000,
		);
	});
});
