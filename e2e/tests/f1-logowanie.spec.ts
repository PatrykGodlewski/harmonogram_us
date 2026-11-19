import { expect, test } from "@playwright/test";
import { signInByEmail } from "../fixtures/auth";
import { createTestUser, uniqueEmail } from "../fixtures/data";
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
