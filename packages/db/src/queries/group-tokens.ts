import { createHash, randomBytes } from "node:crypto";

/** sha256 hex — the only form an invitation token is stored in. */
export function hashToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

export function createInvitationToken(): { token: string; tokenHash: string } {
	const token = randomBytes(32).toString("base64url");
	return { token, tokenHash: hashToken(token) };
}

/** 22 url-safe characters. */
export function createJoinCode(): string {
	return randomBytes(16).toString("base64url");
}
