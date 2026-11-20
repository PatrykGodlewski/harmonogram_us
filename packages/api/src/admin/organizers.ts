import {
	addEventOrganizer,
	listEventOrganizers,
	removeEventOrganizer,
} from "@repo/db/queries/event-organizers";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { assertCanManageEvent } from "../auth/event-access";
import { panelActionFn, panelQueryFn } from "../auth/panel-middleware";
import { withDomainErrors } from "../errors";
import { adminEventIdSchema } from "./schemas";

export type { EventOrganizer } from "@repo/db/queries/event-organizers";

const addOrganizerSchema = z.object({
	eventId: z.string().min(1),
	email: z.email().max(320),
	role: z.enum(["manager", "checkin"]).default("manager"),
});

const removeOrganizerSchema = z.object({
	eventId: z.string().min(1),
	userId: z.string().min(1),
});

export const fetchEventOrganizersServer = panelQueryFn
	.inputValidator((input: unknown) => adminEventIdSchema.parse(input))
	.handler(async ({ data, context }) => {
		await assertCanManageEvent(context.user, data.eventId);
		return listEventOrganizers(data.eventId);
	});

export const eventOrganizersQueryOptions = (eventId: string) =>
	queryOptions({
		queryKey: ["admin", "event", eventId, "organizers"] as const,
		queryFn: () => fetchEventOrganizersServer({ data: { eventId } }),
	});

export const addEventOrganizerServer = panelActionFn
	.inputValidator((input: unknown) => addOrganizerSchema.parse(input))
	.handler(async ({ data, context }) => {
		await assertCanManageEvent(context.user, data.eventId);
		return withDomainErrors(() =>
			addEventOrganizer(data.eventId, data.email, data.role),
		);
	});

export const removeEventOrganizerServer = panelActionFn
	.inputValidator((input: unknown) => removeOrganizerSchema.parse(input))
	.handler(async ({ data, context }) => {
		await assertCanManageEvent(context.user, data.eventId);
		await withDomainErrors(() =>
			removeEventOrganizer(data.eventId, data.userId),
		);
		return { ok: true };
	});
