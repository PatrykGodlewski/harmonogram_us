import { env } from "@repo/env";
import { z } from "zod";

/** Policy "short" + singletonKey=memberId: at most one queued send per member. */
export const QUEUE_GROUP_INVITATION_EMAIL = "group-invitations";
export const QUEUE_CLOSE_EXPIRED_GROUPS = "close-expired-groups";
/** Daily clean-up of rate-limit counters (they hold e-mails and IPs). */
export const QUEUE_PRUNE_RATE_LIMITS = "prune-rate-limits";
export const PRUNE_RATE_LIMITS_CRON = "15 3 * * *";
/** Transactional e-mails (verification, registration), retried on failure. */
export const QUEUE_EMAILS = "emails";

/** Every 5 minutes, in the installation time zone. */
export const CLOSE_EXPIRED_GROUPS_CRON = "*/5 * * * *";
export const JOBS_TIME_ZONE = env.APP_TIME_ZONE;

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
		change: z.enum(["confirmed", "waitlisted", "promoted"]),
	}),
]);

export type EmailJob = z.infer<typeof emailJob>;

export const QUEUES = [
	{ name: QUEUE_GROUP_INVITATION_EMAIL, policy: "short" },
	{ name: QUEUE_CLOSE_EXPIRED_GROUPS, policy: "standard" },
	{ name: QUEUE_EMAILS, policy: "standard" },
	{ name: QUEUE_PRUNE_RATE_LIMITS, policy: "standard" },
] as const;
