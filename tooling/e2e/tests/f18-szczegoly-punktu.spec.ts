import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { registerForEvent } from "@repo/db/queries/event-registrations";
import { adminUrl, signInAsAdmin, signInByEmail } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { open } from "../fixtures/navigation";

/** A real 2×2 PNG, so the page can show it. */
const PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==",
	"base64",
);

const BIO =
	"Pianistka, badaczka i pedagożka. Zajmuje się twórczością kompozytorek.";

test("[F18] organizator opisuje punkt programu jak w programie festiwalu @organizator", async ({
	page,
	browser,
}, testInfo) => {
	const email = uniqueEmail(testInfo);
	const password = randomBytes(18).toString("base64url");
	const organizer = await createTestUser(email, {
		role: "organizer",
		password,
	});
	const event = await createTestEvent({
		organizerId: organizer.id,
		faculty: "Wydział Sztuki",
		maxSeats: 30,
		agenda: [{ title: "W cieniu sławy", maxSeats: 30 }],
	});
	await signInAsAdmin(page, email, password);
	await open(page, adminUrl(`/pl/events/${event.id}`));

	await page
		.getByRole("region", { name: "Program" })
		.getByRole("listitem")
		.filter({ hasText: "W cieniu sławy" })
		.getByRole("button", { name: "Edytuj" })
		.click();
	const dialog = page.getByRole("dialog");
	await dialog.getByRole("combobox", { name: "Kategoria" }).click();
	await page.getByRole("option", { name: "Seminarium" }).click();
	await dialog.getByRole("combobox", { name: "Jednostka prowadząca" }).click();
	await page.getByRole("option", { name: "Wydział Sztuki" }).click();
	await dialog.getByLabel("Obszar wiedzy").fill("Sztuka");
	await dialog.getByLabel("Grupa wiekowa").fill("dla wszystkich");
	await dialog.getByRole("checkbox", { name: "polski" }).check();
	await dialog.getByRole("button", { name: "Dodaj prelegenta" }).click();
	await dialog
		.getByLabel("Imię i nazwisko prelegenta 1")
		.fill("dr hab. Anna Kijanowska");
	await dialog
		.getByLabel("Afiliacja prelegenta 1")
		.fill("Uniwersytet Śląski w Katowicach");
	await dialog
		.getByLabel("Jednostka prelegenta 1")
		.fill("Wydział Sztuki i Nauk o Edukacji");
	await dialog.getByLabel("Biogram prelegenta 1").fill(BIO);
	await dialog
		.getByLabel("Opis", { exact: true })
		.fill("Podróż w świat dwóch artystek.");

	// The image: what it shows is required.
	await dialog.getByLabel("Plik obrazu").setInputFiles({
		name: "scena.png",
		mimeType: "image/png",
		buffer: PNG,
	});
	await dialog.getByRole("button", { name: "Wgraj obraz" }).click();
	await expect(dialog.getByText("Opisz, co przedstawia obraz.")).toBeVisible();
	await dialog.getByLabel("Co przedstawia obraz").fill("Fortepian na scenie");
	await dialog.getByRole("button", { name: "Wgraj obraz" }).click();
	await expect(
		dialog.getByRole("img", { name: "Fortepian na scenie" }),
	).toBeVisible();
	await dialog.getByRole("button", { name: "Zapisz" }).click();
	await expect(dialog).toBeHidden();

	// A visitor sees it all on the item's page.
	const visitor = await (await browser.newContext()).newPage();
	await open(visitor, `/pl/events/${event.id}/program/${event.itemIds[0]}`);
	await expect(
		visitor.getByRole("heading", { level: 1, name: "W cieniu sławy" }),
	).toBeVisible();
	const basics = visitor.getByRole("region", { name: "Informacje podstawowe" });
	for (const text of [
		"Seminarium",
		"Sztuka",
		"polski",
		"Wydział Sztuki",
		"dla wszystkich",
	]) {
		await expect(basics.getByText(text, { exact: true })).toBeVisible();
	}
	const where = visitor.getByRole("region", { name: "Gdzie i kiedy?" });
	await expect(where.getByText("30 / 30")).toBeVisible();
	await expect(where.getByText(/aktualizacja \d{2}:\d{2}/)).toBeVisible();
	await expect(
		visitor.getByRole("region", { name: "Szczegóły" }),
	).toContainText("Podróż w świat dwóch artystek.");
	const speakers = visitor.getByRole("region", { name: "Prowadzący" });
	await expect(speakers.getByText("dr hab. Anna Kijanowska")).toBeVisible();
	await expect(
		speakers.getByText("Wydział Sztuki i Nauk o Edukacji"),
	).toBeVisible();
	await expect(speakers.getByText(BIO)).toBeVisible();
	const image = visitor.getByRole("img", { name: "Fortepian na scenie" });
	await expect(image).toBeVisible();
	await expect
		.poll(() =>
			image.evaluate((element: HTMLImageElement) => element.naturalWidth),
		)
		.toBe(2);

	// Removing the image takes it off the page.
	await page
		.getByRole("region", { name: "Program" })
		.getByRole("listitem")
		.filter({ hasText: "W cieniu sławy" })
		.getByRole("button", { name: "Edytuj" })
		.click();
	await dialog.getByRole("button", { name: "Usuń obraz" }).click();
	await expect(dialog.getByRole("img")).toHaveCount(0);
	await visitor.reload();
	await expect(
		visitor.getByRole("img", { name: "Fortepian na scenie" }),
	).toHaveCount(0);
});

test("[F18] punkt programu ma własną stronę ze szczegółami @uczestnik", async ({
	page,
}) => {
	const event = await createTestEvent({
		agenda: [{ title: "Otwarcie", maxSeats: 5 }, { title: "Panel" }],
	});

	// From the list…
	await open(page, `/pl/events/${event.id}`);
	await page.getByRole("link", { name: "Otwarcie", exact: true }).click();
	await expect(page).toHaveURL(
		new RegExp(`/pl/events/${event.id}/program/${event.itemIds[0]}$`),
	);
	await expect(
		page.getByRole("heading", { level: 1, name: "Otwarcie" }),
	).toBeVisible();
	await expect(
		page.getByRole("region", { name: "Gdzie i kiedy?" }).getByText("5 / 5"),
	).toBeVisible();
	await expect(
		page
			.getByRole("region", { name: "Gdzie i kiedy?" })
			.getByRole("link", { name: "Zarejestruj się" }),
	).toBeVisible();
	await page.getByRole("link", { name: /Wróć do wydarzenia/ }).click();
	await expect(page).toHaveURL(new RegExp(`/pl/events/${event.id}$`));

	// …and from the calendar.
	await open(page, `/pl/events/${event.id}?agenda=calendar`);
	await page.getByRole("button", { name: /Panel/ }).click();
	await page
		.getByRole("dialog")
		.getByRole("link", { name: "Panel", exact: true })
		.click();
	await expect(
		page.getByRole("heading", { level: 1, name: "Panel" }),
	).toBeVisible();

	await open(page, `/pl/events/${event.id}/program/nie-ma-takiego`);
	await expect(page.getByText("Nie znaleziono punktu programu.")).toBeVisible();
});

test("[F18] punkt bez własnego limitu nie jest pełny, gdy pełne jest wydarzenie @uczestnik", async ({
	page,
}, testInfo) => {
	const event = await createTestEvent({
		maxSeats: 1,
		agenda: [{ title: "Bez limitu" }],
	});
	const other = await createTestUser(`inny-${uniqueEmail(testInfo)}`);
	await registerForEvent(event.id, other.id, "pl");
	const email = uniqueEmail(testInfo);
	await createTestUser(email);
	await signInByEmail(page, email);

	await open(page, `/pl/events/${event.id}/program/${event.itemIds[0]}`);
	const where = page.getByRole("region", { name: "Gdzie i kiedy?" });
	// The same as in the programme list: an item's seats are its own.
	await expect(
		where.getByRole("button", { name: "Zarejestruj się" }),
	).toBeEnabled();
	await expect(where.getByText("Wolne miejsca")).toHaveCount(0);
});
