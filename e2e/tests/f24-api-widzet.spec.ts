import { expect, test } from "@playwright/test";
import { createTestEvent } from "../fixtures/data";

/** A faculty only this test uses, so parallel tests' events never mix in. */
function uniqueFaculty() {
	const label = `Wydzial ${crypto.randomUUID().slice(0, 8)}`;
	return { label, id: label.toLowerCase().replace(/[^a-z0-9]+/g, "-") };
}

test("[F24] API zwraca nadchodzące wydarzenia @uczestnik", async ({
	request,
}) => {
	const faculty = uniqueFaculty();
	const later = await createTestEvent({
		faculty: faculty.label,
		startsInDays: 5,
	});
	const sooner = await createTestEvent({
		faculty: faculty.label,
		startsInDays: 2,
	});
	await createTestEvent({
		faculty: faculty.label,
		startsInDays: 1,
		status: "draft",
	});
	await createTestEvent({
		faculty: faculty.label,
		startsInDays: 1,
		visibility: "private",
	});

	const response = await request.get(
		`/api/v1/events?faculty=${faculty.id}&lang=pl`,
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
