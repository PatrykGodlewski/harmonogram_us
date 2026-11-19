import { env } from "@repo/env";
import { sql } from "drizzle-orm";
import { fromDrizzle, PgBoss } from "pg-boss";
import {
	type EmailJob,
	type GroupInvitationEmailPayload,
	QUEUE_EMAILS,
	QUEUE_GROUP_INVITATION_EMAIL,
	QUEUES,
} from "./queues";

/** Creates any missing queues (required before send/work in pg-boss ≥ 10). */
export async function ensureQueues(boss: PgBoss): Promise<void> {
	for (const queue of QUEUES) {
		if (!(await boss.getQueue(queue.name))) {
			await boss.createQueue(queue.name, { policy: queue.policy });
		}
	}
}

let bossPromise: Promise<PgBoss> | null = null;

/**
 * One long-lived pg-boss instance per process (pg-boss docs). Creates queues on first use.
 * - "producer" (web/admin): only sends jobs; no maintenance supervisor or cron scheduler.
 * - "worker": runs handlers, maintenance and cron schedules.
 */
export function getBoss(
	role: "producer" | "worker" = "producer",
): Promise<PgBoss> {
	if (!bossPromise) {
		bossPromise = (async () => {
			const boss = new PgBoss({
				connectionString: env.DATABASE_URL,
				supervise: role === "worker",
				schedule: role === "worker",
			});
			boss.on("error", (error) => console.error("[jobs]", error));
			await boss.start();
			await ensureQueues(boss);
			return boss;
		})().catch((error) => {
			bossPromise = null;
			throw error;
		});
	}
	return bossPromise;
}

/**
 * Queues invitation emails. Pass the caller's Drizzle transaction as `tx` so the
 * jobs commit or roll back with it (transactional outbox, pg-boss `fromDrizzle`).
 */
export async function enqueueInvitationEmails(
	jobs: GroupInvitationEmailPayload[],
	opts: { tx?: Parameters<typeof fromDrizzle>[0] } = {},
): Promise<void> {
	if (jobs.length === 0) {
		return;
	}
	const boss = await getBoss();
	// One INSERT for the whole batch (inside the caller's transaction when given).
	await boss.insert(
		QUEUE_GROUP_INVITATION_EMAIL,
		jobs.map((job) => ({
			data: job,
			singletonKey: job.memberId,
			retryLimit: 3,
			retryBackoff: true,
		})),
		opts.tx ? { db: fromDrizzle(opts.tx, sql) } : undefined,
	);
}

/**
 * Queues transactional e-mails with retries. Pass the caller's Drizzle transaction
 * as `tx` so the jobs commit or roll back with the data that caused them.
 */
export async function enqueueEmails(
	jobs: EmailJob[],
	opts: { tx?: Parameters<typeof fromDrizzle>[0] } = {},
): Promise<void> {
	if (jobs.length === 0) {
		return;
	}
	const boss = await getBoss();
	await boss.insert(
		QUEUE_EMAILS,
		jobs.map((job) => ({ data: job, retryLimit: 3, retryBackoff: true })),
		opts.tx ? { db: fromDrizzle(opts.tx, sql) } : undefined,
	);
}

/**
 * Starts the pg-boss producer ahead of time (called from the web server entry),
 * so the first send doesn't run pg-boss start-up inside a request transaction.
 */
export async function warmUpJobQueue(): Promise<void> {
	await getBoss();
}
