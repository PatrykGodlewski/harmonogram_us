import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { adminUrl, signInAsAdmin } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { open } from "../fixtures/navigation";

test("[F3] strona wydarzenia w panelu ma pasek sekcji i liczby na górze @organizator", async ({
	page,
}, testInfo) => {
	const email = uniqueEmail(testInfo);
	const password = randomBytes(18).toString("base64url");
	const organizer = await createTestUser(email, {
		role: "organizer",
		password,
	});
	const event = await createTestEvent({
		organizerId: organizer.id,
		maxSeats: 40,
		agenda: [{ title: "Otwarcie" }],
	});
	await signInAsAdmin(page, email, password);
	await open(page, adminUrl(`/pl/events/${event.id}`));

	// The key number sits in the header
	await expect(page.getByText("Wolne miejsca", { exact: true })).toBeVisible();
	// A section bar jumps to the registrants and marks where you are
	const sections = page.getByRole("navigation", { name: "Sekcje wydarzenia" });
	await sections.getByRole("link", { name: "Zapisani" }).click();
	await expect(page).toHaveURL(/#zapisani$/);
	await expect(
		page.getByRole("heading", { name: /^Zapisani/, level: 2 }),
	).toBeInViewport();
	await expect(
		sections.getByRole("link", { name: "Zapisani" }),
	).toHaveAttribute("aria-current", "true");
});
