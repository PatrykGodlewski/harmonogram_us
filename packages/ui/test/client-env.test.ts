import { describe, expect, it } from "vitest";
import { mergeClientRuntimeEnv } from "@repo/env/runtime-env";

describe("client env merge", () => {
	it("the value inlined at build time wins over the runtime one (SSR and browser agree)", () => {
		expect(
			mergeClientRuntimeEnv(
				{ VITE_APP_TIME_ZONE: "Europe/Warsaw" },
				{ VITE_APP_TIME_ZONE: "Europe/London" },
			).VITE_APP_TIME_ZONE,
		).toBe("Europe/Warsaw");
	});

	it("falls back to the runtime value where nothing was inlined (worker, tests)", () => {
		expect(
			mergeClientRuntimeEnv(undefined, { VITE_APP_TIME_ZONE: "Europe/London" })
				.VITE_APP_TIME_ZONE,
		).toBe("Europe/London");
		expect(
			mergeClientRuntimeEnv({}, { VITE_APP_TIME_ZONE: "Europe/London" })
				.VITE_APP_TIME_ZONE,
		).toBe("Europe/London");
	});
});
