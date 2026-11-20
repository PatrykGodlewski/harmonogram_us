import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { db } from "@repo/db/client";
import { registerForEvent } from "@repo/db/queries/event-registrations";
import { authUsers } from "@repo/db/schema/better-auth";
import { eq } from "drizzle-orm";
import { signInByEmail, waitForCaptcha } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { open } from "../fixtures/navigation";

async function accountExists(email: string): Promise<boolean> {
	const [row] = await db
		.select({ id: authUsers.id })
		.from(authUsers)
		.where(eq(authUsers.email, email));
	return Boolean(row);
}

test("[F9] klauzula jest widoczna przy zapisie @uczestnik", async ({
	page,
}) => {
	const event = await createTestEvent({});

	await open(page, `/pl/events/${event.id}`);
	const notice = page.getByText(
		"Zapisując się, przekazujesz organizatorowi imię, nazwisko i e-mail",
	);
	await expect(notice).toBeVisible();
	await page
		.getByRole("link", { name: "Informacja o danych osobowych" })
		.click();
	await expect(
		page.getByRole("heading", {
			name: "Informacja o danych osobowych",
			level: 1,
		}),
	).toBeVisible();
	await expect(page.getByText(/przechowujemy przez \d+ dni/)).toBeVisible();
});

test("[F9] eksport zawiera moje zapisy, a po usunięciu konta logowanie nie działa @uczestnik", async ({
	page,
}, testInfo) => {
	const email = uniqueEmail(testInfo);
	const password = randomBytes(18).toString("base64url");
	const user = await createTestUser(email, { password });
	const event = await createTestEvent({});
	await registerForEvent(event.id, user.id, "pl");

	await signInByEmail(page, email);
	await open(page, "/pl/account");
	const data = page.getByRole("region", { name: "Twoje dane" });

	// The export holds my registration
	const downloadPromise = page.waitForEvent("download");
	await data.getByRole("button", { name: "Pobierz moje dane" }).click();
	const exported = await readFile(
		(await (await downloadPromise).path()) ?? "",
		"utf8",
	);
	expect(JSON.parse(exported).registrations[0].event.title).toBe(event.title);

	// Deleting needs the e-mail typed in, then the account is gone
	await data.getByRole("button", { name: "Usuń konto" }).click();
	const confirm = page.getByRole("alertdialog");
	await expect(
		confirm.getByRole("button", { name: "Usuń konto na zawsze" }),
	).toBeDisabled();
	await confirm.getByLabel("Wpisz swój e-mail, aby potwierdzić").fill(email);
	await confirm.getByRole("button", { name: "Usuń konto na zawsze" }).click();
	await page.waitForURL(/\/pl\/?$/);
	await expect.poll(() => accountExists(email)).toBe(false);

	// And signing in with the old password fails
	await open(page, "/pl/login");
	await page.getByRole("button", { name: "Pokaż logowanie hasłem" }).click();
	await page.getByLabel("E-mail").fill(email);
	await page.getByLabel("Hasło", { exact: true }).fill(password);
	await waitForCaptcha(page);
	await page.getByRole("button", { name: "Zaloguj się hasłem" }).click();
	await expect(page.getByRole("alert").first()).toBeVisible();
	await expect(page).toHaveURL(/\/login/);
});
