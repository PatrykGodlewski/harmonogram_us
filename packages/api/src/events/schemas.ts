import { z } from "zod";
import { optionalIdSchema } from "../admin/optional-id-schema";

/** Events per "show more" step on the public list, and the most one request may ask for. */
export const EVENT_PAGE_SIZE = 20;
export const EVENT_PAGE_MAX = 200;

/** "Next N days" from the start of today in the installation time zone. */
const whenFilterSchema = z.enum(["all", "today", "7d", "30d"]);
const modeFilterSchema = z.enum(["all", "onsite", "online", "hybrid"]);

export const eventFiltersSchema = z.object({
	limit: z.number().int().min(1).max(EVENT_PAGE_MAX).default(EVENT_PAGE_SIZE),
	search: z.string().max(200).optional(),
	sortOrder: z.enum(["asc", "desc"]).default("desc"),
	locationFilter: z.string().optional(),
	facultyFilter: z.string().optional(),
	eventTypeFilter: z.string().optional(),
	whenFilter: whenFilterSchema.optional(),
	modeFilter: modeFilterSchema.optional(),
});

export type EventFiltersParams = z.infer<typeof eventFiltersSchema>;

export const eventSearchSchema = z.object({
	limit: z.coerce
		.number()
		.int()
		.min(1)
		.max(EVENT_PAGE_MAX)
		.optional()
		.catch(undefined),
	// The router parses `?search=2026` as a number: read it back as text.
	search: z.coerce.string().max(200).optional(),
	sortOrder: z.enum(["asc", "desc"]).optional().catch("desc"),
	locationFilter: z.string().optional().catch("all"),
	facultyFilter: z.string().optional().catch("all"),
	eventTypeFilter: z.string().optional().catch("all"),
	whenFilter: whenFilterSchema.optional().catch("all"),
	modeFilter: modeFilterSchema.optional().catch("all"),
});

export type EventSearch = z.infer<typeof eventSearchSchema>;

export function toEventFiltersParams(search: EventSearch): EventFiltersParams {
	const filters: EventFiltersParams = {
		limit: search.limit ?? EVENT_PAGE_SIZE,
		sortOrder: search.sortOrder ?? "desc",
		locationFilter: search.locationFilter ?? "all",
		facultyFilter: search.facultyFilter ?? "all",
		eventTypeFilter: search.eventTypeFilter ?? "all",
		whenFilter: search.whenFilter ?? "all",
		modeFilter: search.modeFilter ?? "all",
	};
	if (search.search) {
		filters.search = search.search;
	}
	return filters;
}

const descriptionSchema = z.string().max(5000).nullable().optional();

/** Meeting links must be https (they are shown as clickable links). */
const onlineUrlSchema = z
	.url({ protocol: /^https$/ })
	.max(2000)
	.nullable()
	.optional();
const attendanceModeSchema = z.enum(["onsite", "online", "hybrid"]);
const visibilitySchema = z.enum(["public", "authenticated", "private"]);

/** An optional line on the certificate (null clears it). */
const certificateTextSchema = z.string().trim().max(200).nullable().optional();

/** Answers by question id; bounded, and checked against the event's questions on the server. */
export const answersSchema = z
	.record(z.string().max(64), z.string().max(2000))
	.refine((answers) => Object.keys(answers).length <= 100);

/** The secret of an invite link (`?invite=`), as the URL carries it. */
export const inviteSchema = z.string().min(1).max(128).optional();
/** The reminder choices the form offers (hours before the start); null switches it off. */
const reminderHoursSchema = z
	.union([z.literal(1), z.literal(24), z.literal(48)])
	.nullable()
	.optional();
/** A typed room; blank means none. */
const roomSchema = z
	.string()
	.trim()
	.max(100)
	.transform((value) => value || null)
	.nullable()
	.optional();

export const createEventSchema = z.object({
	id: optionalIdSchema,
	title: z.string().min(1).max(500),
	description: descriptionSchema,
	date: z.coerce.date(),
	endsAt: z.coerce.date().nullable().optional(),
	maxSeats: z.number().int().min(0),
	groupDeadlineHours: z.number().int().min(0).max(720).optional(),
	typeId: z.string().min(1),
	locationId: z.string().min(1).nullable().optional(),
	facultyId: z.string().min(1).nullable().optional(),
	onlineUrl: onlineUrlSchema,
	attendanceMode: attendanceModeSchema.optional(),
	visibility: visibilitySchema.optional(),
	room: roomSchema,
	reminderHoursBefore: reminderHoursSchema,
	requiresApproval: z.boolean().optional(),
	certificatesEnabled: z.boolean().optional(),
	certificateIssuer: certificateTextSchema,
	certificateSigner: certificateTextSchema,
	certificateNote: certificateTextSchema,
});

export type CreateEventParams = z.infer<typeof createEventSchema>;

export const updateEventSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1).max(500).optional(),
	description: descriptionSchema,
	date: z.coerce.date().optional(),
	endsAt: z.coerce.date().nullable().optional(),
	maxSeats: z.number().int().min(0).optional(),
	groupDeadlineHours: z.number().int().min(0).max(720).optional(),
	typeId: z.string().min(1).optional(),
	locationId: z.string().min(1).nullable().optional(),
	facultyId: z.string().min(1).nullable().optional(),
	onlineUrl: onlineUrlSchema,
	attendanceMode: attendanceModeSchema.optional(),
	visibility: visibilitySchema.optional(),
	room: roomSchema,
	reminderHoursBefore: reminderHoursSchema,
	requiresApproval: z.boolean().optional(),
	certificatesEnabled: z.boolean().optional(),
	certificateIssuer: certificateTextSchema,
	certificateSigner: certificateTextSchema,
	certificateNote: certificateTextSchema,
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

export const eventPageSchema = eventIdSchema.extend({ invite: inviteSchema });

export const agendaItemIdSchema = z.object({ agendaItemId: z.string().min(1) });

const agendaItemFields = {
	title: z.string().min(1).max(500),
	description: descriptionSchema,
	startsAt: z.coerce.date(),
	endsAt: z.coerce.date(),
	locationId: z.string().min(1).nullable().optional(),
	maxSeats: z.number().int().min(0).nullable().optional(),
	requiresRegistration: z.boolean().optional(),
	speakers: z
		.array(
			z.object({
				name: z.string().trim().min(1).max(200),
				affiliation: z.string().trim().max(200).optional(),
			}),
		)
		.max(20)
		.optional(),
	materials: z
		.array(
			z.object({
				label: z.string().trim().min(1).max(200),
				url: z.url({ protocol: /^https?$/ }).max(2000),
			}),
		)
		.max(20)
		.optional(),
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
