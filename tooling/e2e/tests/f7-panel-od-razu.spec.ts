import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { registerForEvent } from "@repo/db/queries/event-registrations";
import { adminUrl, signInAsAdmin } from "../fixtures/auth";
import { createTestEvent, createTestUser, uniqueEmail } from "../fixtures/data";

/** The server sends the panel's data with the page: no empty table after a refresh. */
test("[F7] panel wysyła listę wydarzeń i zapisanych od razu z serwera @organizator", async ({
	page,
}, testInfo) => {
	const base = uniqueEmail(testInfo);
	const password = randomBytes(18).toString("base64url");
	const organizer = await createTestUser(`org-${base}`, {
		role: "organizer",
		password,
	});
	const event = await createTestEvent({ organizerId: organizer.id });
	const guest = await createTestUser(`gosc-${base}`);
	await registerForEvent(event.id, guest.id, "pl");

	await signInAsAdmin(page, `org-${base}`, password);

	const list = await page.request.get(adminUrl("/pl/events"));
	expect(await list.text()).toContain(event.title);

	const detail = await page.request.get(adminUrl(`/pl/events/${event.id}`));
	const html = await detail.text();
	expect(html).toContain(event.title);
	expect(html).toContain(`gosc-${base}`);
});
