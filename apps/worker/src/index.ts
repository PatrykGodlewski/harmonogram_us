import { getBoss } from "@repo/jobs/client";
import {
	CLOSE_EXPIRED_GROUPS_CRON,
	groupInvitationEmailPayload,
	JOBS_TIME_ZONE,
	QUEUE_CLOSE_EXPIRED_GROUPS,
	QUEUE_GROUP_INVITATION_EMAIL,
} from "@repo/jobs/queues";
import { closeExpired } from "./handlers/close-expired";
import { sendInvitationEmail } from "./handlers/send-invitation";

const boss = await getBoss("worker");

await boss.work(QUEUE_GROUP_INVITATION_EMAIL, async (jobs) => {
	for (const job of jobs) {
		const result = await sendInvitationEmail(
			groupInvitationEmailPayload.parse(job.data),
		);
		console.log(`[worker] invitation ${job.id}: ${result}`);
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

console.log("[worker] worker started");

async function shutdown(signal: string) {
	console.log(`[worker] ${signal} received, stopping`);
	await boss.stop();
	process.exit(0);
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
