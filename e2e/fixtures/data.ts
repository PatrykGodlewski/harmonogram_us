import type { TestInfo } from "@playwright/test";
import { db } from "@repo/db/client";
import { createAgendaItem } from "@repo/db/queries/agenda-items";
import { createEvent } from "@repo/db/queries/events";
import { authUsers } from "@repo/db/schema/better-auth";
import { eventFaculties, eventTypes } from "@repo/db/schema/event-lookups";

/** A unique address per test, so tests never share mailboxes or accounts. */
export function uniqueEmail(testInfo: TestInfo): string {
	const slug = testInfo.title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 30);
	return `${slug}-${crypto.randomUUID().slice(0, 8)}@e2e.test`;
}

export async function createTestUser(
	email: string,
	opts?: { admin?: boolean },
): Promise<{ id: string }> {
	const id = crypto.randomUUID();
	await db.insert(authUsers).values({
		id,
		name: "Test User",
		email,
		emailVerified: true,
		role: opts?.admin ? "admin" : "user",
	});
	return { id };
}

async function lookup(
	table: typeof eventTypes | typeof eventFaculties,
	label: string,
) {
	const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
	const [row] = await db
		.insert(table)
		.values({ id: slug, slug, label })
		.onConflictDoUpdate({ target: table.id, set: { label } })
		.returning({ id: table.id });
	return row?.id ?? slug;
}

export async function createTestEvent(input: {
	title?: string;
	maxSeats?: number;
	startsInDays?: number;
	faculty?: string;
	agenda?: { title: string; maxSeats?: number }[];
}): Promise<{ id: string; title: string; itemIds: string[] }> {
	const title = input.title ?? `Wydarzenie ${crypto.randomUUID().slice(0, 8)}`;
	const date = new Date(Date.now() + (input.startsInDays ?? 10) * 86_400_000);
	const event = await createEvent({
		title,
		date,
		maxSeats: input.maxSeats ?? 10,
		typeId: await lookup(eventTypes, "Seminarium"),
		facultyId: input.faculty
			? await lookup(eventFaculties, input.faculty)
			: null,
	});
	if (!event) {
		throw new Error("createEvent returned nothing");
	}
	const itemIds: string[] = [];
	for (const [index, item] of (input.agenda ?? []).entries()) {
		const startsAt = new Date(date.getTime() + index * 3_600_000);
		const created = await createAgendaItem({
			eventId: event.id,
			title: item.title,
			startsAt,
			endsAt: new Date(startsAt.getTime() + 3_000_000),
			maxSeats: item.maxSeats ?? null,
		});
		itemIds.push(created.id);
	}
	return { id: event.id, title, itemIds };
}

/** Whether the account with `email` has a verified address (account state after an e-mail link). */
export async function isEmailVerified(email: string): Promise<boolean> {
	const { eq } = await import("drizzle-orm");
	const [user] = await db
		.select({ verified: authUsers.emailVerified })
		.from(authUsers)
		.where(eq(authUsers.email, email));
	return user?.verified ?? false;
}
