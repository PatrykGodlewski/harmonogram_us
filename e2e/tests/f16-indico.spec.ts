import { expect, test } from "@playwright/test";
import { getBoss } from "@repo/jobs/client";
import { QUEUE_INDICO_SYNC } from "@repo/jobs/queues";
import { expectAccessible } from "../fixtures/a11y";
import { open } from "../fixtures/navigation";

/** The stand-in Indico (e2e/indico-mock) lists this event three days from now. */
const TITLE = "Seminarium z Indico";
const INDICO_LINK = "http://indico.localhost:18081/event/1001/";

test.beforeAll(async () => {
	// Ask the worker for a sync now instead of waiting for its 30-minute schedule.
	const boss = await getBoss();
	await boss.send(QUEUE_INDICO_SYNC, null);
	await boss.stop({ graceful: true });
});

test("[F16] wydarzenie z Indico jest w kalendarzu z oznaczeniem i linkiem @uczestnik", async ({
	page,
}) => {
	await expect(async () => {
		await open(page, `/pl?search=${encodeURIComponent(TITLE)}`);
		await expect(page.getByRole("link", { name: TITLE })).toBeVisible({
			timeout: 1_000,
		});
	}).toPass({ timeout: 30_000 });

	await expect(page.getByRole("link", { name: TITLE })).toHaveAttribute(
		"href",
		INDICO_LINK,
	);
	await expect(page.getByText("Z Indico", { exact: true })).toBeVisible();
	await expect(page.getByText("Aula Główna")).toBeVisible();
	// Registration happens in Indico, not here.
	await expect(page.getByRole("button", { name: /Zapisz/ })).toHaveCount(0);
	await expectAccessible(
		page,
		"lista z Indico",
		"Rejestracja na wydarzenia uczelniane | Studenci",
	);
});

test("[F16] wydarzenie z Indico jest w kalendarzu uczelni (ICS) @uczestnik", async ({
	request,
}) => {
	await expect(async () => {
		const feed = await (
			await request.get("/api/calendar/events?lang=pl")
		).text();
		// Lines are unfolded first: long ones continue after a CRLF and a space.
		const unfolded = feed.replace(/\r\n /g, "");
		expect(unfolded).toContain(`SUMMARY:${TITLE}`);
		expect(unfolded).toContain(`URL:${INDICO_LINK}`);
		expect(unfolded).toContain("UID:indico-1001@harmonogram");
	}).toPass({ timeout: 30_000 });
});
