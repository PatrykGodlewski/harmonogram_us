import { and, eq } from "drizzle-orm";
import { db } from "../client";
import { DomainError } from "../queries/domain-errors";
import { registerForEvent } from "../queries/event-registrations";
import {
	acceptInvitation,
	reissueInvitationToken,
} from "../queries/group-members";
import { closeGroup, createGroup, listGroupsForEvent } from "../queries/groups";
import { rejectRegistrations } from "../queries/registration-approval";
import { eventOrganizers } from "../schema/event-organizers";
import { eventRegistrations } from "../schema/event-registrations";
import { ensureAccount } from "./accounts";
import {
	APPROVAL_EVENT_ID,
	accountSeeds,
	CERTIFICATE_EVENT_ID,
	eventSeeds,
	groupSeeds,
	INVITE_EVENT_ID,
	registrationSeeds,
} from "./data";

/** Creates the test accounts; returns their ids by e-mail. */
export async function seedAccounts(
	password: string,
): Promise<ReadonlyMap<string, string>> {
	const ids = new Map<string, string>();
	for (const account of accountSeeds) {
		const { id } = await ensureAccount({
			email: account.email,
			name: account.name,
			role: account.role,
			password: account.withPassword ? password : undefined,
		});
		ids.set(account.email, id);
	}
	return ids;
}

function accountId(
	accounts: ReadonlyMap<string, string>,
	email: string,
): string {
	const id = accounts.get(email);
	if (!id) {
		throw new Error(`Seed data refers to unknown account ${email}`);
	}
	return id;
}

/** Registers through the domain functions, so seat counts and the waitlist stay consistent. */
export async function seedRegistrations(
	accounts: ReadonlyMap<string, string>,
): Promise<void> {
	for (const { eventId, emails } of registrationSeeds) {
		for (const email of emails) {
			const userId = accountId(accounts, email);
			try {
				await registerForEvent(eventId, userId, "pl");
			} catch (error) {
				// Already registered on an earlier seed run.
				if (
					!(error instanceof DomainError && error.code === "ALREADY_REGISTERED")
				) {
					throw error;
				}
			}
		}
	}
}

export async function seedGroups(
	accounts: ReadonlyMap<string, string>,
): Promise<void> {
	for (const group of groupSeeds) {
		const ownerUserId = accounts.get(group.ownerEmail);
		if (!ownerUserId) {
			throw new Error(
				`Group seed refers to unknown account ${group.ownerEmail}`,
			);
		}
		const existing = await listGroupsForEvent(group.eventId);
		if (existing.some((row) => row.ownerEmail === group.ownerEmail)) {
			continue;
		}
		const { groupId, invited } = await createGroup({
			eventId: group.eventId,
			ownerUserId,
			places: group.places,
			itemIds: group.itemIds,
			name: group.name,
			emails: group.invite,
			joinLinkEnabled: group.joinLinkEnabled,
		});
		// Invitation tokens are stored only as hashes: issue a fresh one to accept with.
		for (const email of group.accept) {
			const memberId = invited.find((ref) => ref.email === email)?.memberId;
			const token = memberId ? await reissueInvitationToken(memberId) : null;
			if (!token) {
				throw new Error(
					`Group seed: ${email} must be invited to ${group.name}`,
				);
			}
			await acceptInvitation(token, accountId(accounts, email));
		}
		if (group.close) {
			await closeGroup(groupId, ownerUserId);
		}
	}
}

/** Seeded registration ids of `eventId`, by account e-mail. */
async function registrationIdOf(
	eventId: string,
	userId: string,
): Promise<string | null> {
	const [row] = await db
		.select({ id: eventRegistrations.id })
		.from(eventRegistrations)
		.where(
			and(
				eq(eventRegistrations.eventId, eventId),
				eq(eventRegistrations.userId, userId),
			),
		);
	return row?.id ?? null;
}

async function registerOnce(eventId: string, userId: string): Promise<void> {
	try {
		await registerForEvent(eventId, userId, "pl");
	} catch (error) {
		if (
			!(error instanceof DomainError && error.code === "ALREADY_REGISTERED")
		) {
			throw error;
		}
	}
}

/**
 * Data that shows plan 4: the organiser account manages the showcase events; the
 * ended workshop has an attendee (certificate) and an absentee; the approval
 * seminar has two waiting requests and a declined one; student1 is on the
 * invite-only event.
 */
export async function seedShowcase(
	accounts: ReadonlyMap<string, string>,
): Promise<void> {
	const organizerId = accountId(accounts, "organizator@harmonogram.local");
	const showcase = eventSeeds.filter((event) => event.organizer);
	if (showcase.length > 0) {
		await db
			.insert(eventOrganizers)
			.values(
				showcase.map((event) => ({ eventId: event.id, userId: organizerId })),
			)
			.onConflictDoNothing();
	}

	// The workshop has ended, so registering is closed: insert the attendance record directly.
	const present = accountId(accounts, "student1@harmonogram.local");
	const absent = accountId(accounts, "student2@harmonogram.local");
	await db
		.insert(eventRegistrations)
		.values([
			{
				id: crypto.randomUUID(),
				eventId: CERTIFICATE_EVENT_ID,
				userId: present,
				checkedInAt: new Date(),
			},
			{
				id: crypto.randomUUID(),
				eventId: CERTIFICATE_EVENT_ID,
				userId: absent,
			},
		])
		.onConflictDoNothing();

	for (const email of [
		"student3@harmonogram.local",
		"student4@harmonogram.local",
		"student5@harmonogram.local",
	]) {
		await registerOnce(APPROVAL_EVENT_ID, accountId(accounts, email));
	}
	const declined = await registrationIdOf(
		APPROVAL_EVENT_ID,
		accountId(accounts, "student5@harmonogram.local"),
	);
	if (declined) {
		// Only a pending request changes, so a second seed run does nothing.
		await rejectRegistrations(APPROVAL_EVENT_ID, [declined]);
	}

	await registerOnce(INVITE_EVENT_ID, present);
}
