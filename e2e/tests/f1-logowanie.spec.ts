import { expect, test } from "@playwright/test";
import { signInByEmail, waitForCaptcha } from "../fixtures/auth";
import { createTestUser, isEmailVerified, uniqueEmail } from "../fixtures/data";
import { latestMessageTo } from "../fixtures/mailpit";
import { open } from "../fixtures/navigation";

test("[F1] logowanie linkiem e-mail @uczestnik", async ({ page }, testInfo) => {
	// Given an account with a verified address
	const email = uniqueEmail(testInfo);
	await createTestUser(email);
	// When the user signs in with the e-mail link
	await signInByEmail(page, email);
	// Then the account page shows their address
	await open(page, "/pl/account");
	await expect(page.getByText(email)).toBeVisible();
});

test("[F1] rejestracja konta hasłem wysyła e-mail weryfikacyjny", async ({
	page,
}, testInfo) => {
	// Given a new visitor
	const email = uniqueEmail(testInfo);
	await open(page, "/pl/signup");
	// When they sign up with a password
	await page.getByLabel("E-mail").fill(email);
	await page.getByLabel("Hasło", { exact: true }).fill("Kampus-Haslo-2026!x");
	await page.getByLabel("Potwierdź hasło").fill("Kampus-Haslo-2026!x");
	await waitForCaptcha(page);
	await page.getByRole("button", { name: "Zarejestruj się" }).last().click();
	// Then a verification e-mail arrives and its link verifies the address
	const message = await latestMessageTo(email);
	expect(message.subject).toBe("Potwierdź swój adres e-mail");
	const link =
		message.links.find((href) => href.includes("/verify-email")) ??
		message.text.match(/https?:\/\/\S+verify-email\S+/)?.[0];
	expect(link, "verification link").toBeTruthy();
	await page.goto(link ?? "");
	await expect.poll(() => isEmailVerified(email)).toBe(true);
});
