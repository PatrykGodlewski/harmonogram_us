import { randomBytes } from "node:crypto";
import { type Browser, expect, type Page, test } from "@playwright/test";
import { registerForEvent } from "@repo/db/queries/event-registrations";
import { adminUrl, signInAsAdmin } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";
import { open } from "../fixtures/navigation";

async function panelAs(
	browser: Browser,
	email: string,
	password: string,
): Promise<Page> {
	const page = await (await browser.newContext()).newPage();
	await signInAsAdmin(page, email, password);
	return page;
}

test("[F29] pomocnik od wejścia skanuje i odhacza, ale nie edytuje wydarzenia @organizator", async ({
	browser,
}, testInfo) => {
	const base = uniqueEmail(testInfo);
	const password = randomBytes(18).toString("base64url");
	const organizer = await createTestUser(`org-${base}`, {
		role: "organizer",
		password,
	});
	await createTestUser(`pomoc-${base}`, { password });
	const guest = await createTestUser(`gosc-${base}`);
	const event = await createTestEvent({ organizerId: organizer.id });
	await registerForEvent(event.id, guest.id, "pl");

	// The organizer adds a helper for the door
	const org = await panelAs(browser, `org-${base}`, password);
	await open(org, adminUrl(`/pl/events/${event.id}`));
	const organizers = org.getByRole("region", { name: "Organizatorzy" });
	await organizers.getByLabel("E-mail współorganizatora").fill(`pomoc-${base}`);
	await organizers.getByRole("combobox", { name: "Rola" }).click();
	await org.getByRole("option", { name: "Pomocnik od wejścia" }).click();
	await organizers.getByRole("button", { name: "Dodaj" }).click();
	await expect(
		organizers
			.getByRole("listitem")
			.filter({ hasText: `pomoc-${base}` })
			.getByText("Pomocnik od wejścia"),
	).toBeVisible();

	// The helper can scan and check people in
	const helper = await panelAs(browser, `pomoc-${base}`, password);
	await open(helper, adminUrl("/pl/events"));
	const row = helper.getByRole("row").filter({ hasText: event.title });
	await expect(row.getByRole("button", { name: "Edytuj" })).toHaveCount(0);
	await open(helper, adminUrl(`/pl/events/${event.id}`));
	await expect(
		helper.getByRole("link", { name: "Skanuj bilety" }),
	).toBeVisible();
	await helper
		.getByRole("listitem")
		.filter({ hasText: `gosc-${base}` })
		.getByRole("checkbox", { name: "Obecność" })
		.check();
	await expect(helper.getByText("Obecni: 1 / 1")).toBeVisible();

	// …but not change the event or its registrations
	for (const name of [
		"Edytuj wydarzenie",
		"Wyślij wiadomość",
		"Dodaj osobę",
		"Usuń",
		"Duplikuj",
	]) {
		await expect(helper.getByRole("button", { name, exact: true })).toHaveCount(
			0,
		);
	}
});
