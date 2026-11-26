import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/client";
import {
	failEventImage,
	getEventImageSource,
	markImagePending,
	setEventImage,
} from "../src/queries/event-images";
import { takeStoredFileDeletions } from "../src/queries/event-files";
import { getEventById, getEventPage } from "../src/queries/events";
import { events } from "../src/schema/events";
import { createEvent, expectConstraintViolation, resetDb } from "./helpers";

beforeEach(async () => {
	await resetDb();
	await db.execute(sql`TRUNCATE stored_file_deletions`);
});

function image(eventId: string, key: string, sourceHash: string) {
	return setEventImage(eventId, {
		key,
		url: `/api/event-images/${eventId}`,
		prompt: "a jazz quartet in a candlelit cellar",
		seed: 42,
		sourceHash,
	});
}

async function imageColumns(eventId: string) {
	const [row] = await db
		.select({
			url: events.imageUrl,
			prompt: events.imagePrompt,
			seed: events.imageSeed,
			status: events.imageStatus,
			sourceHash: events.imageSourceHash,
			key: events.imageKey,
		})
		.from(events)
		.where(eq(events.id, eventId));
	return row;
}

describe("event cover images", () => {
	it("a new event has no image, and the UI reads expose that", async () => {
		const eventId = await createEvent();

		expect(await imageColumns(eventId)).toEqual({
			url: null,
			prompt: null,
			seed: null,
			status: null,
			sourceHash: null,
			key: null,
		});
		expect(
			await getEventById(eventId, { kind: "manage" }),
		).toMatchObject({ imageUrl: null, imageStatus: null });
	});

	it("goes pending only when the source changes, unless forced", async () => {
		const eventId = await createEvent();

		expect(await markImagePending(db, eventId, "h1")).toBe(true);
		expect(await imageColumns(eventId)).toMatchObject({
			status: "pending",
			sourceHash: "h1",
		});
		expect(await markImagePending(db, eventId, "h1")).toBe(false);
		expect(await markImagePending(db, eventId, "h1", { force: true })).toBe(
			true,
		);
		expect(await markImagePending(db, eventId, "h2")).toBe(true);
		expect(await imageColumns(eventId)).toMatchObject({ sourceHash: "h2" });
	});

	it("stores a generated image as ready and exposes it on the event reads", async () => {
		const eventId = await createEvent();
		await markImagePending(db, eventId, "h1");
		await image(eventId, "event-images/a", "h1");

		expect(await imageColumns(eventId)).toEqual({
			url: `/api/event-images/${eventId}`,
			prompt: "a jazz quartet in a candlelit cellar",
			seed: 42,
			status: "ready",
			sourceHash: "h1",
			key: "event-images/a",
		});
		const page = await getEventPage(
			{ audience: { kind: "public", signedIn: false } },
			10,
		);
		expect(page.events[0]).toMatchObject({
			imageUrl: `/api/event-images/${eventId}`,
			imageStatus: "ready",
		});
		expect(await getEventImageSource(eventId)).toMatchObject({
			sourceHash: "h1",
			status: "ready",
		});
	});

	it("an image for an outdated source is kept, but the newer request stays pending", async () => {
		const eventId = await createEvent();
		await markImagePending(db, eventId, "h1");
		await markImagePending(db, eventId, "h2");
		await image(eventId, "event-images/a", "h1");

		expect(await imageColumns(eventId)).toMatchObject({
			key: "event-images/a",
			status: "pending",
			sourceHash: "h2",
		});
	});

	it("fails only the request it was generated for", async () => {
		const eventId = await createEvent();
		await markImagePending(db, eventId, "h1");
		await markImagePending(db, eventId, "h2");

		await failEventImage(eventId, "h1");
		expect(await imageColumns(eventId)).toMatchObject({ status: "pending" });
		await failEventImage(eventId, "h2");
		expect(await imageColumns(eventId)).toMatchObject({ status: "failed" });
	});

	it("does not fail a request whose image is already saved", async () => {
		const eventId = await createEvent();
		await markImagePending(db, eventId, "h1");
		await image(eventId, "event-images/a", "h1");

		await failEventImage(eventId, "h1");
		expect(await imageColumns(eventId)).toMatchObject({ status: "ready" });
	});

	it("rejects an unknown status", async () => {
		const eventId = await createEvent();
		await expectConstraintViolation(
			db.execute(
				sql`UPDATE events SET image_status = 'done' WHERE id = ${eventId}`,
			),
			"events_image_status_check",
		);
	});

	it("leaves a replaced or deleted image's key for the worker to delete", async () => {
		const eventId = await createEvent();
		await image(eventId, "event-images/a", "h1");
		await db
			.update(events)
			.set({ title: "Nowy tytuł" })
			.where(eq(events.id, eventId));
		expect(await takeStoredFileDeletions(10)).toEqual([]);

		await image(eventId, "event-images/b", "h1");
		expect(await takeStoredFileDeletions(10)).toEqual(["event-images/a"]);

		await db.delete(events).where(eq(events.id, eventId));
		expect((await takeStoredFileDeletions(10)).sort()).toEqual([
			"event-images/a",
			"event-images/b",
		]);
	});
});
