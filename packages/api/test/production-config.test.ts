import { describe, expect, it } from "vitest";
import { assertProductionSecurityConfig } from "../src/security/production-config";

describe("production security config", () => {
	it("production without Turnstile secret fails", () => {
		expect(() => assertProductionSecurityConfig({ nodeEnv: "production" })).toThrow(
			"TURNSTILE_SECRET_KEY is required in production",
		);
	});

	it("development and configured production pass", () => {
		expect(() => assertProductionSecurityConfig({ nodeEnv: "development" })).not.toThrow();
		expect(() =>
			assertProductionSecurityConfig({ nodeEnv: "production", turnstileSecretKey: "s" }),
		).not.toThrow();
	});
});
