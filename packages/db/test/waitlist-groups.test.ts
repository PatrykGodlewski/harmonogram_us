import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/client";
import {
	type RegistrationChange,
	registerForAgendaItem,
	registerForEvent,
} from "../src/queries/event-registrations";
import { acceptInvitation, removeMember } from "../src/queries/group-members";
import { closeGroup, createGroup } from "../src/queries/groups";
import { eventRegistrations } from "../src/schema/event-registrations";
import {
	createEvent,
	createItem,
	createUser,
	hoursFromNow,
	invitationToken,
	readEventCount,
	resetDb,
} from "./helpers";

beforeEach(resetDb);

async function stateOf(eventId: string, userId: string) {
	const [row] = await db
		.select({ state: eventRegistrations.state })
		.from(eventRegistrations)
		.where(sql`${eventRegistrations.eventId} = ${eventId} AND ${eventRegistrations.userId} = ${userId}`);
	return row?.state ?? null;
}

function collect() {
	const changes: RegistrationChange[] = [];
	return { changes, hooks: { onChanged: async (_tx: unknown, c: RegistrationChange[]) => void changes.push(...c) } };
}

/** Event of 3 places: a group holds 1 place for `student`, who already registered on their own; X fills the last place; W waits. */
async function fullEventWithInvitedRegistrant() {
	const eventId = await createEvent({ maxSeats: 3, date: hoursFromNow(24 * 10) });
	const owner = await createUser();
	const student = await createUser("student@x.test");
	await registerForEvent(eventId, student, "pl");
	const { groupId, invited } = await createGroup({
		eventId,
		ownerUserId: owner,
		places: 1,
		itemIds: [],
		emails: ["student@x.test"],
		joinLinkEnabled: false,
	});
	const x = await createUser();
	const w = await createUser();
	await registerForEvent(eventId, x, "pl");
	expect((await registerForEvent(eventId, w, "pl")).state).toBe("waitlisted");
	return { eventId, owner, student, groupId, memberId: invited[0]?.memberId ?? "", w };
}

describe("group paths that free places promote the waitlist", () => {
	it("an already registered student accepting an invitation frees the group's place for the waitlist", async () => {
		const { eventId, student, memberId, w } = await fullEventWithInvitedRegistrant();
		await acceptInvitation(await invitationToken(memberId), student);
		expect(await stateOf(eventId, w)).toBe("registered");
		expect((await readEventCount(eventId))?.seatsRemaining).toBe(0);
	});

	it("removing a confirmed member of a closed group promotes the waitlist", async () => {
		const eventId = await createEvent({ maxSeats: 2, date: hoursFromNow(24 * 10) });
		const owner = await createUser();
		const student = await createUser("kid@x.test");
		const { groupId, invited } = await createGroup({
			eventId,
			ownerUserId: owner,
			places: 1,
			itemIds: [],
			emails: ["kid@x.test"],
			joinLinkEnabled: false,
		});
		const memberId = invited[0]?.memberId ?? "";
		await acceptInvitation(await invitationToken(memberId), student);
		await closeGroup(groupId, owner);
		await registerForEvent(eventId, await createUser(), "pl");
		const w = await createUser();
		expect((await registerForEvent(eventId, w, "pl")).state).toBe("waitlisted");
		await removeMember(memberId, owner);
		expect(await stateOf(eventId, w)).toBe("registered");
	});
});

describe("registration confirmations from every path", () => {
	it("registering for an agenda item confirms the event registration it creates", async () => {
		const eventId = await createEvent({ maxSeats: 5 });
		const itemId = await createItem(eventId, { maxSeats: 5 });
		const { changes, hooks } = collect();
		await registerForAgendaItem(itemId, await createUser(), "en", hooks);
		expect(changes.map((c) => c.change)).toEqual(["confirmed"]);
	});

	it("accepting a group invitation confirms the registration", async () => {
		const eventId = await createEvent({ maxSeats: 5, date: hoursFromNow(24 * 10) });
		const owner = await createUser();
		const student = await createUser("kid2@x.test");
		const { invited } = await createGroup({
			eventId,
			ownerUserId: owner,
			places: 1,
			itemIds: [],
			emails: ["kid2@x.test"],
			joinLinkEnabled: false,
		});
		const { changes, hooks } = collect();
		await acceptInvitation(await invitationToken(invited[0]?.memberId ?? ""), student, hooks);
		expect(changes.map((c) => c.change)).toEqual(["confirmed"]);
	});
});

describe("closeExpiredGroups", () => {
	it("one event's failure does not stop the other events, and the run still reports it", async () => {
		const { events } = await import("../src/schema/events");
		const { registrationGroups } = await import("../src/schema/groups");
		const { closeExpiredGroups } = await import("../src/queries/groups");
		const { eq } = await import("drizzle-orm");
		async function eventWithGroup(maxSeats: number) {
			const eventId = await createEvent({ maxSeats, date: hoursFromNow(24 * 10) });
			const owner = await createUser();
			const { groupId } = await createGroup({
				eventId,
				ownerUserId: owner,
				places: 1,
				itemIds: [],
				emails: [],
				joinLinkEnabled: false,
			});
			return { eventId, groupId };
		}
		// Events are processed in id order; the first one is full with someone waiting, so
		// closing its group promotes and the hook fails.
		const [failing, other] = [await eventWithGroup(1), await eventWithGroup(1)].sort((x, y) =>
			x.eventId.localeCompare(y.eventId),
		) as [{ eventId: string; groupId: string }, { eventId: string; groupId: string }];
		await registerForEvent(failing.eventId, await createUser(), "pl");
		for (const { eventId } of [failing, other]) {
			await db.update(events).set({ groupDeadlineHours: 24 * 11 }).where(eq(events.id, eventId));
		}
		const hooks = {
			onChanged: async () => {
				throw new Error("mail queue down");
			},
		};
		await expect(closeExpiredGroups(new Date(), hooks)).rejects.toThrow("mail queue down");
		const status = async (groupId: string) =>
			(await db.select().from(registrationGroups).where(eq(registrationGroups.id, groupId)))[0]?.status;
		expect(await status(other.groupId)).toBe("closed");
		expect(await status(failing.groupId)).toBe("open");
	});
});
