import { randomBytes } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { registerForEvent } from "@repo/db/queries/event-registrations";
import { adminUrl, signInAsAdmin, signInByEmail } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { open } from "../fixtures/navigation";

/** WCAG 2.1 A and AA, as F8 requires. */
async function expectNoViolations(page: Page, screen: string) {
	// Mid-fade colours read as low contrast: scan the settled page.
	await page.waitForFunction(() =>
		document
			.getAnimations()
			.every((animation) => animation.playState !== "running"),
	);
	const { violations } = await new AxeBuilder({ page })
		.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
		.analyze();
	const summary = violations.map(
		(violation) =>
			`${violation.id} (${violation.impact}): ${violation.nodes
				.slice(0, 3)
				.map((node) => node.target.join(" "))
				.join(" | ")}`,
	);
	expect(summary, `${screen}: WCAG violations`).toEqual([]);
}

test("[F8] ekrany uczestnika spełniają WCAG 2.1 AA @uczestnik", async ({
	page,
}, testInfo) => {
	const email = uniqueEmail(testInfo);
	const user = await createTestUser(email);
	const event = await createTestEvent({ agenda: [{ title: "Otwarcie" }] });
	await registerForEvent(event.id, user.id, "pl");

	for (const [screen, path] of [
		["lista", "/pl"],
		["wydarzenie", `/pl/events/${event.id}`],
		["logowanie", "/pl/login"],
		["dane osobowe", "/pl/privacy"],
		["deklaracja dostępności", "/pl/accessibility"],
		["accessibility statement", "/en/accessibility"],
	] as const) {
		await open(page, path);
		await expectNoViolations(page, screen);
	}

	await signInByEmail(page, email);
	for (const [screen, path] of [
		["konto", "/pl/account"],
		["wydarzenie (zalogowany)", `/pl/events/${event.id}`],
	] as const) {
		await open(page, path);
		await expectNoViolations(page, screen);
	}
	await open(page, "/pl/account");
	await page.getByRole("link", { name: "Bilet" }).first().click();
	await page.getByRole("heading", { level: 1 }).waitFor();
	await expectNoViolations(page, "bilet");
});

test("[F8] ekrany organizatora spełniają WCAG 2.1 AA @organizator", async ({
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
		agenda: [{ title: "Otwarcie" }],
	});
	const participant = await createTestUser(`p-${email}`);
	await registerForEvent(event.id, participant.id, "pl");

	await signInAsAdmin(page, email, password);
	for (const [screen, path] of [
		["lista wydarzeń", "/pl/events"],
		["wydarzenie", `/pl/events/${event.id}`],
	] as const) {
		await open(page, adminUrl(path));
		await expectNoViolations(page, `panel: ${screen}`);
	}
	await page.getByRole("button", { name: "Edytuj wydarzenie" }).click();
	await page.getByRole("dialog").waitFor();
	await expectNoViolations(page, "panel: formularz wydarzenia");
});
