import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { adminUrl, signInAsAdmin } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { open } from "../fixtures/navigation";

test("[F18] admin widzi program w widoku kalendarza", async ({
	page,
}, testInfo) => {
	// Given an admin and an event with an opening and two parallel workshops
	const email = uniqueEmail(testInfo);
	const password = randomBytes(18).toString("base64url");
	await createTestUser(email, { admin: true, password });
	const event = await createTestEvent({
		agenda: [
			{ title: "Otwarcie", startHour: 0, durationMinutes: 60 },
			{ title: "Warsztat A", startHour: 1.5, durationMinutes: 90, maxSeats: 2 },
			{ title: "Warsztat B", startHour: 1.5, durationMinutes: 90 },
		],
	});
	await signInAsAdmin(page, email, password);
	await open(page, adminUrl(`/pl/events/${event.id}`));

	// When they switch the agenda to the calendar
	await page.getByRole("button", { name: "Kalendarz" }).click();
	await expect(page).toHaveURL(/agenda=calendar/);

	// Then the parallel workshops sit side by side
	const a = page.getByRole("button", { name: /Warsztat A/ });
	const b = page.getByRole("button", { name: /Warsztat B/ });
	await expect(a).toBeVisible();
	await expect(b).toBeVisible();
	const layout = async () => {
		const [boxA, boxB] = [await a.boundingBox(), await b.boundingBox()];
		return {
			sameRow: boxA !== null && boxA.y === boxB?.y,
			sideBySide: boxA !== null && boxB !== null && boxA.x !== boxB.x,
		};
	};
	await expect.poll(layout).toEqual({ sameRow: true, sideBySide: true });
	await expect(a).toContainText("0 / 2");

	// And a block opens the item's edit dialog
	await a.click();
	await expect(page.getByRole("dialog").getByLabel("Tytuł")).toHaveValue(
		"Warsztat A",
	);
});
