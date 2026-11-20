import { z } from "zod";
import { optionalIdSchema } from "./optional-id-schema";

export { formOptionalIdSchema, optionalIdSchema } from "./optional-id-schema";

export const lookupSchema = z.object({
	id: z.string().min(1).max(100),
	slug: z.string().min(1).max(100),
	label: z.string().min(1).max(200),
	sortOrder: z.number().int().min(0).default(0),
});

export const createLookupSchema = lookupSchema.extend({
	id: optionalIdSchema,
});

export const updateLookupSchema = z.object({
	id: z.string().min(1),
	slug: z.string().min(1).max(100).optional(),
	label: z.string().min(1).max(200).optional(),
	sortOrder: z.number().int().min(0).optional(),
});

export const deleteByIdSchema = z.object({
	id: z.string().min(1),
});

/** An action on one event (publish, cancel, delete). */
export const eventIdActionSchema = z.object({
	id: z.string().min(1),
});

/** Events per "show more" step in the panel list, and the most one request may ask for. */
export const ADMIN_EVENT_PAGE_SIZE = 50;
export const ADMIN_EVENT_PAGE_MAX = 500;

export const adminEventsQuerySchema = z.object({
	sortOrder: z.enum(["asc", "desc"]).default("desc"),
	limit: z
		.number()
		.int()
		.min(1)
		.max(ADMIN_EVENT_PAGE_MAX)
		.default(ADMIN_EVENT_PAGE_SIZE),
	search: z.string().trim().max(200).optional(),
});

export type AdminEventsQuery = z.infer<typeof adminEventsQuerySchema>;

export const adminEventIdSchema = z.object({ eventId: z.string().min(1) });

export {
	createAgendaItemSchema,
	createEventSchema,
	updateAgendaItemSchema,
	updateEventSchema,
} from "../events/schemas";
