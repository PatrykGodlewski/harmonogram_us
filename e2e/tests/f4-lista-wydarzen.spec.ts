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
