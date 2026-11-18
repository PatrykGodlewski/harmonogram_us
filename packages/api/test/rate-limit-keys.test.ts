import { describe, expect, it } from "vitest";
import {
	INVITATION_ACCEPT_LIMIT,
	invitationAcceptRateKey,
	JOIN_GROUP_LIMIT,
	joinGroupRateKey,
} from "../src/security/rate-limit-keys";

describe("rate limit keys", () => {
	it("invitation accept is limited per token, not per IP (a class shares one IP)", () => {
		const key = invitationAcceptRateKey("token-a");
		expect(key).toBe(invitationAcceptRateKey("token-a"));
		expect(key).not.toBe(invitationAcceptRateKey("token-b"));
		expect(key).not.toContain("token-a");
		expect(INVITATION_ACCEPT_LIMIT.points).toBeGreaterThanOrEqual(5);
	});

	it("join allows a whole class from one IP", () => {
		expect(joinGroupRateKey("10.0.0.1", "code")).toBe("10.0.0.1:code");
		expect(JOIN_GROUP_LIMIT.points).toBeGreaterThanOrEqual(60);
	});
});
