import { expect, type Page, test } from "@playwright/test";
import { db } from "@repo/db/client";
import { registerForEvent } from "@repo/db/queries/event-registrations";
import { authAccounts, authUsers } from "@repo/db/schema/better-auth";
import { and, eq } from "drizzle-orm";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { open } from "../fixtures/navigation";

/** The e2e stack's university (tooling/e2e/ports.env, tooling/e2e/oidc-mock). */
const UNIVERSITY = "Uniwersytet Testowy";

async function signInAtUniversity(
	page: Page,
	person: { email: string; givenName?: string; familyName?: string },
) {
	await page
		.getByRole("button", { name: `Zaloguj się kontem: ${UNIVERSITY}` })
		.click();
	await page
		.getByRole("heading", { name: "Logowanie uczelni (test)" })
		.waitFor();
	await page.getByLabel("E-mail").fill(person.email);
	await page.getByLabel("Imię").fill(person.givenName ?? "");
	await page.getByLabel("Nazwisko").fill(person.familyName ?? "");
	await page.getByRole("button", { name: "Zaloguj" }).click();
}

test("[F1] logowanie kontem uczelni łączy konto po adresie e-mail @uczestnik", async ({
	page,
}, testInfo) => {
	const email = uniqueEmail(testInfo);
	const user = await createTestUser(email);
	const event = await createTestEvent({});
	await registerForEvent(event.id, user.id, "pl");

	// Without a destination the person lands on their own events, registration included
	await open(page, "/pl/login");
	await signInAtUniversity(page, { email: email.toUpperCase() });

	await expect(page).toHaveURL(/\/pl\/my-events/);
	await expect(page.getByText(event.title).first()).toBeVisible();
});

test("[F1] hasło ustawione przez kogoś obcego przestaje działać po logowaniu kontem uczelni @uczestnik", async ({
	page,
}, testInfo) => {
	// Someone registered this address with their own password and never verified it.
	const email = uniqueEmail(testInfo);
	const user = await createTestUser(email, { password: "obcy-Haslo-2026!x" });
	await db
		.update(authUsers)
		.set({ emailVerified: false })
		.where(eq(authUsers.id, user.id));

	await open(page, "/pl/login?redirect=/account");
	await signInAtUniversity(page, { email });
	await expect(page).toHaveURL(/\/pl\/account/);

	const passwords = await db
		.select({ id: authAccounts.id })
		.from(authAccounts)
		.where(
			and(
				eq(authAccounts.userId, user.id),
				eq(authAccounts.providerId, "credential"),
			),
		);
	expect(passwords).toEqual([]);
});

test("[F1] adres przekazany innej osobie na uczelni nie otwiera starego konta @uczestnik", async ({
	page,
}, testInfo) => {
	// A graduate's account is tied to their university identity; the university
	// later gives the same address to someone else (another subject id).
	const email = uniqueEmail(testInfo);
	const graduate = await createTestUser(email);
	await db.insert(authAccounts).values({
		id: crypto.randomUUID(),
		accountId: "graduate-subject",
		providerId: "university",
		userId: graduate.id,
	});

	await open(page, "/pl/login?redirect=/account");
	await signInAtUniversity(page, { email });

	await expect(page).toHaveURL(/\/pl\/login/);
	await expect(page.getByRole("alert")).toContainText(
		"Nie udało się zalogować",
	);
	const links = await db
		.select({ accountId: authAccounts.accountId })
		.from(authAccounts)
		.where(
			and(
				eq(authAccounts.userId, graduate.id),
				eq(authAccounts.providerId, "university"),
			),
		);
	expect(links).toEqual([{ accountId: "graduate-subject" }]);
});

test("[F1] nowe konto z uczelni dostaje imię i nazwisko @uczestnik", async ({
	page,
}, testInfo) => {
	await open(page, "/pl/signup");
	await signInAtUniversity(page, {
		email: uniqueEmail(testInfo),
		givenName: "Ala",
		familyName: "Nowak",
	});

	await expect(page).toHaveURL(/\/pl\/account/);
	await expect(
		page.getByRole("region", { name: "Profil" }).getByLabel("Imię i nazwisko"),
	).toHaveValue("Ala Nowak");
});

test("[F1] odmowa u dostawcy wraca do logowania z komunikatem @uczestnik", async ({
	page,
}) => {
	await open(page, "/pl/login");
	await page
		.getByRole("button", { name: `Zaloguj się kontem: ${UNIVERSITY}` })
		.click();
	await page.getByRole("button", { name: "Anuluj" }).click();

	await expect(page).toHaveURL(/\/pl\/login/);
	await expect(page.getByRole("alert")).toContainText(
		"Nie udało się zalogować",
	);
});
