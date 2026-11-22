import { describe, expect, it } from "vitest";
import {
	INVITATION_ACCEPT_LIMIT,
	invitationAcceptRateKey,
	EVENT_MESSAGE_LIMIT,
	eventMessageRateKeys,
	JOIN_GROUP_LIMIT,
	joinGroupRateKey,
} from "../src/security/rate-limits";

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

	it("organizer messages are limited per event and per sender", () => {
		expect(eventMessageRateKeys("e1", "u1")).toEqual(["event:e1", "user:u1"]);
		expect(EVENT_MESSAGE_LIMIT.points).toBe(5);
	});
});
