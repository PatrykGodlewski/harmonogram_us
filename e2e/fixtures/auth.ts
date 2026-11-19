import { expect, type Page } from "@playwright/test";
import { latestMessageTo } from "./mailpit";
import { open } from "./navigation";

/** Signs in through the UI with an e-mail link taken from Mailpit. */
export async function signInByEmail(page: Page, email: string): Promise<void> {
	await open(page, "/pl/login");
	await page.getByLabel("E-mail").fill(email);
	await waitForCaptcha(page);
	await page
		.getByRole("button", { name: "Wyślij bezpieczny link logowania" })
		.click();
	const message = await latestMessageTo(email, {
		subject: "link logowania",
	});
	const link = message.links.find((href) =>
		href.includes("/magic-link/verify"),
	);
	expect(link, "magic link in the e-mail").toBeTruthy();
	await open(page, link ?? "");
}

/** Waits until the CAPTCHA widget (Cloudflare test keys pass automatically) has produced its token. */
export async function waitForCaptcha(page: Page): Promise<void> {
	await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(
		/.+/,
		{
			timeout: 15_000,
		},
	);
}
