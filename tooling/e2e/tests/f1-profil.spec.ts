import { expect, test } from "@playwright/test";
import { signInByEmail } from "../fixtures/auth";
import { createTestUser, uniqueEmail } from "../fixtures/data";
import { open } from "../fixtures/navigation";

test("[F1] zmiana imienia i języka przełącza interfejs @uczestnik", async ({
	page,
}, testInfo) => {
	const email = uniqueEmail(testInfo);
	await createTestUser(email);
	await signInByEmail(page, email);

	await open(page, "/pl/account");
	const profile = page.getByRole("region", { name: "Profil" });
	await profile.getByLabel("Imię i nazwisko").fill("Ala Nowak");
	await profile.getByRole("combobox", { name: "Język" }).click();
	await page.getByRole("option", { name: "English" }).click();
	await profile.getByRole("button", { name: "Zapisz profil" }).click();

	await expect(page).toHaveURL(/\/en\/account/);
	await expect(
		page.getByRole("heading", { name: "Account", level: 1 }),
	).toBeVisible();
	await expect(
		page.getByRole("region", { name: "Profile" }).getByLabel("Full name"),
	).toHaveValue("Ala Nowak");
});
