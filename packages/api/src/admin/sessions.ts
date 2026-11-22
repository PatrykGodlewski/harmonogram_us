import {
	copyAgendaSession,
	createAgendaSession,
	deleteAgendaSession,
	updateAgendaSession,
} from "@repo/db/queries/agenda-sessions";
import { AGENDA_SESSION_COLORS } from "@repo/db/schema/agenda";
import { z } from "zod";
import {
	assertCanManageAgendaSession,
	assertCanManageEvent,
} from "../auth/event-access";
import { panelActionFn } from "../auth/panel-middleware";
import { appError, withDomainErrors } from "../errors";

const sessionFields = {
	title: z.string().trim().min(1).max(200),
	description: z.string().trim().max(2000).nullable().optional(),
	color: z.enum(AGENDA_SESSION_COLORS).optional(),
	locationId: z.string().min(1).nullable().optional(),
	startsAt: z.coerce.date(),
	endsAt: z.coerce.date(),
};

const endsAfterStarts = (value: { startsAt?: Date; endsAt?: Date }) =>
	!value.startsAt || !value.endsAt || value.endsAt > value.startsAt;

const createSessionSchema = z
	.object({ eventId: z.string().min(1), ...sessionFields })
	.refine(endsAfterStarts, { message: "END_BEFORE_START", path: ["endsAt"] });

const updateSessionSchema = z
	.object({ id: z.string().min(1), ...sessionFields })
	.partial({ title: true, startsAt: true, endsAt: true })
	.refine(endsAfterStarts, { message: "END_BEFORE_START", path: ["endsAt"] });

const copySessionSchema = z.object({
	id: z.string().min(1),
	startsAt: z.coerce.date(),
	locationId: z.string().min(1).nullable().optional(),
	title: z.string().trim().min(1).max(200).optional(),
});

/** A session of the event's programme (F33). */
export const createAgendaSessionServer = panelActionFn
	.validator((input: unknown) => createSessionSchema.parse(input))
	.handler(async ({ data, context }) => {
		await assertCanManageEvent(context.user, data.eventId);
		return withDomainErrors(() => createAgendaSession(data));
	});

/** SESSION_ITEMS_OUTSIDE when the new times would leave items outside. */
export const updateAgendaSessionServer = panelActionFn
	.validator((input: unknown) => updateSessionSchema.parse(input))
	.handler(async ({ data, context }) => {
		await assertCanManageAgendaSession(context.user, data.id);
		const { id, ...values } = data;
		const session = await withDomainErrors(() =>
			updateAgendaSession(id, values),
		);
		if (!session) {
			throw appError("NOT_FOUND");
		}
		return session;
	});

/** Deletes the session with its programme. */
export const deleteAgendaSessionServer = panelActionFn
	.validator((input: unknown) =>
		z.object({ id: z.string().min(1) }).parse(input),
	)
	.handler(async ({ data, context }) => {
		await assertCanManageAgendaSession(context.user, data.id);
		const deleted = await deleteAgendaSession(data.id);
		if (!deleted) {
			throw appError("NOT_FOUND");
		}
		return deleted;
	});

/** An independent copy at another time (and, optionally, place and title). */
export const copyAgendaSessionServer = panelActionFn
	.validator((input: unknown) => copySessionSchema.parse(input))
	.handler(async ({ data, context }) => {
		await assertCanManageAgendaSession(context.user, data.id);
		const { id, ...options } = data;
		return withDomainErrors(() => copyAgendaSession(id, options));
	});
