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

	it("logs and skips a bad payload", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const { load, fail } = fakes(source({}));
		expect(await handleDeadEventImageJob({ eventId: "e1" }, load, fail)).toBe("skipped");
		expect(load).not.toHaveBeenCalled();
		expect(fail).not.toHaveBeenCalled();
		expect(error).toHaveBeenCalledTimes(1);
		error.mockRestore();
	});

	it("lets database errors propagate so pg-boss retries the job", async () => {
		const { load, fail } = fakes(source({}));
		const brokenLoad = vi.fn(async () => {
			throw new Error("database down");
		});
		await expect(handleDeadEventImageJob(JOB, brokenLoad, fail)).rejects.toThrow("database down");
		expect(fail).not.toHaveBeenCalled();

		const brokenFail = vi.fn(async () => {
			throw new Error("database down");
		});
		await expect(handleDeadEventImageJob(JOB, load, brokenFail)).rejects.toThrow("database down");
	});
});

describe("the event-images dead-letter queue", () => {
	const job = { eventId: "dead-letter-test", force: true };

	async function clearOwnJobs() {
		await db.execute(
			sql`DELETE FROM pgboss.job WHERE name IN (${QUEUE_EVENT_IMAGES}, ${QUEUE_EVENT_IMAGES_DEAD}) AND data->>'eventId' = ${job.eventId}`,
		);
	}

	function ownJobs(queue: string) {
		return db.execute<{
			id: string;
			data: unknown;
			expire_seconds: number;
			retry_limit: number;
			retry_delay: number;
		}>(
			sql`SELECT id, data, expire_seconds, retry_limit, retry_delay FROM pgboss.job WHERE name = ${queue} AND data->>'eventId' = ${job.eventId}`,
		);
	}

	beforeEach(async () => {
		await getBoss();
		await clearOwnJobs();
	});

	afterAll(async () => {
		await clearOwnJobs();
		await (await getBoss()).stop();
	});

	it("receives an event-images job that failed (no retries)", async () => {
		const boss = await getBoss();
		await enqueueEventImage(job);
		const [sent] = await ownJobs(QUEUE_EVENT_IMAGES);
		expect(sent?.expire_seconds).toBe(300);
		await boss.fail(QUEUE_EVENT_IMAGES, sent?.id ?? "");

		const dead = await ownJobs(QUEUE_EVENT_IMAGES_DEAD);
		expect(dead).toHaveLength(1);
		expect(dead[0]).toMatchObject({ data: job, retry_limit: 3, retry_delay: 60 });
	});
});
