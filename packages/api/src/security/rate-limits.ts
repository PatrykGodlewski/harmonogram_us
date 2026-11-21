import { createHash } from "node:crypto";
import type { RateLimit } from "./rate-limit";

const FIFTEEN_MINUTES = 15 * 60;

/**
 * Confirming an invitation is limited per token: a whole class confirms from
 * one school IP, and tokens are 256-bit random values, so per-IP limits would
 * block real students without adding protection.
 */
export const INVITATION_ACCEPT_LIMIT: RateLimit = {
	points: 10,
	durationSeconds: FIFTEEN_MINUTES,
};

export function invitationAcceptRateKey(token: string): string {
	return `token:${createHash("sha256").update(token).digest("hex").slice(0, 32)}`;
}

/** Joining by link: a class of students shares one IP; Turnstile guards abuse. */
export const JOIN_GROUP_LIMIT: RateLimit = {
	points: 100,
	durationSeconds: FIFTEEN_MINUTES,
};

export function joinGroupRateKey(ip: string, joinCode: string): string {
	return `${ip}:${joinCode}`;
}

/** Auth endpoints: per IP + email, blocked for the window once exhausted. */
export const SIGN_IN_LIMIT: RateLimit = {
	points: 10,
	durationSeconds: FIFTEEN_MINUTES,
	blockDurationSeconds: FIFTEEN_MINUTES,
};
export const SIGN_UP_LIMIT: RateLimit = {
	points: 6,
	durationSeconds: FIFTEEN_MINUTES,
	blockDurationSeconds: FIFTEEN_MINUTES,
};
export const MAGIC_LINK_LIMIT: RateLimit = {
	points: 6,
	durationSeconds: FIFTEEN_MINUTES,
	blockDurationSeconds: FIFTEEN_MINUTES,
};

/** Organizer messages: at most 5 per event per hour (each one e-mails everyone registered). */
export const EVENT_MESSAGE_LIMIT: RateLimit = {
	points: 5,
	durationSeconds: 60 * 60,
};

/** Invitations by e-mail: 10 sends (of up to 50 addresses each) per event and per sender per hour. */
export const EVENT_INVITATION_LIMIT: RateLimit = {
	points: 10,
	durationSeconds: 60 * 60,
};

/** One budget per event and one per sender, so neither can be drained through the other. */
export function eventMessageRateKeys(
	eventId: string,
	userId: string,
): string[] {
	return [`event:${eventId}`, `user:${userId}`];
}

/** Guest registration requests (F17): per address from one network, and per network. */
export const GUEST_REQUEST_LIMIT: RateLimit = {
	points: 5,
	durationSeconds: 60 * 60,
};

export const GUEST_REQUEST_IP_LIMIT: RateLimit = {
	points: 20,
	durationSeconds: 60 * 60,
};

/** Confirming a guest registration (token guessing is hopeless; this caps noise). */
export const GUEST_CONFIRM_LIMIT: RateLimit = {
	points: 10,
	durationSeconds: FIFTEEN_MINUTES,
};
