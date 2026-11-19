import { expect, type Page } from "@playwright/test";

/** Opens a page and waits until React has hydrated it (see HydrationMarker). */
export async function open(page: Page, url: string): Promise<void> {
	await page.goto(url);
	await expect(page.locator("html")).toHaveAttribute("data-hydrated", "true", {
		timeout: 15_000,
	});
}
