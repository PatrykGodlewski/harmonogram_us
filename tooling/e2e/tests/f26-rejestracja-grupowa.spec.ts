import { expect, test } from "@playwright/test";
import { signInByEmail } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { latestMessageTo } from "../fixtures/mailpit";
import { open } from "../fixtures/navigation";

test("[F26] nauczyciel tworzy grupę, uczeń potwierdza z e-maila", async ({
	page,
	browser,
}, testInfo) => {
	// Given a signed-in teacher and an event with 5 places
	const teacher = uniqueEmail(testInfo);
	const student = `student-${teacher}`;
	await createTestUser(teacher);
	const event = await createTestEvent({ maxSeats: 5 });
	await signInByEmail(page, teacher);
	// When the teacher holds 2 places and invites one student
	await open(page, `/pl/events/${event.id}`);
	await page.getByRole("link", { name: "Zapisz grupę" }).click();
	await page.getByLabel("Liczba miejsc").fill("2");
	await page.getByLabel("Adresy e-mail uczniów").fill(student);
	await page.getByRole("button", { name: "Zarezerwuj miejsca" }).click();
	await expect(
		page.getByText("Potwierdzonych: 0 · zaproszonych: 1 · wolnych: 1 z 2"),
	).toBeVisible();
	// Then the event shows both places as taken
	await open(page, `/pl/events/${event.id}`);
	await expect(
		page.locator("section").first().getByText("Wolne miejsca: 3 / 5"),
	).toBeVisible();
	// When the student confirms from the invitation e-mail in their own browser
	// (the e-mail link is in English regardless of the teacher's page language; see ledger, Task 3)
	const message = await latestMessageTo(student);
	const link = message.links.find((href) => href.includes("/invite/"));
	expect(link, "invitation link").toBeTruthy();
	const studentContext = await browser.newContext({ locale: "pl-PL" });
	const studentPage = await studentContext.newPage();
	await open(studentPage, link ?? "");
	await studentPage
		.getByRole("button", { name: /Potwierdzam udział|Confirm my place/ })
		.click();
	// Then the student is registered and the held place is now theirs (count unchanged)
	const summary = studentPage.locator("section").first();
	await expect(summary.getByText(/Zarejestrowano|Registered/)).toBeVisible();
	await expect(
		summary.getByText(/Wolne miejsca: 3 \/ 5|3 \/ 5 places left/),
	).toBeVisible();
	await studentContext.close();
});
