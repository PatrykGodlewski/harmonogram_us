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

export const adminEventsQuerySchema = z.object({
	sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type AdminEventsQuery = z.infer<typeof adminEventsQuerySchema>;

export {
	createEventSchema,
	updateEventSchema,
} from "../events/schemas";
