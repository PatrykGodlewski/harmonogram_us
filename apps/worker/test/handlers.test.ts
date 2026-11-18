import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@repo/db/client";
import { acceptInvitation } from "@repo/db/queries/group-members";
import { closeGroup, createGroup } from "@repo/db/queries/groups";
import { events } from "@repo/db/schema/events";
import { registrationGroups } from "@repo/db/schema/groups";
import {
	createEvent,
	createItem,
	createUser,
	hoursFromNow,
	resetDb,
} from "../../../packages/db/test/helpers";
import { closeExpired } from "../src/handlers/close-expired";
import {
	defaultSendInvitationDeps,
	sendInvitationEmail,
} from "../src/handlers/send-invitation";

beforeEach(resetDb);

type Sent = { to: string; subject: string; text: string; html?: string };

function capture() {
	const sent: Sent[] = [];
	const deps = {
		...defaultSendInvitationDeps,
		baseUrl: "https://events.example.test",
		send: async (message: Sent) => {
			sent.push(message);
		},
	};
	return { sent, deps };
}

async function group() {
	const eventId = await createEvent({ date: hoursFromNow(24 * 10) });
	const web = await createItem(eventId, { title: "Web workshop", startsAt: hoursFromNow(24 * 10), endsAt: hoursFromNow(24 * 10 + 1) });
	const owner = await createUser();
	const created = await createGroup({
		eventId,
		ownerUserId: owner,
		places: 2,
		itemIds: [web],
		emails: ["kid@x.test"],
		joinLinkEnabled: false,
	});
	return { eventId, owner, ...created, memberId: created.invited[0]?.memberId ?? "" };
}

describe("sendInvitationEmail", () => {
	it("sends to invited member with link containing a token that accepts", async () => {
		const { memberId, eventId } = await group();
		const { sent, deps } = capture();
		expect(await sendInvitationEmail({ memberId, locale: "en" }, deps)).toBe("sent");
		expect(sent).toHaveLength(1);
		expect(sent[0]?.to).toBe("kid@x.test");
		expect(sent[0]?.html).toContain("Web workshop");
		const match = sent[0]?.text.match(/https:\/\/events\.example\.test\/en\/invite\/([A-Za-z0-9_-]+)/);
		expect(match).toBeTruthy();
		const student = await createUser("kid@x.test");
		await expect(acceptInvitation(match?.[1] ?? "", student)).resolves.toMatchObject({ eventId });
	});

	it("skips confirmed member", async () => {
		const { memberId } = await group();
		const first = capture();
		await sendInvitationEmail({ memberId, locale: "pl" }, first.deps);
		const token = first.sent[0]?.text.match(/invite\/([A-Za-z0-9_-]+)/)?.[1] ?? "";
		await acceptInvitation(token, await createUser("kid@x.test"));
		const second = capture();
		expect(await sendInvitationEmail({ memberId, locale: "pl" }, second.deps)).toBe("skipped");
		expect(second.sent).toHaveLength(0);
	});

	it("skips closed group", async () => {
		const { memberId, groupId, owner } = await group();
		await closeGroup(groupId, owner);
		const { sent, deps } = capture();
		expect(await sendInvitationEmail({ memberId, locale: "en" }, deps)).toBe("skipped");
		expect(sent).toHaveLength(0);
	});
});

describe("closeExpired", () => {
	it("closeExpired closes past-deadline groups", async () => {
		const { eventId, groupId } = await group();
		await db.update(events).set({ groupDeadlineHours: 24 * 11 }).where(eq(events.id, eventId));
		expect(await closeExpired()).toBe(1);
		const [row] = await db.select().from(registrationGroups).where(eq(registrationGroups.id, groupId));
		expect(row?.status).toBe("closed");
	});
});
