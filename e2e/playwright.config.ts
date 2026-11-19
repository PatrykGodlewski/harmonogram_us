import { defineConfig, devices } from "@playwright/test";

import "./stack-env";

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
