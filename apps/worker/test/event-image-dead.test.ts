import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@repo/db/client";
import type { EventImageSource } from "@repo/db/queries/event-images";
import { enqueueEventImage, getBoss } from "@repo/jobs/client";
import { QUEUE_EVENT_IMAGES, QUEUE_EVENT_IMAGES_DEAD } from "@repo/jobs/queues";
import { handleDeadEventImageJob } from "../src/handlers/event-image-dead";

const JOB = { eventId: "e1", force: false };

function source(overrides: Partial<EventImageSource>): EventImageSource {
	return {
		title: "Jazz night",
		description: null,
		sourceHash: "hash-1",
		status: "pending",
		...overrides,
	};
}

function fakes(found: EventImageSource | null) {
	return {
		load: vi.fn(async (_eventId: string) => found),
		fail: vi.fn(async (_eventId: string, _sourceHash: string) => {}),
	};
}

describe("handleDeadEventImageJob", () => {
	it("marks a cover still pending as failed", async () => {
		const { load, fail } = fakes(source({}));
		expect(await handleDeadEventImageJob(JOB, load, fail)).toBe("failed");
		expect(load).toHaveBeenCalledWith("e1");
		expect(fail).toHaveBeenCalledWith("e1", "hash-1");
	});

	it.each([
		["ready", source({ status: "ready" })],
		["failed", source({ status: "failed" })],
		["deleted", null],
	])("leaves a %s cover alone", async (_label, found) => {
		const { load, fail } = fakes(found);
		expect(await handleDeadEventImageJob(JOB, load, fail)).toBe("skipped");
		expect(fail).not.toHaveBeenCalled();
	});

	it("logs instead of throwing on a bad payload or an unexpected error", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const { load, fail } = fakes(source({}));
		expect(await handleDeadEventImageJob({ eventId: "e1" }, load, fail)).toBe("error");
		expect(load).not.toHaveBeenCalled();
		expect(fail).not.toHaveBeenCalled();

		const broken = vi.fn(async () => {
			throw new Error("database down");
		});
		expect(await handleDeadEventImageJob(JOB, broken, fail)).toBe("error");
		expect(fail).not.toHaveBeenCalled();
		expect(error).toHaveBeenCalledTimes(2);
		error.mockRestore();
	});
});

describe("the event-images dead-letter queue", () => {
	const job = { eventId: "dead-letter-test", force: true };

	async function clearQueues() {
		await db.execute(
			sql`DELETE FROM pgboss.job WHERE name IN (${QUEUE_EVENT_IMAGES}, ${QUEUE_EVENT_IMAGES_DEAD})`,
		);
	}

	beforeEach(async () => {
		await getBoss();
		await clearQueues();
	});

	afterAll(async () => {
		await clearQueues();
		await (await getBoss()).stop();
	});

	it("receives an event-images job that failed (no retries)", async () => {
		const boss = await getBoss();
		await enqueueEventImage(job);
		const [active] = await boss.fetch(QUEUE_EVENT_IMAGES);
		expect(active?.data).toEqual(job);
		await boss.fail(QUEUE_EVENT_IMAGES, active?.id ?? "");

		const [dead] = await boss.fetch(QUEUE_EVENT_IMAGES_DEAD);
		expect(dead?.data).toEqual(job);
	});
});
