import { eq } from "drizzle-orm";
import { db } from "../client";
import { DomainError } from "../queries/domain-errors";
import {
	hasEventEnded,
	registerForAgendaItem,
	registerForEvent,
} from "../queries/event-registrations";
import {
	acceptInvitation,
	reissueInvitationToken,
} from "../queries/group-members";
import { closeGroup, createGroup, listGroupsForEvent } from "../queries/groups";
import { events } from "../schema/events";
import { ensureAccount } from "./accounts";
import type {
	AccountSeed,
	AgendaRegistrationSeed,
	GroupSeed,
	RegistrationSeed,
} from "./data";

/** Creates the test accounts; returns their ids by e-mail. */
export async function seedAccounts(
	seeds: AccountSeed[],
	password: string,
): Promise<ReadonlyMap<string, string>> {
	const ids = new Map<string, string>();
	for (const account of seeds) {
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

/** Runs `register`, ignoring "already registered" from an earlier seed run. */
async function once(register: () => Promise<unknown>): Promise<void> {
	try {
		await register();
	} catch (error) {
		if (
			!(error instanceof DomainError && error.code === "ALREADY_REGISTERED")
		) {
			throw error;
		}
	}
}

/**
 * An ended event takes no registrations, but its seeded registrations are its attendance
 * record: reopen it for the duration of `register`, then put its dates back.
 */
async function whileOpen(
	eventId: string,
	register: () => Promise<void>,
): Promise<void> {
	if (!(await hasEventEnded(db, eventId))) {
		await register();
		return;
	}
	const [original] = await db
		.select({ endsAt: events.endsAt })
		.from(events)
		.where(eq(events.id, eventId));
	await db
		.update(events)
		.set({ endsAt: new Date(Date.now() + 24 * 3_600_000) })
		.where(eq(events.id, eventId));
	try {
		await register();
	} finally {
		await db
			.update(events)
			.set({ endsAt: original?.endsAt ?? null })
			.where(eq(events.id, eventId));
	}
}

/**
 * How many seeds run side by side. Different events lock different rows, and two items
 * of one event wait for each other on the event row, so this only saves time. Within a
 * seed, people register in order (on a full event that order is the waitlist). Stays
 * below the database client's pool size.
 */
const IN_PARALLEL = 6;

async function inParallel<T>(
	seeds: T[],
	run: (seed: T) => Promise<void>,
): Promise<void> {
	const queue = [...seeds];
	const worker = async () => {
		for (let seed = queue.shift(); seed; seed = queue.shift()) {
			await run(seed);
		}
	};
	await Promise.all(Array.from({ length: IN_PARALLEL }, worker));
}

/** Registers through the domain functions, so seat counts and the waitlist stay consistent. */
export async function seedRegistrations(
	seeds: RegistrationSeed[],
	accounts: ReadonlyMap<string, string>,
): Promise<void> {
	await inParallel(seeds, ({ eventId, emails }) =>
		whileOpen(eventId, async () => {
			for (const email of emails) {
				const userId = accountId(accounts, email);
				await once(() => registerForEvent(eventId, userId, "pl"));
			}
		}),
	);
}

/** Per-item registrations (F27); each also registers for the event if needed. */
export async function seedAgendaRegistrations(
	seeds: AgendaRegistrationSeed[],
	accounts: ReadonlyMap<string, string>,
): Promise<void> {
	await inParallel(seeds, async ({ itemId, emails }) => {
		for (const email of emails) {
			const userId = accountId(accounts, email);
			await once(() => registerForAgendaItem(itemId, userId, "pl"));
		}
	});
}

export async function seedGroups(
	seeds: GroupSeed[],
	accounts: ReadonlyMap<string, string>,
): Promise<void> {
	for (const group of seeds) {
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
