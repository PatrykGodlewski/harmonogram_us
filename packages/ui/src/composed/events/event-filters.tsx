import { eventFilterOptionsQueryOptions } from "@repo/api/events/queries";
import type { EventSearch } from "@repo/api/events/schemas";
import { filter_search_placeholder } from "@repo/i18n/paraglide/messages";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Input } from "../../components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../../components/select";
import { Skeleton } from "../../components/skeleton";
import { EventErrorAlert } from "./event-error-alert";
import { FILTER_SELECTS, filterValue } from "./filter-selects";

const panelClass =
	"flex flex-col gap-4 rounded-xl border bg-card p-4 text-card-foreground shadow-sm";

export type EventFiltersProps = {
	search: EventSearch;
	onSearchChange: (
		updater: (prev: EventSearch) => EventSearch,
		options?: { replace?: boolean },
	) => void;
};

export function EventFilters({ search, onSearchChange }: EventFiltersProps) {
	const optionsQuery = useQuery(eventFilterOptionsQueryOptions);
	const [searchInput, setSearchInput] = useState(search.search ?? "");
	const loading = !optionsQuery.data && optionsQuery.isPending;

	useEffect(() => setSearchInput(search.search ?? ""), [search.search]);

	useEffect(() => {
		const timer = setTimeout(() => {
			const next = searchInput.trim();
			if ((search.search ?? "") !== next) {
				onSearchChange((prev) => ({ ...prev, search: next || undefined }), {
					replace: true,
				});
			}
		}, 300);
		return () => clearTimeout(timer);
	}, [onSearchChange, search.search, searchInput]);

	return (
		<div className={panelClass}>
			{optionsQuery.isError ? (
				<EventErrorAlert error={optionsQuery.error} />
			) : null}
			<Input
				placeholder={filter_search_placeholder()}
				value={searchInput}
				onChange={(e) => setSearchInput(e.target.value)}
				disabled={loading || optionsQuery.isError}
			/>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{loading || optionsQuery.isError
					? FILTER_SELECTS.map(({ id }) => (
							<Skeleton key={id} className="h-9 w-full" />
						))
					: FILTER_SELECTS.map(({ id, placeholder, getOptions }) => (
							<Select
								key={id}
								value={filterValue(search, id)}
								onValueChange={(value) =>
									onSearchChange((prev) => ({ ...prev, [id]: value }))
								}
							>
								<SelectTrigger className="w-full bg-background">
									<SelectValue placeholder={placeholder()} />
								</SelectTrigger>
								<SelectContent>
									{getOptions(optionsQuery.data).map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						))}
			</div>
		</div>
	);
}
