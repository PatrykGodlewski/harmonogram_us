import {
	addEventMaterialLink,
	deleteEventFile,
	removeEventMaterialLink,
} from "@repo/db/queries/event-files";
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { assertCanManageEvent } from "../auth/event-access";
import { panelActionFn, panelQueryFn } from "../auth/panel-middleware";
import { appError, withDomainErrors } from "../errors";
import { storeEventFile } from "../files/store";
import { storageConfig } from "../storage/s3";

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
		if (!(await deleteEventFile(data.eventId, data.id))) {
			throw appError("NOT_FOUND");
		}
	});

const linkSchema = z.object({
	label: z.string().trim().min(1).max(200),
	url: z.url({ protocol: /^https?$/ }).max(2000),
});

/** Appends one link to the event's links (F14); EVENT_LINKS_LIMIT when full. */
export const addEventMaterialLinkServer = panelActionFn
	.validator((input: unknown) =>
		eventIdSchema.extend({ link: linkSchema }).parse(input),
	)
	.handler(async ({ data, context }) => {
		await assertCanManageEvent(context.user, data.eventId);
		await withDomainErrors(() => addEventMaterialLink(data.eventId, data.link));
	});

/**
 * Removes the link shown at `index`. `removed: false` when someone changed the
 * list first: nothing is removed and the caller refreshes.
 */
export const removeEventMaterialLinkServer = panelActionFn
	.validator((input: unknown) =>
		eventIdSchema
			.extend({ index: z.number().int().nonnegative(), link: linkSchema })
			.parse(input),
	)
	.handler(async ({ data, context }) => {
		await assertCanManageEvent(context.user, data.eventId);
		return {
			removed: await removeEventMaterialLink(
				data.eventId,
				data.index,
				data.link,
			),
		};
	});
