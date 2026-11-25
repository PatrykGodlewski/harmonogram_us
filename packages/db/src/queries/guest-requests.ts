import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt, lte } from "drizzle-orm";
import { db, type TransactionClient } from "../client";
import { events } from "../schema/events";
import { guestRegistrationRequests } from "../schema/guest-requests";
import { DomainError } from "./domain-errors";
import { assertEventOpen } from "./event-registrations";
import { type Answers, assertAnswersValid } from "./registration-answers";

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

function sameSecret(given: string, expected: string): boolean {
	const a = Buffer.from(given);
	const b = Buffer.from(expected);
	return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Whether a guest may join the event now: open (EVENT_NOT_FOUND / _CANCELLED / _ENDED),
 * and for invite-only events the current invite
 * link (EVENT_NOT_FOUND). Checked when asking and again when confirming (a link can be
 * revoked or the event changed within the 24 hours).
 */
async function assertGuestsMayJoin(
	tx: TransactionClient,
	eventId: string,
	inviteToken: string | null,
): Promise<{ title: string }> {
	await assertEventOpen(tx, eventId);
	const [event] = await tx
		.select({
			title: events.title,
			visibility: events.visibility,
			inviteToken: events.inviteToken,
		})
		.from(events)
		.where(eq(events.id, eventId));
	if (!event) {
		throw new DomainError("EVENT_NOT_FOUND");
	}
	if (
		event.visibility === "private" &&
		!(
			inviteToken &&
			event.inviteToken &&
			sameSecret(inviteToken, event.inviteToken)
		)
	) {
		throw new DomainError("EVENT_NOT_FOUND");
	}
	return { title: event.title };
}

/** The confirm-time check for a taken request (see assertGuestsMayJoin). */
export async function assertGuestRequestStillValid(
	request: Pick<GuestRequest, "eventId" | "inviteToken">,
): Promise<void> {
	await db.transaction((tx) =>
		assertGuestsMayJoin(tx, request.eventId, request.inviteToken),
	);
}

/**
 * Stores a guest's request and returns the token for the confirmation link (only its hash
 * is kept). Refuses events a guest cannot join: not open (EVENT_NOT_FOUND / _CANCELLED /
 * _ENDED), invite-only without its link
 * (EVENT_NOT_FOUND), and answers that miss a required question (ANSWERS_INVALID).
 * `onCreated` runs in the same transaction (queue the confirmation e-mail there).
 */
export async function createGuestRequest(
	input: Omit<GuestRequest, "inviteToken"> & { inviteToken?: string | null },
	onCreated?: (
		tx: TransactionClient,
		token: string,
		event: { title: string },
	) => Promise<void>,
): Promise<{ token: string }> {
	return db.transaction(async (tx) => {
		const event = await assertGuestsMayJoin(
			tx,
			input.eventId,
			input.inviteToken ?? null,
		);
		await assertAnswersValid(tx, input.eventId, input.answers);

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
		await onCreated?.(tx, token, { title: event.title });
		return { token };
	});
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
