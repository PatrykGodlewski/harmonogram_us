import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/client";
import {
	getEventRegistrants,
	getMyRegistrations,
	registerForEvent,
	unregisterFromEvent,
} from "../src/queries/event-registrations";
import {
	acceptInvitation,
	getInvitation,
	reissueInvitationToken,
	removeMember,
	setMemberItems,
} from "../src/queries/group-members";
import { closeGroup, createGroup } from "../src/queries/groups";
import { eventRegistrations } from "../src/schema/event-registrations";
import { events } from "../src/schema/events";
import { registrationGroupMembers } from "../src/schema/groups";
import {
	createEvent,
	createItem,
	createUser,
	hoursFromNow,
	invitationToken,
	readEventCount,
	readItemCount,
	rejectionCode,
	resetDb,
} from "./helpers";

beforeEach(resetDb);

async function groupWithInvite(places = 3) {
	const eventId = await createEvent({ maxSeats: 30, date: hoursFromNow(24 * 10) });
	const web = await createItem(eventId, { maxSeats: 20, title: "web", startsAt: hoursFromNow(24 * 10), endsAt: hoursFromNow(24 * 10 + 1) });
	const robotics = await createItem(eventId, { maxSeats: 20, title: "robotics", startsAt: hoursFromNow(24 * 10), endsAt: hoursFromNow(24 * 10 + 1) });
	const owner = await createUser();
	const created = await createGroup({
		eventId,
		ownerUserId: owner,
		places,
		itemIds: [web],
		emails: ["kid@x.test"],
		joinLinkEnabled: false,
	});
	const invite = created.invited[0];
	if (!invite) throw new Error("no invite");
	const token = await invitationToken(invite.memberId);
	return { eventId, web, robotics, owner, groupId: created.groupId, memberId: invite.memberId, token };
}

describe("acceptInvitation", () => {
	it("getInvitation shows details without side effects", async () => {
		const { token, eventId } = await groupWithInvite();
		const invitation = await getInvitation(token);
		expect(invitation).toMatchObject({ email: "kid@x.test", itemTitles: ["web"] });
		expect(invitation?.group.eventId).toBe(eventId);
		expect(await getInvitation("nope")).toBeNull();
	});

	it("accept registers event and items, counts unchanged", async () => {
		const { token, eventId, web } = await groupWithInvite();
		const before = { event: await readEventCount(eventId), web: await readItemCount(web) };
		const student = await createUser("kid@x.test");
		await expect(acceptInvitation(token, student)).resolves.toMatchObject({ eventId });
		expect(await getMyRegistrations(student)).toEqual({ events: [{ eventId: eventId, state: "registered", waitlistPosition: null }], agendaItemIds: [web] });
		expect((await readEventCount(eventId))?.seatsRemaining).toBe(before.event?.seatsRemaining);
		expect((await readItemCount(web))?.seatsRemaining).toBe(before.web?.seatsRemaining);
	});

	it("token is single use", async () => {
		const { token } = await groupWithInvite();
		const student = await createUser("kid@x.test");
		await acceptInvitation(token, student);
		expect(await rejectionCode(acceptInvitation(token, student))).toBe("INVITATION_INVALID");
		const regs = await db.select().from(eventRegistrations).where(eq(eventRegistrations.userId, student));
		expect(regs).toHaveLength(1);
	});

	it("concurrent double accept", async () => {
		const { token } = await groupWithInvite();
		const student = await createUser("kid@x.test");
		const results = await Promise.allSettled([acceptInvitation(token, student), acceptInvitation(token, student)]);
		expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
	});

	it("accept after group closed / deadline", async () => {
		const closed = await groupWithInvite();
		await closeGroup(closed.groupId, closed.owner);
		expect(await rejectionCode(acceptInvitation(closed.token, await createUser()))).toBe("GROUP_CLOSED");

		const late = await groupWithInvite();
		await db.update(events).set({ groupDeadlineHours: 24 * 11 }).where(eq(events.id, late.eventId));
		expect(await rejectionCode(acceptInvitation(late.token, await createUser()))).toBe("GROUP_DEADLINE_PASSED");
	});

	it("accept while already individually registered keeps one registration and sets group_id", async () => {
		const { token, eventId, groupId } = await groupWithInvite();
		const student = await createUser("kid@x.test");
		await registerForEvent(eventId, student);
		await acceptInvitation(token, student);
		const regs = await db.select().from(eventRegistrations).where(eq(eventRegistrations.userId, student));
		expect(regs).toHaveLength(1);
		expect(regs[0]?.groupId).toBe(groupId);
	});

	it("ended item skipped on accept", async () => {
		const eventId = await createEvent({ maxSeats: 30, date: hoursFromNow(24 * 10), endsAt: hoursFromNow(24 * 11) });
		const owner = await createUser();
		const past = await createItem(eventId, { startsAt: hoursFromNow(1), endsAt: hoursFromNow(2) });
		const created = await createGroup({ eventId, ownerUserId: owner, places: 1, itemIds: [past], emails: ["kid@x.test"], joinLinkEnabled: false });
		await db.execute(
			sql`UPDATE agenda_items SET starts_at = now() - interval '2 hours', ends_at = now() - interval '1 hour' WHERE id = ${past}`,
		);
		const student = await createUser("kid@x.test");
		await acceptInvitation(await invitationToken(created.invited[0]?.memberId ?? ""), student);
		expect(await getMyRegistrations(student)).toEqual({ events: [{ eventId: eventId, state: "registered", waitlistPosition: null }], agendaItemIds: [] });
	});
});

describe("member changes", () => {
	async function confirmed() {
		const ctx = await groupWithInvite();
		const student = await createUser("kid@x.test");
		await acceptInvitation(ctx.token, student);
		return { ...ctx, student };
	}

	it("leaving returns place to group", async () => {
		const { eventId, student, groupId, owner } = await confirmed();
		const before = (await readEventCount(eventId))?.seatsRemaining;
		await unregisterFromEvent(eventId, student);
		const members = await db.select().from(registrationGroupMembers).where(eq(registrationGroupMembers.groupId, groupId));
		expect(members).toHaveLength(0);
		expect((await readEventCount(eventId))?.seatsRemaining).toBe(before);
		await closeGroup(groupId, owner);
		expect((await readEventCount(eventId))?.seatsRemaining).toBe(30);
	});

	it("removeMember confirmed frees registration and returns place", async () => {
		const { eventId, student, memberId, owner } = await confirmed();
		const before = (await readEventCount(eventId))?.seatsRemaining;
		await removeMember(memberId, owner);
		expect(await getMyRegistrations(student)).toEqual({ events: [], agendaItemIds: [] });
		expect((await readEventCount(eventId))?.seatsRemaining).toBe(before);
	});

	it("removeMember invited deletes the row", async () => {
		const { memberId, owner, groupId } = await groupWithInvite();
		await removeMember(memberId, owner);
		const members = await db.select().from(registrationGroupMembers).where(eq(registrationGroupMembers.groupId, groupId));
		expect(members).toHaveLength(0);
	});

	it("setMemberItems outside group items → ITEM_NOT_IN_GROUP", async () => {
		const { memberId, owner, robotics } = await groupWithInvite();
		expect(await rejectionCode(setMemberItems(memberId, owner, [robotics]))).toBe("ITEM_NOT_IN_GROUP");
	});

	it("setMemberItems on confirmed member adds/removes item registrations", async () => {
		const ctx = await confirmed();
		await setMemberItems(ctx.memberId, ctx.owner, []);
		expect((await getMyRegistrations(ctx.student)).agendaItemIds).toEqual([]);
		await setMemberItems(ctx.memberId, ctx.owner, [ctx.web]);
		expect((await getMyRegistrations(ctx.student)).agendaItemIds).toEqual([ctx.web]);
	});

	it("reissueInvitationToken invalidates the previous token", async () => {
		const { memberId, token } = await groupWithInvite();
		const fresh = await reissueInvitationToken(memberId);
		expect(fresh).toBeTruthy();
		const student = await createUser("kid@x.test");
		expect(await rejectionCode(acceptInvitation(token, student))).toBe("INVITATION_INVALID");
		await expect(acceptInvitation(fresh ?? "", student)).resolves.toBeDefined();
		expect(await reissueInvitationToken(memberId)).toBeNull();
	});

	it("getEventRegistrants includes groupName for group members", async () => {
		const ctx = await confirmed();
		await db.execute(sql`UPDATE registration_groups SET name = '3B' WHERE id = ${ctx.groupId}`);
		const individual = await createUser();
		await registerForEvent(ctx.eventId, individual);
		const registrants = await getEventRegistrants(ctx.eventId);
		const byUser = Object.fromEntries(registrants.map((r) => [r.userId, r]));
		expect(byUser[ctx.student]).toMatchObject({ groupId: ctx.groupId, groupName: "3B" });
		expect(byUser[individual]).toMatchObject({ groupId: null, groupName: null });
	});
});


describe("groups and registration approval", () => {
	it("a group cannot be created on an event that requires approval", async () => {
		const eventId = await createEvent({ requiresApproval: true, date: hoursFromNow(24 * 10) });
		const owner = await createUser();
		expect(
			await rejectionCode(
				createGroup({ eventId, ownerUserId: owner, places: 2, itemIds: [], emails: [], joinLinkEnabled: true }),
			),
		).toBe("APPROVAL_REQUIRED");
	});

	it("a rejected student cannot get in through a group invitation", async () => {
		const { token, eventId } = await groupWithInvite();
		const kid = await createUser("kid@x.test");
		await registerForEvent(eventId, kid, "pl");
		await db.update(eventRegistrations).set({ state: "rejected" }).where(eq(eventRegistrations.userId, kid));
		expect(await rejectionCode(acceptInvitation(token, kid))).toBe("APPROVAL_REQUIRED");
	});
});

describe("groups made before approval was switched on", () => {
	it("a new member without a registration waits for approval instead of getting in", async () => {
		const { token, eventId } = await groupWithInvite();
		await db.update(events).set({ requiresApproval: true }).where(eq(events.id, eventId));
		const kid = await createUser("kid@x.test");
		expect(await rejectionCode(acceptInvitation(token, kid))).toBe("APPROVAL_REQUIRED");
	});
});
