import { readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@repo/db/client";
import { createAgendaItem } from "@repo/db/queries/agenda-items";
import { eventOrganizers } from "@repo/db/schema/event-organizers";
import { authUsers } from "@repo/db/schema/better-auth";
import { events } from "@repo/db/schema/events";
import { createEvent, createUser, resetDb } from "../../db/test/helpers";
import {
	assertCanCreateEvents,
	assertCanDeleteEvent,
	assertCanManageAgendaItem,
	assertCanManageEvent,
} from "../src/auth/event-access";
import type { AuthenticatedUser } from "../src/auth/user";

beforeEach(resetDb);

async function user(role: "user" | "organizer" | "admin") {
	const id = await createUser();
	await db.update(authUsers).set({ role }).where(eq(authUsers.id, id));
	return {
		id,
		email: `${id}@example.test`,
		hasPassword: true,
		isAdmin: role === "admin",
		role,
		hasPanelAccess: role !== "user",
	} satisfies AuthenticatedUser;
}

describe("event access", () => {
	it("a foreign organizer is forbidden; organizers and admins pass", async () => {
		const owner = await user("organizer");
		const stranger = await user("organizer");
		const admin = await user("admin");
		const eventId = await createEvent();
		await db.insert(eventOrganizers).values({ eventId, userId: owner.id });

		await expect(assertCanManageEvent(owner, eventId)).resolves.toBeUndefined();
		await expect(assertCanManageEvent(admin, eventId)).resolves.toBeUndefined();
		await expect(assertCanManageEvent(stranger, eventId)).rejects.toThrow(
			"FORBIDDEN",
		);
	});

	it("agenda item access follows its event; a missing item is not found", async () => {
		const owner = await user("organizer");
		const stranger = await user("organizer");
		const eventId = await createEvent();
		await db.insert(eventOrganizers).values({ eventId, userId: owner.id });
		const item = await createAgendaItem({
			eventId,
			title: "I",
			startsAt: new Date(Date.now() + 86_400_000),
			endsAt: new Date(Date.now() + 90_000_000),
		});

		await expect(
			assertCanManageAgendaItem(owner, item.id),
		).resolves.toBeUndefined();
		await expect(assertCanManageAgendaItem(stranger, item.id)).rejects.toThrow(
			"FORBIDDEN",
		);
		await expect(assertCanManageAgendaItem(owner, "missing")).rejects.toThrow(
			"NOT_FOUND",
		);
	});

	it("organizers delete only drafts; published events go through cancellation", async () => {
		const owner = await user("organizer");
		const admin = await user("admin");
		const eventId = await createEvent();
		await db.insert(eventOrganizers).values({ eventId, userId: owner.id });

		await expect(assertCanDeleteEvent(owner, eventId)).rejects.toThrow(
			"FORBIDDEN",
		);
		await expect(assertCanDeleteEvent(admin, eventId)).resolves.toBeUndefined();
		await db.update(events).set({ status: "draft" }).where(eq(events.id, eventId));
		await expect(assertCanDeleteEvent(owner, eventId)).resolves.toBeUndefined();
	});

	it("only organizers and admins create events", async () => {
		await expect(
			assertCanCreateEvents(await user("organizer")),
		).resolves.toBeUndefined();
		await expect(assertCanCreateEvents(await user("user"))).rejects.toThrow(
			"FORBIDDEN",
		);
	});
});

/**
 * Every panel server function about one event must check access in its handler:
 * a forgotten check would let any organizer touch any event through a direct call.
 */
describe("panel server functions check event access", () => {
	const files = [
		"../src/admin/mutations.ts",
		"../src/admin/queries.ts",
		"../src/admin/organizers.ts",
		"../src/admin/registrants.ts",
	];
	/** Panel-wide reads that are not about one event. */
	const panelWide = ["fetchAdminEventFilterOptionsServer"];
	const checks =
		/assertCanManageEvent|assertCanManageAgendaItem|assertCanCreateEvents|assertCanDeleteEvent|listManagedEventIds/;

	for (const file of files) {
		const source = readFileSync(new URL(file, import.meta.url), "utf8");
		const blocks = source.split(/\nexport const /).slice(1);
		for (const block of blocks) {
			const name = block.slice(0, block.indexOf(" "));
			if (
				panelWide.includes(name) ||
				!/panel(Action|Query)Fn/.test(block.split("\n")[0] ?? "")
			) {
				continue;
			}
			it(`${name} checks access`, () => {
				expect(block).toMatch(checks);
			});
		}
	}

	it("finds the panel functions it guards", () => {
		const source = readFileSync(
			new URL("../src/admin/mutations.ts", import.meta.url),
			"utf8",
		);
		expect(source).toMatch(/= panelActionFn/);
	});
});
