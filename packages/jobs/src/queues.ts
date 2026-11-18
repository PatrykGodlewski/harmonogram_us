import { z } from "zod";

export const QUEUE_GROUP_INVITATION_EMAIL = "group-invitation-email";
export const QUEUE_CLOSE_EXPIRED_GROUPS = "close-expired-groups";

/** Every 5 minutes, Warsaw time. */
export const CLOSE_EXPIRED_GROUPS_CRON = "*/5 * * * *";
export const JOBS_TIME_ZONE = "Europe/Warsaw";

export const groupInvitationEmailPayload = z.object({
	memberId: z.string().min(1),
	locale: z.enum(["pl", "en"]),
});

export type GroupInvitationEmailPayload = z.infer<
	typeof groupInvitationEmailPayload
>;

export const QUEUES = [
	QUEUE_GROUP_INVITATION_EMAIL,
	QUEUE_CLOSE_EXPIRED_GROUPS,
] as const;
