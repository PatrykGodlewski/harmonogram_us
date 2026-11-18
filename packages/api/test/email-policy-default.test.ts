import { describe, expect, it, vi } from "vitest";

const calls: Array<Record<string, unknown>> = [];
vi.mock("deep-email-validator", () => ({
	default: async (options: Record<string, unknown>) => {
		calls.push(options);
		return { valid: true };
	},
}));

const { defaultDomainValidator } = await import("../src/security/email-policy");

describe("default domain validator", () => {
	it("never probes SMTP (port 25 is blocked on most hosts and rejects real addresses)", async () => {
		await defaultDomainValidator("someone@gmail.com");
		expect(calls[0]).toMatchObject({ validateMx: true, validateSMTP: false });
	});
});
