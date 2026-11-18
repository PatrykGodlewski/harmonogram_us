import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/client";
import { registerForEvent } from "../src/queries/event-registrations";
import {
	closeExpiredGroups,
	closeGroup,
	createGroup,
	getGroupDetails,
	inviteToGroup,
	joinGroup,
	listGroupsForEvent,
	listMyGroups,
	updateGroup,
} from "../src/queries/groups";
import { hashToken } from "../src/queries/group-tokens";
import { authUsers } from "../src/schema/better-auth";
import { events } from "../src/schema/events";
import {
	registrationGroupMemberItems,
	registrationGroupMembers,
	registrationGroups,
} from "../src/schema/groups";
import {
	createEvent,
	createItem,
	createUser,
	hoursFromNow,
	readEventCount,
	readItemCount,
	rejectionCode,
	resetDb,
} from "./helpers";

beforeEach(resetDb);

async function setup(maxSeats = 30) {
	const eventId = await createEvent({ maxSeats, date: hoursFromNow(24 * 10) });
	const web = await createItem(eventId, { maxSeats: 20, title: "web" });
	const robotics = await createItem(eventId, { maxSeats: 20, title: "robotics" });
	const owner = await createUser(`teacher-${crypto.randomUUID()}@x.test`);
	return { eventId, web, robotics, owner };
}

describe("createGroup", () => {
	it("create holds places and returns tokens for each email", async () => {
		const { eventId, web, owner } = await setup();
		const result = await createGroup({
			eventId,
			ownerUserId: owner,
			places: 5,
			itemIds: [web],
			name: "3B",
			emails: ["A@x.test", "b@x.test", "a@x.test "],
			joinLinkEnabled: true,
		});
		expect(result.invited.map((m) => m.email).sort()).toEqual(["a@x.test", "b@x.test"]);
		expect(result.joinCode).toMatch(/^[A-Za-z0-9_-]{22}$/);
		const [member] = await db
			.select()
			.from(registrationGroupMembers)
			.where(eq(registrationGroupMembers.id, result.invited[0]?.memberId ?? ""));
		expect(member?.tokenHash).toBe(hashToken(result.invited[0]?.token ?? ""));
		expect((await readEventCount(eventId))?.seatsRemaining).toBe(25);
		expect((await readItemCount(web))?.seatsRemaining).toBe(15);
	});

	it("create rejects unverified owner", async () => {
		const { eventId, owner } = await setup();
		await db.update(authUsers).set({ emailVerified: false }).where(eq(authUsers.id, owner));
		expect(
			await rejectionCode(
				createGroup({ eventId, ownerUserId: owner, places: 2, itemIds: [], emails: [], joinLinkEnabled: false }),
			),
		).toBe("EMAIL_NOT_VERIFIED");
	});

	it("create after deadline → GROUP_DEADLINE_PASSED", async () => {
		const owner = await createUser();
		const eventId = await createEvent({ date: hoursFromNow(10) });
		expect(
			await rejectionCode(
				createGroup({ eventId, ownerUserId: owner, places: 2, itemIds: [], emails: [], joinLinkEnabled: false }),
			),
		).toBe("GROUP_DEADLINE_PASSED");
	});

	it("more emails than places → GROUP_FULL", async () => {
		const { eventId, owner } = await setup();
		expect(
			await rejectionCode(
				createGroup({
					eventId,
					ownerUserId: owner,
					places: 1,
					itemIds: [],
					emails: ["a@x.test", "b@x.test"],
					joinLinkEnabled: false,
				}),
			),
		).toBe("GROUP_FULL");
	});

	it("more places than free seats → GROUP_PLACES_UNAVAILABLE", async () => {
		const { eventId, owner } = await setup(2);
		expect(
			await rejectionCode(
				createGroup({ eventId, ownerUserId: owner, places: 3, itemIds: [], emails: [], joinLinkEnabled: false }),
			),
		).toBe("GROUP_PLACES_UNAVAILABLE");
	});

	it("concurrent group vs individual", async () => {
		const { eventId, owner } = await setup(3);
		await registerForEvent(eventId, await createUser());
		await registerForEvent(eventId, await createUser());
		const results = await Promise.allSettled([
			createGroup({ eventId, ownerUserId: owner, places: 1, itemIds: [], emails: [], joinLinkEnabled: false }),
			registerForEvent(eventId, await createUser()),
		]);
		expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
		expect((await readEventCount(eventId))?.seatsRemaining).toBe(0);
	});
});

describe("joining and inviting", () => {
	async function groupWithLink(places = 2) {
		const ctx = await setup();
		const created = await createGroup({
			eventId: ctx.eventId,
			ownerUserId: ctx.owner,
			places,
			itemIds: [ctx.web],
			emails: [],
			joinLinkEnabled: true,
		});
		return { ...ctx, ...created, joinCode: created.joinCode ?? "" };
	}

	it("join via code creates link member and returns token", async () => {
		const { joinCode, groupId, web } = await groupWithLink();
		const ref = await joinGroup(joinCode, "Kid@x.test");
		expect(ref.email).toBe("kid@x.test");
		const [member] = await db
			.select()
			.from(registrationGroupMembers)
			.where(eq(registrationGroupMembers.id, ref.memberId));
		expect(member).toMatchObject({ groupId, invitedVia: "link", status: "invited" });
		const items = await db
			.select()
			.from(registrationGroupMemberItems)
			.where(eq(registrationGroupMemberItems.memberId, ref.memberId));
		expect(items.map((i) => i.agendaItemId)).toEqual([web]);
	});

	it("join with existing email reissues token, no new member", async () => {
		const { joinCode, groupId } = await groupWithLink();
		const first = await joinGroup(joinCode, "kid@x.test");
		const second = await joinGroup(joinCode, "kid@x.test");
		expect(second.memberId).toBe(first.memberId);
		expect(second.token).not.toBe(first.token);
		const members = await db
			.select()
			.from(registrationGroupMembers)
			.where(eq(registrationGroupMembers.groupId, groupId));
		expect(members).toHaveLength(1);
	});

	it("join beyond places → GROUP_FULL", async () => {
		const { joinCode } = await groupWithLink(1);
		await joinGroup(joinCode, "a@x.test");
		expect(await rejectionCode(joinGroup(joinCode, "b@x.test"))).toBe("GROUP_FULL");
	});

	it("join after deadline", async () => {
		const { joinCode, eventId, groupId } = await groupWithLink();
		await db.update(events).set({ groupDeadlineHours: 24 * 11 }).where(eq(events.id, eventId));
		expect(await rejectionCode(joinGroup(joinCode, "a@x.test"))).toBe("GROUP_DEADLINE_PASSED");
		const members = await db
			.select()
			.from(registrationGroupMembers)
			.where(eq(registrationGroupMembers.groupId, groupId));
		expect(members).toHaveLength(0);
	});

	it("join on closed group", async () => {
		const { joinCode, groupId, owner } = await groupWithLink();
		await closeGroup(groupId, owner);
		expect(await rejectionCode(joinGroup(joinCode, "a@x.test"))).toBe("GROUP_CLOSED");
	});

	it("unknown join code → GROUP_NOT_FOUND", async () => {
		expect(await rejectionCode(joinGroup("nope", "a@x.test"))).toBe("GROUP_NOT_FOUND");
	});

	it("inviteToGroup adds members up to places", async () => {
		const { groupId, owner } = await groupWithLink(2);
		const refs = await inviteToGroup(groupId, owner, ["a@x.test"]);
		expect(refs).toHaveLength(1);
		expect(await rejectionCode(inviteToGroup(groupId, owner, ["b@x.test", "c@x.test"]))).toBe(
			"GROUP_FULL",
		);
	});
});

describe("updating and closing", () => {
	async function group(places = 3) {
		const ctx = await setup();
		const created = await createGroup({
			eventId: ctx.eventId,
			ownerUserId: ctx.owner,
			places,
			itemIds: [ctx.web],
			emails: ["a@x.test", "b@x.test"],
			joinLinkEnabled: false,
		});
		return { ...ctx, ...created };
	}

	it("places cannot drop below members", async () => {
		const { groupId, owner } = await group(3);
		expect(await rejectionCode(updateGroup(groupId, owner, { places: 1 }))).toBe("GROUP_FULL");
		await expect(updateGroup(groupId, owner, { places: 2 })).resolves.toMatchObject({ places: 2 });
	});

	it("updating items adds new item to members who had old defaults", async () => {
		const { groupId, owner, web, robotics } = await group();
		const details = await updateGroup(groupId, owner, { itemIds: [web, robotics] });
		expect(details.itemIds.sort()).toEqual([web, robotics].sort());
		for (const member of details.members) {
			expect(member.itemIds.sort()).toEqual([web, robotics].sort());
		}
		expect((await readItemCount(robotics))?.seatsRemaining).toBe(17);
	});

	it("non-owner update → NOT_GROUP_OWNER; admin bypass allowed", async () => {
		const { groupId } = await group();
		const stranger = await createUser();
		expect(await rejectionCode(updateGroup(groupId, stranger, { name: "x" }))).toBe(
			"NOT_GROUP_OWNER",
		);
		await expect(
			updateGroup(groupId, stranger, { name: "x" }, { actorIsAdmin: true }),
		).resolves.toMatchObject({ name: "x" });
	});

	it("join link can be enabled, regenerated and disabled", async () => {
		const { groupId, owner } = await group();
		const enabled = await updateGroup(groupId, owner, { joinLink: "enable" });
		expect(enabled.joinCode).toBeTruthy();
		const regenerated = await updateGroup(groupId, owner, { joinLink: "regenerate" });
		expect(regenerated.joinCode).not.toBe(enabled.joinCode);
		const disabled = await updateGroup(groupId, owner, { joinLink: "disable" });
		expect(disabled.joinCode).toBeNull();
	});

	it("closeGroup releases unclaimed holds", async () => {
		const { groupId, owner, eventId } = await group(3);
		await closeGroup(groupId, owner);
		expect((await readEventCount(eventId))?.seatsRemaining).toBe(30);
	});

	it("closeExpiredGroups closes only past-deadline open groups and returns count", async () => {
		const { groupId, eventId } = await group();
		const other = await group();
		await db.update(events).set({ groupDeadlineHours: 24 * 11 }).where(eq(events.id, eventId));
		expect(await closeExpiredGroups()).toBe(1);
		const rows = await db.select().from(registrationGroups);
		const status = Object.fromEntries(rows.map((r) => [r.id, r.status]));
		expect(status[groupId]).toBe("closed");
		expect(status[other.groupId]).toBe("open");
	});

	it("listGroupsForEvent / listMyGroups / getGroupDetails shape", async () => {
		const { groupId, owner, eventId } = await group();
		const forEvent = await listGroupsForEvent(eventId);
		expect(forEvent[0]).toMatchObject({
			id: groupId,
			ownerEmail: expect.stringMatching(/^teacher-.+@x\.test$/),
			places: 3,
			confirmed: 0,
			invited: 2,
			status: "open",
		});
		expect((await listMyGroups(owner)).map((g) => g.id)).toEqual([groupId]);
		const details = await getGroupDetails(groupId, owner);
		expect(details.members.map((m) => m.email).sort()).toEqual(["a@x.test", "b@x.test"]);
		expect(details.deadline).toBeInstanceOf(Date);
	});
});
