import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@repo/db/client";
import { createGroup, joinGroup } from "@repo/db/queries/groups";
import { registrationGroups } from "@repo/db/schema/groups";
import { enqueueInvitationEmails, getBoss } from "@repo/jobs/client";
import { QUEUE_GROUP_INVITATION_EMAIL } from "@repo/jobs/queues";
import { createEvent, createUser, hoursFromNow, resetDb } from "../../db/test/helpers";

beforeEach(async () => {
	await resetDb();
	await getBoss();
	await db.execute(sql`DELETE FROM pgboss.job WHERE name = ${QUEUE_GROUP_INVITATION_EMAIL}`);
});

afterAll(async () => {
	await (await getBoss()).stop();
});

async function queuedFor(memberId: string): Promise<number> {
	const [row] = await db.execute<{ n: number }>(
		sql`SELECT count(*)::int AS n FROM pgboss.job WHERE name = ${QUEUE_GROUP_INVITATION_EMAIL} AND data->>'memberId' = ${memberId} AND state = 'created'`,
	);
	return row?.n ?? 0;
}

async function newGroupInput() {
	return {
		eventId: await createEvent({ date: hoursFromNow(24 * 10) }),
		ownerUserId: await createUser(),
		places: 3,
		itemIds: [],
		emails: ["a@x.test", "b@x.test"],
		joinLinkEnabled: false,
	};
}

describe("invitation jobs commit with the group", () => {
	it("committed group has one queued job per invitee", async () => {
		const result = await createGroup(await newGroupInput(), {
			onInvited: (tx, refs) =>
				enqueueInvitationEmails(
					refs.map((ref) => ({ memberId: ref.memberId, locale: "pl" as const })),
					{ tx },
				),
		});
		for (const ref of result.invited) {
			expect(await queuedFor(ref.memberId)).toBe(1);
		}
	});

	it("rolled-back group leaves no jobs behind", async () => {
		let memberIds: string[] = [];
		await expect(
			createGroup(await newGroupInput(), {
				onInvited: async (tx, refs) => {
					memberIds = refs.map((ref) => ref.memberId);
					await enqueueInvitationEmails(
						refs.map((ref) => ({ memberId: ref.memberId, locale: "pl" as const })),
						{ tx },
					);
					throw new Error("boom after enqueue");
				},
			}),
		).rejects.toThrow("boom after enqueue");
		expect(memberIds).toHaveLength(2);
		for (const memberId of memberIds) {
			expect(await queuedFor(memberId)).toBe(0);
		}
		expect(await db.select().from(registrationGroups)).toHaveLength(0);
	});

	it("repeated sends for one member keep a single queued job", async () => {
		const result = await createGroup(await newGroupInput());
		const memberId = result.invited[0]?.memberId ?? "";
		await enqueueInvitationEmails([{ memberId, locale: "en" }]);
		await enqueueInvitationEmails([{ memberId, locale: "en" }]);
		expect(await queuedFor(memberId)).toBe(1);
	});

	it("joining by link queues the invitation in the same transaction", async () => {
		const input = { ...(await newGroupInput()), emails: [], joinLinkEnabled: true };
		const { joinCode } = await createGroup(input);
		const ref = await joinGroup(joinCode ?? "", "kid@x.test", {
			onInvited: (tx, refs) =>
				enqueueInvitationEmails(
					refs.map((r) => ({ memberId: r.memberId, locale: "en" as const })),
					{ tx },
				),
		});
		expect(await queuedFor(ref.memberId)).toBe(1);
	});
});

