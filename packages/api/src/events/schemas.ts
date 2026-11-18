import { z } from "zod";
import { optionalIdSchema } from "../admin/optional-id-schema";

export const eventFiltersSchema = z.object({
	search: z.string().max(200).optional(),
	sortOrder: z.enum(["asc", "desc"]).default("desc"),
	locationFilter: z.string().optional(),
	facultyFilter: z.string().optional(),
	eventTypeFilter: z.string().optional(),
});

export type EventFiltersParams = z.infer<typeof eventFiltersSchema>;

export const eventSearchSchema = z.object({
	search: z.string().max(200).optional(),
	sortOrder: z.enum(["asc", "desc"]).optional().catch("desc"),
	locationFilter: z.string().optional().catch("all"),
	facultyFilter: z.string().optional().catch("all"),
	eventTypeFilter: z.string().optional().catch("all"),
});

export type EventSearch = z.infer<typeof eventSearchSchema>;

export function toEventFiltersParams(search: EventSearch): EventFiltersParams {
	const filters: EventFiltersParams = {
		sortOrder: search.sortOrder ?? "desc",
		locationFilter: search.locationFilter ?? "all",
		facultyFilter: search.facultyFilter ?? "all",
		eventTypeFilter: search.eventTypeFilter ?? "all",
	};
	if (search.search) {
		filters.search = search.search;
	}
	return filters;
}

const descriptionSchema = z.string().max(5000).nullable().optional();

export const createEventSchema = z.object({
	id: optionalIdSchema,
	title: z.string().min(1).max(500),
	description: descriptionSchema,
	date: z.coerce.date(),
	endsAt: z.coerce.date().nullable().optional(),
	maxSeats: z.number().int().min(0),
	typeId: z.string().min(1),
	locationId: z.string().min(1).nullable().optional(),
	facultyId: z.string().min(1).nullable().optional(),
});

export type CreateEventParams = z.infer<typeof createEventSchema>;

export const updateEventSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1).max(500).optional(),
	description: descriptionSchema,
	date: z.coerce.date().optional(),
	endsAt: z.coerce.date().nullable().optional(),
	maxSeats: z.number().int().min(0).optional(),
	typeId: z.string().min(1).optional(),
	locationId: z.string().min(1).nullable().optional(),
	facultyId: z.string().min(1).nullable().optional(),
});

export type UpdateEventParams = z.infer<typeof updateEventSchema>;

export type FilterOption = {
	id: string;
	slug: string;
	label: string;
};

export type EventFilterOptions = {
	types: FilterOption[];
	locations: FilterOption[];
	faculties: FilterOption[];
};

export const eventIdSchema = z.object({ eventId: z.string().min(1) });

export const agendaItemIdSchema = z.object({ agendaItemId: z.string().min(1) });

const agendaItemFields = {
	title: z.string().min(1).max(500),
	description: descriptionSchema,
	startsAt: z.coerce.date(),
	endsAt: z.coerce.date(),
	locationId: z.string().min(1).nullable().optional(),
	maxSeats: z.number().int().min(0).nullable().optional(),
	requiresRegistration: z.boolean().optional(),
};

const endsAfterStarts = (value: { startsAt?: Date; endsAt?: Date }) =>
	!value.startsAt || !value.endsAt || value.endsAt > value.startsAt;

export const createAgendaItemSchema = z
	.object({ eventId: z.string().min(1), ...agendaItemFields })
	.refine(endsAfterStarts, { message: "END_BEFORE_START", path: ["endsAt"] });

export const updateAgendaItemSchema = z
	.object({ id: z.string().min(1), ...agendaItemFields })
	.partial({
		title: true,
		startsAt: true,
		endsAt: true,
	})
	.refine(endsAfterStarts, { message: "END_BEFORE_START", path: ["endsAt"] });

export type CreateAgendaItemParams = z.infer<typeof createAgendaItemSchema>;
export type UpdateAgendaItemParams = z.infer<typeof updateAgendaItemSchema>;
