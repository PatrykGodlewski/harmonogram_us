import { expect, type Page } from "@playwright/test";
import { latestMessageTo } from "./mailpit";
import { open } from "./navigation";

/** Signs in through the UI with an e-mail link taken from Mailpit. */
export async function signInByEmail(page: Page, email: string): Promise<void> {
	await open(page, "/pl/login");
	await page.getByLabel("E-mail").fill(email);
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

/** The admin panel's address (its own app and origin). */
export function adminUrl(path: string): string {
	return new URL(path, process.env.E2E_ADMIN_URL).toString();
}

/** Signs in to the admin panel with an e-mail and password (admins need both). */
export async function signInAsAdmin(
	page: Page,
	email: string,
	password: string,
): Promise<void> {
	await open(page, adminUrl("/pl/login"));
	await page.getByLabel("E-mail").fill(email);
	await page.getByLabel("Hasło", { exact: true }).fill(password);
	await page.getByRole("button", { name: "Zaloguj się", exact: true }).click();
	// The panel navigates itself after signing in: let that page finish before the test moves on.
	await page.waitForURL((url) => !url.pathname.endsWith("/login"), {
		waitUntil: "load",
	});
	await page.locator("html[data-hydrated=true]").waitFor();
}
