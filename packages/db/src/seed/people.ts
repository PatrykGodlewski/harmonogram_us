import { DomainError } from "../queries/domain-errors";
import { registerForEvent } from "../queries/event-registrations";
import {
	acceptInvitation,
	reissueInvitationToken,
} from "../queries/group-members";
import { closeGroup, createGroup, listGroupsForEvent } from "../queries/groups";
import { ensureAccount } from "./accounts";
import { accountSeeds, groupSeeds, registrationSeeds } from "./data";

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
