import { expect, test } from "@playwright/test";
import { createTestEvent } from "../fixtures/data";
import { open } from "../fixtures/navigation";

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
