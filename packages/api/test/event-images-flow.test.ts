import { eq, sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@repo/db/client";
import { createEvent, updateEvent } from "@repo/db/queries/events";
import { authUsers } from "@repo/db/schema/better-auth";
import { eventOrganizers } from "@repo/db/schema/event-organizers";
import { eventTypes } from "@repo/db/schema/event-lookups";
import { events } from "@repo/db/schema/events";
import { getBoss } from "@repo/jobs/client";
import { QUEUE_EVENT_IMAGES } from "@repo/jobs/queues";
import { createUser, resetDb } from "../../db/test/helpers";
import type { AuthenticatedUser } from "../src/auth/user";
import {
	generateEventImage,
	type PipelineDeps,
} from "../src/event-images/pipeline";
import { sourceHash } from "../src/event-images/prompt";
import { randomSeed } from "../src/event-images/providers";
import { eventImageHooks, type QueueDeps } from "../src/event-images/queue";
import { regenerateEventImage } from "../src/event-images/regenerate";

const STYLE = "test style";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer;
const on: QueueDeps = { enabled: true, styleSuffix: STYLE };

beforeEach(async () => {
	await resetDb();
	await getBoss();
	await db.execute(sql`DELETE FROM pgboss.job WHERE name = ${QUEUE_EVENT_IMAGES}`);
	await db
		.insert(eventTypes)
		.values({ id: "t", slug: "t", label: "T" })
		.onConflictDoNothing();
});

afterAll(async () => {
	await (await getBoss()).stop();
});

async function queued(eventId: string) {
	return db.execute<{ force: boolean }>(
		sql`SELECT (data->>'force')::boolean AS force FROM pgboss.job WHERE name = ${QUEUE_EVENT_IMAGES} AND data->>'eventId' = ${eventId} AND state = 'created'`,
	);
}

async function imageRow(eventId: string) {
	const [row] = await db
		.select({
			url: events.imageUrl,
			prompt: events.imagePrompt,
			seed: events.imageSeed,
			status: events.imageStatus,
			hash: events.imageSourceHash,
			key: events.imageKey,
		})
		.from(events)
		.where(eq(events.id, eventId));
	return row;
}

async function newEvent(deps: QueueDeps = on) {
	const event = await createEvent(
		{
			title: "Jazz night",
			description: "Live quartet",
			date: new Date(Date.now() + 86_400_000),
			maxSeats: 10,
			typeId: "t",
			organizerId: null,
		},
		eventImageHooks(deps),
	);
	if (!event) throw new Error("no event");
	return event.id;
}

function pipeline(overrides: Partial<PipelineDeps> = {}): PipelineDeps {
	let stored = 0;
	return {
		styleSuffix: STYLE,
		prompt: async (title) => `scene of ${title}, ${STYLE}`,
		generate: async () => ({ bytes: PNG, mimeType: "image/png" }),
		store: async (eventId) => `event-images/${eventId}/${++stored}`,
		seed: randomSeed,
		...overrides,
	};
}

describe("requesting a cover image on save", () => {
	it("marks a new event pending and queues one job in the same transaction", async () => {
		const eventId = await newEvent();
		expect(await imageRow(eventId)).toMatchObject({
			status: "pending",
			hash: sourceHash("Jazz night", "Live quartet", STYLE),
		});
		expect(await queued(eventId)).toEqual([{ force: false }]);
	});

	it("queues nothing when the title and description did not change", async () => {
		const eventId = await newEvent();
		await db.execute(sql`DELETE FROM pgboss.job WHERE name = ${QUEUE_EVENT_IMAGES}`);
		await updateEvent({ id: eventId, maxSeats: 20 }, undefined, eventImageHooks(on));
		expect(await queued(eventId)).toHaveLength(0);

		await updateEvent({ id: eventId, title: "Blues night" }, undefined, eventImageHooks(on));
		expect(await queued(eventId)).toHaveLength(1);
		expect((await imageRow(eventId))?.hash).toBe(
			sourceHash("Blues night", "Live quartet", STYLE),
		);
	});

	it("does nothing when the feature is off", async () => {
		const eventId = await newEvent({ ...on, enabled: false });
		expect((await imageRow(eventId))?.status).toBeNull();
		expect(await queued(eventId)).toHaveLength(0);
	});

	it("a failing enqueue never fails the event save", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const eventId = await newEvent({
			...on,
			enqueue: async () => {
				throw new Error("queue down");
			},
		});
		expect(await imageRow(eventId)).toMatchObject({ status: null, hash: null });
		expect(error).toHaveBeenCalled();
		error.mockRestore();
	});
});

describe("the worker", () => {
	it("stores the image and marks the event ready with url, prompt, seed and hash", async () => {
		const eventId = await newEvent();
		const generate = vi.fn(pipeline().generate);
		expect(await generateEventImage({ eventId, force: false }, pipeline({ generate }))).toBe(
			"ready",
		);
		const row = await imageRow(eventId);
		expect(row).toMatchObject({
			status: "ready",
			url: `/api/event-images/${eventId}`,
			prompt: `scene of Jazz night, ${STYLE}`,
			hash: sourceHash("Jazz night", "Live quartet", STYLE),
			key: `event-images/${eventId}/1`,
		});
		expect(generate).toHaveBeenCalledWith(`scene of Jazz night, ${STYLE}`, {
			seed: row?.seed,
			width: 1024,
			height: 576,
		});
	});

	it("marks the event failed when the provider fails", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const eventId = await newEvent();
		const deps = pipeline({
			generate: async () => {
				throw new Error("Image provider HTTP 500");
			},
		});
		expect(await generateEventImage({ eventId, force: false }, deps)).toBe("failed");
		expect(await imageRow(eventId)).toMatchObject({ status: "failed", key: null });
		error.mockRestore();
	});

	it("skips a duplicate job for an image that is already ready", async () => {
		const eventId = await newEvent();
		await generateEventImage({ eventId, force: false }, pipeline());
		const generate = vi.fn(pipeline().generate);
		expect(await generateEventImage({ eventId, force: false }, pipeline({ generate }))).toBe(
			"skipped",
		);
		expect(generate).not.toHaveBeenCalled();
	});

	it("uses the current title when the job is older than the last edit", async () => {
		const eventId = await newEvent();
		// An edit that bypassed the hook (e.g. a duplicate) leaves an outdated hash.
		await updateEvent({ id: eventId, title: "Blues night" });
		await generateEventImage({ eventId, force: false }, pipeline());
		expect(await imageRow(eventId)).toMatchObject({
			status: "ready",
			prompt: `scene of Blues night, ${STYLE}`,
			hash: sourceHash("Blues night", "Live quartet", STYLE),
		});
	});

	it("force regenerates with a fresh seed and queues the old object for deletion", async () => {
		const eventId = await newEvent();
		const deps = pipeline();
		await generateEventImage({ eventId, force: false }, deps);
		const first = await imageRow(eventId);
		expect(await generateEventImage({ eventId, force: true }, deps)).toBe("ready");
		const second = await imageRow(eventId);
		expect(second?.seed).not.toBe(first?.seed);
		expect(second?.key).not.toBe(first?.key);
		const deletions = await db.execute<{ storage_key: string }>(
			sql`SELECT storage_key FROM stored_file_deletions WHERE storage_key = ${first?.key ?? ""}`,
		);
		expect(deletions).toHaveLength(1);
	});
});

async function organizer(owns?: string): Promise<AuthenticatedUser> {
	const id = await createUser();
	await db.update(authUsers).set({ role: "organizer" }).where(eq(authUsers.id, id));
	if (owns) {
		await db.insert(eventOrganizers).values({ eventId: owns, userId: id });
	}
	return {
		id,
		email: `${id}@example.test`,
		hasPassword: true,
		isAdmin: false,
		role: "organizer",
		hasPanelAccess: true,
	};
}

describe("regenerateEventImage", () => {
	it("refuses someone who does not manage the event", async () => {
		const eventId = await newEvent();
		const stranger = await organizer();
		await expect(regenerateEventImage(stranger, eventId, on)).rejects.toThrow("FORBIDDEN");
	});

	it("sets pending, queues a forced job and allows 10 calls an hour", async () => {
		const eventId = await newEvent();
		await generateEventImage({ eventId, force: false }, pipeline());
		const owner = await organizer(eventId);
		// One queued job per event: the creation job would absorb the forced one.
		await db.execute(sql`DELETE FROM pgboss.job WHERE name = ${QUEUE_EVENT_IMAGES}`);

		await regenerateEventImage(owner, eventId, on);
		expect((await imageRow(eventId))?.status).toBe("pending");
		expect(await queued(eventId)).toEqual([{ force: true }]);

		for (let call = 2; call <= 10; call++) {
			await regenerateEventImage(owner, eventId, on);
		}
		await expect(regenerateEventImage(owner, eventId, on)).rejects.toThrow("RATE_LIMITED");
	});

	it("refuses when cover images are off", async () => {
		const eventId = await newEvent();
		const owner = await organizer(eventId);
		await expect(
			regenerateEventImage(owner, eventId, { ...on, enabled: false }),
		).rejects.toThrow();
	});
});
