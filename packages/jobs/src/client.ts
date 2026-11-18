import { env } from "@repo/env";
import { PgBoss } from "pg-boss";
import {
	type GroupInvitationEmailPayload,
	QUEUE_GROUP_INVITATION_EMAIL,
	QUEUES,
} from "./queues";

/** Creates any missing queues (required before send/work in pg-boss ≥ 10). */
export async function ensureQueues(boss: PgBoss): Promise<void> {
	for (const queue of QUEUES) {
		if (!(await boss.getQueue(queue))) {
			await boss.createQueue(queue);
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

export async function enqueueInvitationEmails(
	jobs: GroupInvitationEmailPayload[],
): Promise<void> {
	if (jobs.length === 0) {
		return;
	}
	const boss = await getBoss();
	await Promise.all(
		jobs.map((job) =>
			boss.send(QUEUE_GROUP_INVITATION_EMAIL, job, {
				retryLimit: 3,
				retryBackoff: true,
			}),
		),
	);
}
