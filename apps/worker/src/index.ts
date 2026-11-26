import { queueReadyCertificateEmails } from "@repo/api/notifications/certificates";
import { queueDueReminderEmails } from "@repo/api/notifications/reminders";
import { queueSurveyEmails } from "@repo/api/notifications/surveys";
import { pruneExpiredGuestRequests } from "@repo/db/queries/guest-requests";
import { pruneRateLimits } from "@repo/db/queries/rate-limits";
import { pruneOldRegistrations } from "@repo/db/queries/retention";
import { env } from "@repo/env";
import { getBoss } from "@repo/jobs/client";
import {
	CERTIFICATE_EMAILS_CRON,
	CLOSE_EXPIRED_GROUPS_CRON,
	DELETE_STORED_FILES_CRON,
	EVENT_REMINDERS_CRON,
	emailJob,
	groupInvitationEmailPayload,
	JOBS_TIME_ZONE,
	PRUNE_OLD_REGISTRATIONS_CRON,
	PRUNE_RATE_LIMITS_CRON,
	QUEUE_CERTIFICATE_EMAILS,
	QUEUE_CLOSE_EXPIRED_GROUPS,
	QUEUE_DELETE_STORED_FILES,
	QUEUE_EMAILS,
	QUEUE_EVENT_IMAGES,
	QUEUE_EVENT_IMAGES_DEAD,
	QUEUE_EVENT_REMINDERS,
	QUEUE_GROUP_INVITATION_EMAIL,
	QUEUE_PRUNE_OLD_REGISTRATIONS,
	QUEUE_PRUNE_RATE_LIMITS,
	QUEUE_SURVEY_EMAILS,
	SURVEY_EMAILS_CRON,
} from "@repo/jobs/queues";
import { closeExpired } from "./handlers/close-expired";
import { deleteStoredFiles } from "./handlers/delete-stored-files";
import { handleEventImageJob } from "./handlers/event-image";
import { handleDeadEventImageJob } from "./handlers/event-image-dead";
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

await boss.work(QUEUE_EVENT_IMAGES, async (jobs) => {
	for (const job of jobs) {
		const result = await handleEventImageJob(job.data);
		console.log(`[worker] event image ${job.id}: ${result}`);
	}
});

await boss.work(QUEUE_EVENT_IMAGES_DEAD, async (jobs) => {
	for (const job of jobs) {
		const result = await handleDeadEventImageJob(job.data);
		console.log(`[worker] dead event image ${job.id}: ${result}`);
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
	// Guest confirmation links nobody used (F17) carry names and addresses too.
	const guests = await pruneExpiredGuestRequests();
	console.log(`[worker] deleted ${guests} expired guest request(s)`);
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

await boss.work(QUEUE_CERTIFICATE_EMAILS, async () => {
	const { registrations } = await queueReadyCertificateEmails(new Date());
	if (registrations > 0) {
		console.log(`[worker] queued ${registrations} certificate e-mail(s)`);
	}
});

await boss.schedule(QUEUE_CERTIFICATE_EMAILS, CERTIFICATE_EMAILS_CRON, null, {
	tz: JOBS_TIME_ZONE,
});

await boss.work(QUEUE_SURVEY_EMAILS, async () => {
	const { registrations } = await queueSurveyEmails(new Date());
	if (registrations > 0) {
		console.log(`[worker] queued ${registrations} survey e-mail(s)`);
	}
});

await boss.schedule(QUEUE_SURVEY_EMAILS, SURVEY_EMAILS_CRON, null, {
	tz: JOBS_TIME_ZONE,
});

await boss.work(QUEUE_DELETE_STORED_FILES, async () => {
	const { deleted, failed } = await deleteStoredFiles();
	if (deleted > 0 || failed > 0) {
		console.log(
			`[worker] deleted ${deleted} stored file(s), ${failed} left for the next run`,
		);
	}
});

await boss.schedule(QUEUE_DELETE_STORED_FILES, DELETE_STORED_FILES_CRON, null, {
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
