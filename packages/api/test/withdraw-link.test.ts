import { env } from "@repo/env";
import { describe, expect, it } from "vitest";
import {
	isWithdrawTokenValid,
	withdrawToken,
	withdrawUrl,
} from "../src/registrations/withdraw-link";

describe("withdraw links", () => {
	it("accept the token made for the registration", () => {
		expect(isWithdrawTokenValid("reg-1", withdrawToken("reg-1"))).toBe(true);
	});

	it("refuse a token made for another registration", () => {
		expect(isWithdrawTokenValid("reg-2", withdrawToken("reg-1"))).toBe(false);
	});

	it("refuse an edited or empty token", () => {
		const token = withdrawToken("reg-1");
		const edited = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;
		expect(isWithdrawTokenValid("reg-1", edited)).toBe(false);
		expect(isWithdrawTokenValid("reg-1", "")).toBe(false);
		expect(isWithdrawTokenValid("reg-1", "not base64url!")).toBe(false);
	});

	it("is an absolute link to the localized withdraw page", () => {
		const url = new URL(withdrawUrl("reg-1", "en"));
		expect(url.origin).toBe(new URL(env.BETTER_AUTH_URL).origin);
		expect(url.pathname).toBe("/en/registrations/reg-1/withdraw");
		expect(url.searchParams.get("token")).toBe(withdrawToken("reg-1"));
	});
});
