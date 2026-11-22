import { defineConfig, devices } from "@playwright/test";

import "./stack-env";
import { FAKE_CAMERA_FILE } from "./fixtures/fake-camera";

export default defineConfig({
	testDir: "./tests",
	globalSetup: "./global-setup.ts",
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
			grepInvert: /@skaner/,
			use: {
				...devices["Desktop Chrome"],
				viewport: { width: 1280, height: 800 },
			},
		},
		{
			name: "telefon",
			grep: /@uczestnik|@organizator/,
			grepInvert: /@skaner/,
			use: {
				...devices["Desktop Chrome"],
				viewport: { width: 360, height: 800 },
				isMobile: true,
				hasTouch: true,
			},
		},
		{
			// A phone scanning tickets: Chromium's fake camera shows a fixed QR ticket.
			name: "skaner",
			grep: /@skaner/,
			use: {
				...devices["Desktop Chrome"],
				viewport: { width: 360, height: 800 },
				isMobile: true,
				hasTouch: true,
				permissions: ["camera"],
				launchOptions: {
					args: [
						"--use-fake-ui-for-media-stream",
						"--use-fake-device-for-media-stream",
						`--use-file-for-fake-video-capture=${FAKE_CAMERA_FILE}`,
					],
				},
			},
		},
	],
});
