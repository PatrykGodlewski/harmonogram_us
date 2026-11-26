/** The organizer's request for a new cover image in the panel. */
import { regenerateEventImage } from "@repo/api/event-images/regenerate";
import { assertCanManageEvent } from "../auth/event-access";
import { panelActionFn } from "../auth/panel-middleware";
import { eventIdActionSchema } from "./schemas";

export const regenerateEventImageServer = panelActionFn
	.validator((input: unknown) => eventIdActionSchema.parse(input))
	.handler(async ({ data, context }) => {
		await assertCanManageEvent(context.user, data.id);
		await regenerateEventImage(context.user, data.id);
	});
