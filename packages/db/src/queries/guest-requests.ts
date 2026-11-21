import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lte } from "drizzle-orm";
import { db, type TransactionClient } from "../client";
import { guestRegistrationRequests } from "../schema/guest-requests";
import type { Answers } from "./registration-answers";

/** How long a confirmation link works. */
const REQUEST_LIFETIME_MS = 24 * 3_600_000;

export type GuestRequest = {
	eventId: string;
	email: string;
	name: string;
	locale: "pl" | "en";
	answers: Answers;
	inviteToken: string | null;
};

const hashToken = (token: string) =>
	createHash("sha256").update(token).digest("base64url");

/** Stores a request and returns the token for the confirmation link (only its hash is kept). */
export async function createGuestRequest(
	input: Omit<GuestRequest, "inviteToken"> & { inviteToken?: string | null },
	tx: TransactionClient | typeof db = db,
): Promise<{ token: string }> {
	const token = randomBytes(32).toString("base64url");
	await tx.insert(guestRegistrationRequests).values({
		tokenHash: hashToken(token),
		eventId: input.eventId,
		email: input.email.trim().toLowerCase(),
		name: input.name.trim(),
		locale: input.locale,
		answers: input.answers,
		inviteToken: input.inviteToken ?? null,
		expiresAt: new Date(Date.now() + REQUEST_LIFETIME_MS),
	});
	return { token };
}

/** Removes and returns the request behind a link, once; null if unknown, used or expired. */
export async function takeGuestRequest(
	token: string,
	tx: TransactionClient | typeof db = db,
): Promise<GuestRequest | null> {
	const [row] = await tx
		.delete(guestRegistrationRequests)
		.where(
			and(
				eq(guestRegistrationRequests.tokenHash, hashToken(token)),
				gt(guestRegistrationRequests.expiresAt, new Date()),
			),
		)
		.returning();
	if (!row) return null;
	return {
		eventId: row.eventId,
		email: row.email,
		name: row.name,
		locale: row.locale,
		answers: row.answers,
		inviteToken: row.inviteToken,
	};
}

/** Daily clean-up of links nobody confirmed. */
export async function pruneExpiredGuestRequests(): Promise<number> {
	const removed = await db
		.delete(guestRegistrationRequests)
		.where(lte(guestRegistrationRequests.expiresAt, new Date()))
		.returning({ tokenHash: guestRegistrationRequests.tokenHash });
	return removed.length;
}
