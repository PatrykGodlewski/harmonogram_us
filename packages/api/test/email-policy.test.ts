import { describe, expect, it } from "vitest";
import { checkEmails } from "../src/security/email-policy";

describe("email policy", () => {
	it("rejects disposable domains without network lookups", async () => {
		const result = await checkEmails(["kid@mailinator.com", "ok@school.edu.pl"]);
		expect(result.rejected).toEqual([{ email: "kid@mailinator.com", reason: "disposable" }]);
	});

	it("accepts a domain without a mail server: the confirmation link proves the address", async () => {
		const result = await checkEmails(["x@no-such-domain-e2e.test"]);
		expect(result.rejected).toEqual([]);
	});

	it("rejects an address without a domain", async () => {
		const result = await checkEmails(["no-at-sign"]);
		expect(result.rejected).toEqual([{ email: "no-at-sign", reason: "invalid" }]);
	});
});
