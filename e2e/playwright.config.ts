import { defineConfig, devices } from "@playwright/test";

// The e2e stack runs as its own compose project (see e2e/README.md); fixtures reach its database directly.
process.env.DATABASE_URL ??=
	"postgresql://postgres:postgres@localhost:15432/harmonogram_us";
process.env.E2E_WEB_URL ??= "http://localhost:3100";
process.env.E2E_MAILPIT_URL ??= "http://localhost:18025";
process.env.E2E_ADMIN_URL ??= "http://localhost:3101";

export default defineConfig({
	testDir: "./tests",
	fullyParallel: true,
	retries: 0,
	forbidOnly: true,
	reporter: [["list"], ["html", { open: "never" }]],
	use: {
		baseURL: process.env.E2E_WEB_URL,
		trace: "retain-on-failure",
		locale: "pl-PL",
		timezoneId: "Europe/Warsaw",
	},
	projects: [
		{
			name: "komputer",
			use: {
				...devices["Desktop Chrome"],
				viewport: { width: 1280, height: 800 },
			},
		},
		{
			name: "telefon",
			grep: /@uczestnik/,
			use: {
				...devices["Desktop Chrome"],
				viewport: { width: 360, height: 800 },
				isMobile: true,
				hasTouch: true,
			},
		},
	],
});
