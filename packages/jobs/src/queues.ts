import { env as clientEnv } from "@repo/env/client";
import { z } from "zod";

/** Policy "short" + singletonKey=memberId: at most one queued send per member. */
export const QUEUE_GROUP_INVITATION_EMAIL = "group-invitations";
export const QUEUE_CLOSE_EXPIRED_GROUPS = "close-expired-groups";
/** Daily clean-up of rate-limit counters (they hold e-mails and IPs). */
export const QUEUE_PRUNE_RATE_LIMITS = "prune-rate-limits";
export const PRUNE_RATE_LIMITS_CRON = "15 3 * * *";
/** Transactional e-mails (verification, registration), retried on failure. */
export const QUEUE_EMAILS = "emails";
/** Daily deletion of registrations past the retention period (GDPR). */
export const QUEUE_PRUNE_OLD_REGISTRATIONS = "prune-old-registrations";
export const PRUNE_OLD_REGISTRATIONS_CRON = "30 3 * * *";
/** "Your certificate is ready" e-mails after events, checked every 15 minutes. */
export const QUEUE_CERTIFICATE_EMAILS = "certificate-emails";
export const CERTIFICATE_EMAILS_CRON = "*/15 * * * *";
/** Reminders before events, checked every 5 minutes. */
export const QUEUE_EVENT_REMINDERS = "event-reminders";
export const EVENT_REMINDERS_CRON = "*/5 * * * *";

/** Every 5 minutes, in the installation time zone. */
export const CLOSE_EXPIRED_GROUPS_CRON = "*/5 * * * *";
/** Cron schedules run in the installation time zone (the same value the UI uses). */
export const JOBS_TIME_ZONE = clientEnv.VITE_APP_TIME_ZONE;

export const groupInvitationEmailPayload = z.object({
	memberId: z.string().min(1),
	locale: z.enum(["pl", "en"]),
});

export type GroupInvitationEmailPayload = z.infer<
	typeof groupInvitationEmailPayload
>;

export const emailJob = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("verification"),
		to: z.email(),
		url: z.url(),
		locale: z.enum(["pl", "en"]),
	}),
	z.object({
		kind: z.literal("registration"),
		registrationId: z.string().min(1),
		change: z.enum([
			"confirmed",
			"waitlisted",
			"promoted",
			"cancelled",
			"reminder",
			"pending",
			"rejected",
			"certificate",
		]),
	}),
	z.object({
		kind: z.literal("event-changed"),
		registrationId: z.string().min(1),
		before: z.object({ date: z.iso.datetime(), place: z.string().nullable() }),
		after: z.object({ date: z.iso.datetime(), place: z.string().nullable() }),
	}),
	z.object({
		kind: z.literal("event-invitation"),
		to: z.email(),
		eventId: z.string().min(1),
		locale: z.enum(["pl", "en"]),
		/** The organiser's own words; a default text when absent. */
		note: z.string().max(2000).optional(),
		replyTo: z.email(),
	}),
	z.object({
		kind: z.literal("event-message"),
		registrationId: z.string().min(1),
		subject: z.string().min(1).max(200),
		body: z.string().min(1).max(5000),
		replyTo: z.email(),
	}),
]);

export type EmailJob = z.infer<typeof emailJob>;

export const QUEUES = [
	{ name: QUEUE_GROUP_INVITATION_EMAIL, policy: "short" },
	{ name: QUEUE_CLOSE_EXPIRED_GROUPS, policy: "standard" },
	{ name: QUEUE_EMAILS, policy: "standard" },
	{ name: QUEUE_PRUNE_RATE_LIMITS, policy: "standard" },
	{ name: QUEUE_PRUNE_OLD_REGISTRATIONS, policy: "standard" },
	{ name: QUEUE_EVENT_REMINDERS, policy: "standard" },
	{ name: QUEUE_CERTIFICATE_EMAILS, policy: "standard" },
] as const;
