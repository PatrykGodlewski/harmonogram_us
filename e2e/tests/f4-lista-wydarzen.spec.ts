import { expect, test } from "@playwright/test";
import { createTestEvent } from "../fixtures/data";
import { open } from "../fixtures/navigation";

test("[F4] wyszukiwanie i filtr wydziału zawężają listę @uczestnik", async ({
	page,
}) => {
	// Given two events of different faculties
	const tag = crypto.randomUUID().slice(0, 6);
	const first = await createTestEvent({
		title: `Fizyka ${tag}`,
		faculty: `Wydział Fizyki ${tag}`,
	});
	const second = await createTestEvent({
		title: `Chemia ${tag}`,
		faculty: `Wydział Chemii ${tag}`,
	});
	await open(page, "/pl");
	// When searching for the first title
	await page.getByPlaceholder("Wyszukaj wydarzenie...").fill(first.title);
	// Then only the first is listed
	await expect(page.getByText(first.title)).toBeVisible();
	await expect(page.getByText(second.title)).toHaveCount(0);
	// When filtering by the second event's faculty instead
	await page.getByPlaceholder("Wyszukaj wydarzenie...").fill(tag);
	await page.getByRole("combobox").filter({ hasText: "Wydział" }).click();
	await page.getByRole("option", { name: `Wydział Chemii ${tag}` }).click();
	// Then only the second is listed
	await expect(page.getByText(second.title)).toBeVisible();
	await expect(page.getByText(first.title)).toHaveCount(0);
});

test("[F4] lista pokazuje 20 wydarzeń, a „Pokaż więcej” dociąga kolejne @uczestnik", async ({
	page,
}) => {
	// Given 25 events matching one search
	const tag = `Strona ${crypto.randomUUID().slice(0, 6)}`;
	for (let index = 0; index < 25; index++) {
		await createTestEvent({
			title: `${tag} ${index}`,
			startsInDays: 10 + index,
		});
	}
	// When the list is opened with that search
	await open(page, `/pl?search=${encodeURIComponent(tag)}`);
	const cards = page.getByText(new RegExp(`^${tag} \\d+$`));
	// Then the first page has 20 of them
	await expect(cards).toHaveCount(20);
	// When they ask for more
	await page.getByRole("link", { name: "Pokaż więcej" }).click();
	// Then all 25 are listed and there is nothing more to show
	await expect(cards).toHaveCount(25);
	await expect(page.getByRole("link", { name: "Pokaż więcej" })).toHaveCount(0);
});

test("[F4] HTML strony wydarzenia ma og:title i og:description", async ({
	request,
}) => {
	const event = await createTestEvent({});
	const html = await (await request.get(`/pl/events/${event.id}`)).text();
	expect(html).toContain(`property="og:title" content="${event.title}"`);
	expect(html).toMatch(/property="og:description" content="[^"]+"/);
	expect(html).toMatch(/property="og:url" content="[^"]*\/pl\/events\//);
});

test("[F4] filtry kiedy i forma zawężają listę @uczestnik", async ({
	page,
}) => {
	const tag = crypto.randomUUID().slice(0, 6);
	const soon = await createTestEvent({
		title: `Wkrótce ${tag}`,
		startsInDays: 3,
	});
	const later = await createTestEvent({
		title: `Później ${tag}`,
		startsInDays: 20,
	});
	const online = await createTestEvent({
		title: `Zdalnie ${tag}`,
		startsInDays: 4,
		attendanceMode: "online",
		onlineUrl: "https://meet.example.test/zdalnie",
	});

	await open(page, `/pl?search=${tag}`);
	await expect(page.getByText(later.title)).toBeVisible();

	// When: the next 7 days
	await page.getByRole("combobox").filter({ hasText: "Każdy termin" }).click();
	await page.getByRole("option", { name: "Najbliższe 7 dni" }).click();
	await expect(page.getByText(later.title)).toHaveCount(0);
	await expect(page.getByText(soon.title)).toBeVisible();

	// Format: online only
	await page.getByRole("combobox").filter({ hasText: "Każda forma" }).click();
	await page.getByRole("option", { name: "Online" }).click();
	await expect(page.getByText(soon.title)).toHaveCount(0);
	await expect(page.getByText(online.title)).toBeVisible();
});
