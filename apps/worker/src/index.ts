import { queueDueReminderEmails } from "@repo/api/notifications/reminders";
import { pruneRateLimits } from "@repo/db/queries/rate-limits";
import { pruneOldRegistrations } from "@repo/db/queries/retention";
import { env } from "@repo/env";
import { getBoss } from "@repo/jobs/client";
import {
	CLOSE_EXPIRED_GROUPS_CRON,
	EVENT_REMINDERS_CRON,
	emailJob,
	groupInvitationEmailPayload,
	JOBS_TIME_ZONE,
	PRUNE_OLD_REGISTRATIONS_CRON,
	PRUNE_RATE_LIMITS_CRON,
	QUEUE_CLOSE_EXPIRED_GROUPS,
	QUEUE_EMAILS,
	QUEUE_EVENT_REMINDERS,
	QUEUE_GROUP_INVITATION_EMAIL,
	QUEUE_PRUNE_OLD_REGISTRATIONS,
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

await boss.work(QUEUE_PRUNE_OLD_REGISTRATIONS, async () => {
	const { deleted } = await pruneOldRegistrations(
		new Date(),
		env.REGISTRATION_RETENTION_DAYS,
	);
	console.log(`[worker] deleted ${deleted} registration(s) past retention`);
});

await boss.schedule(
	QUEUE_PRUNE_OLD_REGISTRATIONS,
	PRUNE_OLD_REGISTRATIONS_CRON,
	null,
	{ tz: JOBS_TIME_ZONE },
);

await boss.work(QUEUE_EVENT_REMINDERS, async () => {
	const { events } = await queueDueReminderEmails(new Date());
	if (events > 0) {
		console.log(`[worker] queued reminders for ${events} event(s)`);
	}
});

await boss.schedule(QUEUE_EVENT_REMINDERS, EVENT_REMINDERS_CRON, null, {
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
