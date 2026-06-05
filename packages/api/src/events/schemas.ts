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

export const createEventSchema = z.object({
	id: optionalIdSchema,
	title: z.string().min(1).max(500),
	date: z.coerce.date(),
	maxSeats: z.number().int().min(0),
	typeId: z.string().min(1),
	locationId: z.string().min(1).nullable().optional(),
	facultyId: z.string().min(1).nullable().optional(),
});

export type CreateEventParams = z.infer<typeof createEventSchema>;

export const updateEventSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1).max(500).optional(),
	date: z.coerce.date().optional(),
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
