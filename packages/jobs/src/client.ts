import { env } from "@repo/env";
import { sql } from "drizzle-orm";
import { fromDrizzle, PgBoss } from "pg-boss";
import {
	type GroupInvitationEmailPayload,
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

/** One long-lived pg-boss instance per process (pg-boss docs). Creates queues on first use. */
export function getBoss(): Promise<PgBoss> {
	if (!bossPromise) {
		bossPromise = (async () => {
			const boss = new PgBoss(env.DATABASE_URL);
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
	const db = opts.tx ? fromDrizzle(opts.tx, sql) : undefined;
	for (const job of jobs) {
		await boss.send(QUEUE_GROUP_INVITATION_EMAIL, job, {
			retryLimit: 3,
			retryBackoff: true,
			singletonKey: job.memberId,
			...(db ? { db } : {}),
		});
	}
}
