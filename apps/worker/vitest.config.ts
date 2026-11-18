import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		env: {
			DATABASE_URL:
				"postgresql://postgres:postgres@localhost:5432/harmonogram_us_test",
		},
		globalSetup: ["../../packages/db/test/global-setup.ts"],
		fileParallelism: false,
		include: ["test/**/*.test.ts"],
	},
});
