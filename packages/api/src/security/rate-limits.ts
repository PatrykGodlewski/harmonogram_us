import { createHash } from "node:crypto";

const FIFTEEN_MINUTES = 15 * 60;

/**
 * Confirming an invitation is limited per token: a whole class confirms from
 * one school IP, and tokens are 256-bit random values, so per-IP limits would
 * block real students without adding protection.
 */
export const INVITATION_ACCEPT_LIMIT = {
	points: 10,
	durationSeconds: FIFTEEN_MINUTES,
};

export function invitationAcceptRateKey(token: string): string {
	return `token:${createHash("sha256").update(token).digest("hex").slice(0, 32)}`;
}

/** Joining by link: a class of students shares one IP; Turnstile guards abuse. */
export const JOIN_GROUP_LIMIT = {
	points: 100,
	durationSeconds: FIFTEEN_MINUTES,
};

export function joinGroupRateKey(ip: string, joinCode: string): string {
	return `${ip}:${joinCode}`;
}
