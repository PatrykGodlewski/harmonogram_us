import { checkInByTicketCode, setCheckedIn } from "@repo/db/queries/check-in";
import { z } from "zod";
import { assertCanCheckIn } from "../auth/event-access";
import { panelActionFn } from "../auth/panel-middleware";
import { withDomainErrors } from "../errors";

export type { CheckInResult } from "@repo/db/queries/check-in";

const checkInSchema = z.object({
	eventId: z.string().min(1),
	ticketCode: z.string().min(1).max(200),
});

const setCheckedInSchema = z.object({
	eventId: z.string().min(1),
	registrationId: z.string().min(1),
	checkedIn: z.boolean(),
});

export const checkInServer = panelActionFn
	.inputValidator((input: unknown) => checkInSchema.parse(input))
	.handler(async ({ data, context }) => {
		await assertCanCheckIn(context.user, data.eventId);
		return withDomainErrors(() =>
			checkInByTicketCode(data.eventId, data.ticketCode),
		);
	});

export const setCheckedInServer = panelActionFn
	.inputValidator((input: unknown) => setCheckedInSchema.parse(input))
	.handler(async ({ data, context }) => {
		await assertCanCheckIn(context.user, data.eventId);
		await withDomainErrors(() =>
			setCheckedIn(data.eventId, data.registrationId, data.checkedIn),
		);
		return { ok: true };
	});
