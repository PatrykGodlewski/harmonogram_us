import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		env: {
			DATABASE_URL:
				"postgresql://postgres:postgres@localhost:5432/harmonogram_us_test",
			// No Redis in tests: rate limiters are disabled, so counters can't leak between runs.
			REDIS_URL: "",
		},
		globalSetup: ["../db/test/global-setup.ts"],
		fileParallelism: false,
		include: ["test/**/*.test.ts"],
	},
});
