import { env } from "@repo/env";
import { describe, expect, it } from "vitest";
import { withdrawToken } from "../src/registrations/withdraw-link";
import { isSurveyTokenValid, surveyToken, surveyUrl } from "../src/surveys/link";

describe("survey links", () => {
	it("accept the token made for the registration", () => {
		expect(isSurveyTokenValid("reg-1", surveyToken("reg-1"))).toBe(true);
	});

	it("refuse another registration's token, an edited one and a withdraw token", () => {
		const token = surveyToken("reg-1");
		const edited = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;
		expect(isSurveyTokenValid("reg-2", token)).toBe(false);
		expect(isSurveyTokenValid("reg-1", edited)).toBe(false);
		expect(isSurveyTokenValid("reg-1", "")).toBe(false);
		expect(isSurveyTokenValid("reg-1", withdrawToken("reg-1"))).toBe(false);
	});

	it("is an absolute link to the localized survey page", () => {
		const url = new URL(surveyUrl("reg-1", "pl"));
		expect(url.origin).toBe(new URL(env.BETTER_AUTH_URL).origin);
		expect(url.pathname).toBe("/pl/surveys/reg-1");
		expect(url.searchParams.get("token")).toBe(surveyToken("reg-1"));
	});
});
