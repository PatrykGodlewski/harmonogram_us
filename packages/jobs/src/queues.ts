import { env as clientEnv } from "@repo/env/client";
import type { Queue } from "pg-boss";
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
export const QUEUE_SURVEY_EMAILS = "survey-emails";
/** Deletes bucket objects of removed event files (F14), every 15 minutes. */
export const QUEUE_DELETE_STORED_FILES = "delete-stored-files";
export const DELETE_STORED_FILES_CRON = "*/15 * * * *";
export const SURVEY_EMAILS_CRON = "*/15 * * * *";
/**
 * Generates an event's cover image. Policy "stately" + singletonKey=eventId: at most one
 * queued and one running job per event (the job reads the event's current text).
 */
export const QUEUE_EVENT_IMAGES = "event-images";
/**
 * Event-image jobs pg-boss failed (the handler threw, the job timed out, or a worker shutdown
 * cut it off); the worker marks their covers failed.
 */
export const QUEUE_EVENT_IMAGES_DEAD = "event-images-dead";
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
		kind: z.literal("guest-confirmation"),
		to: z.email(),
		url: z.url(),
		eventTitle: z.string(),
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
			"survey",
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

/** `force`: a new image even when the current one matches the event's text. */
export const eventImageJob = z.object({
	eventId: z.string().min(1),
	force: z.boolean(),
});

export type EventImageJob = z.infer<typeof eventImageJob>;

export const QUEUES = [
	{ name: QUEUE_GROUP_INVITATION_EMAIL, policy: "short" },
	{ name: QUEUE_CLOSE_EXPIRED_GROUPS, policy: "standard" },
	{ name: QUEUE_EMAILS, policy: "standard" },
	{ name: QUEUE_PRUNE_RATE_LIMITS, policy: "standard" },
	{ name: QUEUE_PRUNE_OLD_REGISTRATIONS, policy: "standard" },
	{ name: QUEUE_EVENT_REMINDERS, policy: "standard" },
	{ name: QUEUE_CERTIFICATE_EMAILS, policy: "standard" },
	{ name: QUEUE_SURVEY_EMAILS, policy: "standard" },
	{ name: QUEUE_DELETE_STORED_FILES, policy: "standard" },
	// Before QUEUE_EVENT_IMAGES: a dead-letter queue must exist before a queue names it.
	// Retries are free here (no image is generated), unlike event-images, so they can outlast a
	// short database outage.
	{
		name: QUEUE_EVENT_IMAGES_DEAD,
		policy: "standard",
		retryLimit: 3,
		retryDelay: 60,
	},
	{
		name: QUEUE_EVENT_IMAGES,
		policy: "stately",
		deadLetter: QUEUE_EVENT_IMAGES_DEAD,
		// A run takes at most 2-3 minutes; an active job older than this has lost its worker.
		expireInSeconds: 5 * 60,
	},
] as const satisfies readonly Queue[];
