import { describe, expect, it, vi } from "vitest";
import { checkEmails } from "../src/security/email-policy";

describe("email policy", () => {
	it("rejects disposable domains without a network lookup", async () => {
		const validate = vi.fn(async () => true);
		const result = await checkEmails(["kid@mailinator.com", "ok@school.edu.pl"], { validate });
		expect(result.rejected).toEqual([{ email: "kid@mailinator.com", reason: "disposable" }]);
		expect(validate).toHaveBeenCalledTimes(1);
	});

	it("checks the mail server once per domain", async () => {
		const validate = vi.fn(async (email: string) => !email.endsWith("@nomx.test"));
		const result = await checkEmails(
			["a@school.edu.pl", "b@school.edu.pl", "c@nomx.test", "d@nomx.test"],
			{ validate },
		);
		expect(validate).toHaveBeenCalledTimes(2);
		expect(result.rejected.map((r) => r.email)).toEqual(["c@nomx.test", "d@nomx.test"]);
		expect(result.rejected.every((r) => r.reason === "undeliverable")).toBe(true);
	});

	it("accepts everything that passes", async () => {
		const result = await checkEmails(["a@school.edu.pl"], { validate: async () => true });
		expect(result.rejected).toEqual([]);
	});
});
