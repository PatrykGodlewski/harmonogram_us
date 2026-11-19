import { env } from "@repo/env";
import { z } from "zod";

/** Policy "short" + singletonKey=memberId: at most one queued send per member. */
export const QUEUE_GROUP_INVITATION_EMAIL = "group-invitations";
export const QUEUE_CLOSE_EXPIRED_GROUPS = "close-expired-groups";

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

export const QUEUES = [
	{ name: QUEUE_GROUP_INVITATION_EMAIL, policy: "short" },
	{ name: QUEUE_CLOSE_EXPIRED_GROUPS, policy: "standard" },
] as const;
