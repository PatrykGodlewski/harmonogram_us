import { pruneRateLimits } from "@repo/db/queries/rate-limits";
import { getBoss } from "@repo/jobs/client";
import {
	CLOSE_EXPIRED_GROUPS_CRON,
	emailJob,
	groupInvitationEmailPayload,
	JOBS_TIME_ZONE,
	PRUNE_RATE_LIMITS_CRON,
	QUEUE_CLOSE_EXPIRED_GROUPS,
	QUEUE_EMAILS,
	QUEUE_GROUP_INVITATION_EMAIL,
	QUEUE_PRUNE_RATE_LIMITS,
} from "@repo/jobs/queues";
import { closeExpired } from "./handlers/close-expired";
import { handleEmailJob } from "./handlers/send-email";
import { sendInvitationEmail } from "./handlers/send-invitation";
import { EMAIL_WORK } from "./work-options";

const boss = await getBoss("worker");

await boss.work(QUEUE_GROUP_INVITATION_EMAIL, EMAIL_WORK, async (jobs) => {
	for (const job of jobs) {
		const result = await sendInvitationEmail(
			groupInvitationEmailPayload.parse(job.data),
		);
		console.log(`[worker] invitation ${job.id}: ${result}`);
	}
});

await boss.work(QUEUE_EMAILS, EMAIL_WORK, async (jobs) => {
	for (const job of jobs) {
		await handleEmailJob(emailJob.parse(job.data));
	}
});

await boss.work(QUEUE_CLOSE_EXPIRED_GROUPS, async () => {
	const closed = await closeExpired();
	if (closed > 0) {
		console.log(`[worker] closed ${closed} expired group(s)`);
	}
});

await boss.schedule(
	QUEUE_CLOSE_EXPIRED_GROUPS,
	CLOSE_EXPIRED_GROUPS_CRON,
	null,
	{
		tz: JOBS_TIME_ZONE,
	},
);

await boss.work(QUEUE_PRUNE_RATE_LIMITS, async () => {
	const pruned = await pruneRateLimits();
	console.log(`[worker] pruned ${pruned} rate-limit counter(s)`);
});

await boss.schedule(QUEUE_PRUNE_RATE_LIMITS, PRUNE_RATE_LIMITS_CRON, null, {
	tz: JOBS_TIME_ZONE,
});

console.log("[worker] worker started");

async function shutdown(signal: string) {
	console.log(`[worker] ${signal} received, stopping`);
	await boss.stop();
	process.exit(0);
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
