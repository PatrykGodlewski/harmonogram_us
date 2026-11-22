import { expect, test } from "@playwright/test";
import { db } from "@repo/db/client";
import { eventFaculties } from "@repo/db/schema/event-lookups";
import { events } from "@repo/db/schema/events";
import { eq } from "drizzle-orm";
import { expectAccessible } from "../fixtures/a11y";
import { createTestEvent } from "../fixtures/data";
import { open } from "../fixtures/navigation";

/**
 * A faculty only this test uses, created as the panel does (a generated id and
 * a slug from the name), so parallel tests' events never mix in.
 */
async function uniqueFaculty() {
	const label = `Wydzial ${crypto.randomUUID().slice(0, 8)}`;
	const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
	const id = crypto.randomUUID();
	await db.insert(eventFaculties).values({ id, slug, label });
	return { id, slug, label };
}

/** An upcoming event of the faculty. */
async function facultyEvent(
	facultyId: string,
	input: Parameters<typeof createTestEvent>[0],
) {
	const event = await createTestEvent(input);
	await db.update(events).set({ facultyId }).where(eq(events.id, event.id));
	return event;
}

test("[F24] API zwraca nadchodzące wydarzenia @uczestnik", async ({
	request,
}) => {
	const faculty = await uniqueFaculty();
	const later = await facultyEvent(faculty.id, { startsInDays: 5 });
	const sooner = await facultyEvent(faculty.id, { startsInDays: 2 });
	await facultyEvent(faculty.id, { startsInDays: 1, status: "draft" });
	await facultyEvent(faculty.id, { startsInDays: 1, visibility: "private" });

	const response = await request.get(
		`/api/v1/events?faculty=${faculty.slug}&lang=pl`,
	);
	expect(response.status()).toBe(200);
	expect(response.headers()["access-control-allow-origin"]).toBe("*");
	const body = (await response.json()) as {
		events: {
			id: string;
			title: string;
			url: string;
			faculty: { label: string };
		}[];
	};
	expect(body.events.map((event) => event.id)).toEqual([sooner.id, later.id]);
	expect(body.events[0]?.faculty.label).toBe(faculty.label);
	expect(new URL(body.events[0]?.url ?? "").pathname).toBe(
		`/pl/events/${sooner.id}`,
	);

	expect((await request.get("/api/v1/events?limit=1000")).status()).toBe(400);
});

test("[F24] widżet na stronie zewnętrznej pokazuje trzy najbliższe @uczestnik", async ({
	page,
	baseURL,
}) => {
	const faculty = await uniqueFaculty();
	const fourth = await facultyEvent(faculty.id, { startsInDays: 4 });
	const first = await facultyEvent(faculty.id, { startsInDays: 1 });
	const third = await facultyEvent(faculty.id, { startsInDays: 3 });
	const second = await facultyEvent(faculty.id, { startsInDays: 2 });
	const src = `${baseURL}/pl/widget?limit=3&faculty=${faculty.slug}`;

	// Another university site embeds the widget
	await page.setContent(
		`<!doctype html><html lang="pl"><body><h1>Strona wydziału</h1>
		<iframe title="Najbliższe wydarzenia" src="${src}" width="360" height="400"></iframe>
		</body></html>`,
	);
	const widget = page.frameLocator("iframe");
	const items = widget.getByRole("listitem");
	await expect(items).toHaveCount(3);
	await expect(items.nth(0)).toContainText(first.title);
	await expect(items.nth(1)).toContainText(second.title);
	await expect(items.nth(2)).toContainText(third.title);
	await expect(widget.getByText(fourth.title)).toHaveCount(0);
	const link = items.nth(0).getByRole("link", { name: first.title });
	expect(await link.getAttribute("target")).toBe("_blank");
	expect(
		new URL((await link.getAttribute("href")) ?? "", baseURL).pathname,
	).toBe(`/pl/events/${first.id}`);
	// Only the list: no site header or footer inside the frame
	await expect(widget.getByRole("banner")).toHaveCount(0);
	await expect(widget.getByRole("contentinfo")).toHaveCount(0);
	// "All events" opens the site's list with the same faculty filter
	const all = widget.getByRole("link", { name: "Wszystkie wydarzenia" });
	expect(await all.getAttribute("href")).toBe(
		`/pl?facultyFilter=${faculty.slug}`,
	);

	await open(page, src);
	await expectAccessible(page, "widżet", "Najbliższe wydarzenia");
});
