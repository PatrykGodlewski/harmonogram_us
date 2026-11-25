/** A programme item's image in the panel (F18): upload with alt text, or remove. */
import { setAgendaItemImage } from "@repo/db/queries/agenda-items";
import { z } from "zod";
import { assertCanManageAgendaItem } from "../auth/event-access";
import { panelActionFn } from "../auth/panel-middleware";
import { withDomainErrors } from "../errors";
import { AGENDA_ITEM_LIMITS } from "../events/schemas";
import { storeAgendaItemImage } from "../files/item-image";

const itemImageSchema = z.object({
	agendaItemId: z.string().min(1),
	alt: z.string().trim().min(1).max(AGENDA_ITEM_LIMITS.imageAlt),
	file: z.instanceof(File),
});

/** FormData: `agendaItemId`, `alt` (what the image shows), `file` (F18). */
export const uploadAgendaItemImageServer = panelActionFn
	.validator((input: unknown) => {
		if (!(input instanceof FormData)) {
			throw new Error("Expected FormData");
		}
		return itemImageSchema.parse({
			agendaItemId: input.get("agendaItemId"),
			alt: input.get("alt"),
			file: input.get("file"),
		});
	})
	.handler(async ({ data, context }) => {
		await assertCanManageAgendaItem(context.user, data.agendaItemId);
		await withDomainErrors(() =>
			storeAgendaItemImage({
				itemId: data.agendaItemId,
				file: data.file,
				alt: data.alt,
			}),
		);
	});

/** The object is queued for deletion (trigger, worker). */
export const removeAgendaItemImageServer = panelActionFn
	.validator((input: unknown) =>
		z.object({ agendaItemId: z.string().min(1) }).parse(input),
	)
	.handler(async ({ data, context }) => {
		await assertCanManageAgendaItem(context.user, data.agendaItemId);
		await setAgendaItemImage(data.agendaItemId, null);
	});
