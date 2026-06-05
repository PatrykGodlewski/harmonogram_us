import type { EventFilterOptions, EventSearch } from "@repo/api/events/schemas";
import {
	filter_all_faculties,
	filter_all_locations,
	filter_all_types,
	filter_faculty_placeholder,
	filter_location_placeholder,
	filter_sort_asc,
	filter_sort_desc,
	filter_sort_placeholder,
	filter_type_placeholder,
} from "@repo/i18n/paraglide/messages";

export type FilterSelectConfig = {
	id: "sortOrder" | "locationFilter" | "facultyFilter" | "eventTypeFilter";
	placeholder: () => string;
	getOptions: (
		options: EventFilterOptions,
	) => Array<{ value: string; label: string }>;
};

export const FILTER_SELECTS: FilterSelectConfig[] = [
	{
		id: "sortOrder",
		placeholder: filter_sort_placeholder,
		getOptions: () => [
			{ value: "asc", label: filter_sort_asc() },
			{ value: "desc", label: filter_sort_desc() },
		],
	},
	{
		id: "locationFilter",
		placeholder: filter_location_placeholder,
		getOptions: (o) => [
			{ value: "all", label: filter_all_locations() },
			...o.locations.map((x) => ({ value: x.slug, label: x.label })),
		],
	},
	{
		id: "facultyFilter",
		placeholder: filter_faculty_placeholder,
		getOptions: (o) => [
			{ value: "all", label: filter_all_faculties() },
			...o.faculties.map((x) => ({ value: x.slug, label: x.label })),
		],
	},
	{
		id: "eventTypeFilter",
		placeholder: filter_type_placeholder,
		getOptions: (o) => [
			{ value: "all", label: filter_all_types() },
			...o.types.map((x) => ({ value: x.slug, label: x.label })),
		],
	},
];

export function filterValue(search: EventSearch, id: FilterSelectConfig["id"]) {
	if (id === "sortOrder") return search.sortOrder ?? "desc";
	return search[id] ?? "all";
}
