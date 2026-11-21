import {
	getProfile,
	type Profile,
	updateProfile,
} from "@repo/db/queries/users";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { protectedActionFn } from "../procedures";
import { authMiddleware } from "./middleware";

export const fetchProfileServer = createServerFn({ method: "GET" })
	.middleware([authMiddleware])
	.handler(
		async ({ context }): Promise<Profile | null> => getProfile(context.user.id),
	);

export const profileQueryOptions = queryOptions({
	queryKey: ["profile"] as const,
	queryFn: () => fetchProfileServer(),
});

const updateProfileSchema = z.object({
	name: z.string().trim().min(1).max(120),
	locale: z.enum(["pl", "en"]),
});

/** The signed-in person's name and language (their e-mails follow it). */
export const updateProfileServer = protectedActionFn
	.validator((input: unknown) => updateProfileSchema.parse(input))
	.handler(async ({ data, context }) => updateProfile(context.user.id, data));
