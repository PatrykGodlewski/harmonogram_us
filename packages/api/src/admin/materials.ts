import {
	deleteEventFile,
	listEventFiles,
	setEventMaterialLinks,
} from "@repo/db/queries/event-files";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { assertCanManageEvent } from "../auth/event-access";
import { panelActionFn, panelQueryFn } from "../auth/panel-middleware";
import { withDomainErrors } from "../errors";
import { storeEventFile } from "../files/store";
import { storageConfig } from "../storage/s3";

export type { EventFile } from "@repo/db/queries/event-files";

const eventIdSchema = z.object({ eventId: z.string().min(1) });

/** Whether the panel offers uploads (the installation has storage set up). */
export const fetchFilesAvailableServer = panelQueryFn.handler(
	async () => storageConfig() !== null,
);

export const filesAvailableQueryOptions = queryOptions({
	queryKey: ["admin", "files-available"] as const,
	queryFn: () => fetchFilesAvailableServer(),
	staleTime: Number.POSITIVE_INFINITY,
});

export const fetchEventFilesServer = panelQueryFn
	.validator((input: unknown) => eventIdSchema.parse(input))
	.handler(async ({ data, context }) => {
		await assertCanManageEvent(context.user, data.eventId);
		return listEventFiles(data.eventId);
	});

export const eventFilesQueryOptions = (eventId: string) =>
	queryOptions({
		queryKey: ["admin", "event", eventId, "files"] as const,
		queryFn: () => fetchEventFilesServer({ data: { eventId } }),
	});

const uploadSchema = z.object({
	eventId: z.string().min(1),
	agendaItemId: z.string().min(1).optional(),
	file: z.instanceof(File),
});

/** FormData: `eventId`, optional `agendaItemId` (a programme item's file, F19), `file`. */
export const uploadEventFileServer = panelActionFn
	.validator((input: unknown) => {
		if (!(input instanceof FormData)) {
			throw new Error("Expected FormData");
		}
		return uploadSchema.parse({
			eventId: input.get("eventId"),
			agendaItemId: input.get("agendaItemId") || undefined,
			file: input.get("file"),
		});
	})
	.handler(async ({ data, context }) => {
		await assertCanManageEvent(context.user, data.eventId);
		return withDomainErrors(() => storeEventFile(data));
	});

/** The object goes with the row (`stored_file_deletions`, worker). */
export const deleteEventFileServer = panelActionFn
	.validator((input: unknown) =>
		eventIdSchema.extend({ id: z.string().min(1) }).parse(input),
	)
	.handler(async ({ data, context }) => {
		await assertCanManageEvent(context.user, data.eventId);
		await deleteEventFile(data.eventId, data.id);
	});

const linksSchema = z
	.array(
		z.object({
			label: z.string().trim().min(1).max(200),
			url: z.url({ protocol: /^https?$/ }).max(2000),
		}),
	)
	.max(30);

/** Replaces the event's links (F14) with the given list. */
export const setEventMaterialLinksServer = panelActionFn
	.validator((input: unknown) =>
		eventIdSchema.extend({ links: linksSchema }).parse(input),
	)
	.handler(async ({ data, context }) => {
		await assertCanManageEvent(context.user, data.eventId);
		await setEventMaterialLinks(data.eventId, data.links);
	});
