import { defineConfig } from "vitest/config";

export const TEST_DATABASE_URL =
	"postgresql://postgres:postgres@localhost:5432/harmonogram_us_test";

export default defineConfig({
	test: {
		env: { DATABASE_URL: TEST_DATABASE_URL },
		globalSetup: ["./test/global-setup.ts"],
		fileParallelism: false,
		include: ["test/**/*.test.ts"],
	},
});
