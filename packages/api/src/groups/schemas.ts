import { z } from "zod";

const idSchema = z.string().min(1);

export const createGroupSchema = z.object({
	eventId: idSchema,
	places: z.number().int().min(1).max(500),
	itemIds: z.array(idSchema).max(100),
	name: z.string().trim().max(120).nullable().optional(),
	emails: z.array(z.email()).max(500),
	joinLinkEnabled: z.boolean(),
});

export const groupIdSchema = z.object({ groupId: idSchema });
export const memberIdSchema = z.object({ memberId: idSchema });

export const inviteToGroupSchema = z.object({
	groupId: idSchema,
	emails: z.array(z.email()).min(1).max(500),
});

export const setMemberItemsSchema = z.object({
	memberId: idSchema,
	itemIds: z.array(idSchema).max(100),
});

export const updateGroupSchema = z.object({
	groupId: idSchema,
	places: z.number().int().min(1).max(500).optional(),
	name: z.string().trim().max(120).nullable().optional(),
	itemIds: z.array(idSchema).max(100).optional(),
	joinLink: z.enum(["enable", "disable", "regenerate"]).optional(),
});

export const joinCodeSchema = z.object({ code: z.string().min(1).max(64) });

export const joinGroupSchema = z.object({
	code: z.string().min(1).max(64),
	email: z.email(),
	turnstileToken: z.string().max(4096).optional(),
});

export const invitationTokenSchema = z.object({
	token: z.string().min(1).max(128),
});

export type CreateGroupParams = z.infer<typeof createGroupSchema>;
export type UpdateGroupParams = z.infer<typeof updateGroupSchema>;
