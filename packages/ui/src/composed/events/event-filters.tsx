import { eventFilterOptionsQueryOptions } from "@repo/api/events/queries";
import type { EventSearch } from "@repo/api/events/schemas";
import {
	filter_active,
	filter_clear_all,
	filter_clear_search,
	filter_remove,
	filter_search_placeholder,
	filter_toggle,
} from "@repo/i18n/paraglide/messages";
import { useQuery } from "@tanstack/react-query";
import { SearchIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "../../components/button";
import { Input } from "../../components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../../components/select";
import { Skeleton } from "../../components/skeleton";
import { cn } from "../../utils";
import { EventErrorAlert } from "./event-error-alert";
import { FILTER_SELECTS, filterValue } from "./filter-selects";

/** Typing pauses this long before the list reloads. */
const SEARCH_DEBOUNCE_MS = 300;

export type EventFiltersProps = {
	search: EventSearch;
	onSearchChange: (
		updater: (prev: EventSearch) => EventSearch,
		options?: { replace?: boolean },
	) => void;
};

/**
 * The search box keeps what the person types; the URL follows after a pause. A URL change
 * from elsewhere (back button, a shortcut link) replaces the box, the debounced write-back
 * of its own text does not — so a slow list never eats letters or a trailing space.
 */
function useDebouncedSearch(
	value: string | undefined,
	onCommit: (next: string | undefined) => void,
) {
	const [input, setInput] = useState(value ?? "");
	const committed = useRef(value ?? "");
	const commit = useRef(onCommit);
	commit.current = onCommit;

	useEffect(() => {
		if ((value ?? "") !== committed.current) {
			committed.current = value ?? "";
			setInput(value ?? "");
		}
	}, [value]);

	useEffect(() => {
		const next = input.trim();
		if (next === committed.current) return;
		const timer = setTimeout(() => {
			committed.current = next;
			commit.current(next || undefined);
		}, SEARCH_DEBOUNCE_MS);
		return () => clearTimeout(timer);
	}, [input]);

	const clear = () => {
		setInput("");
		committed.current = "";
		commit.current(undefined);
	};
	return { input, setInput, clear };
}

export function EventFilters({ search, onSearchChange }: EventFiltersProps) {
	const optionsQuery = useQuery(eventFilterOptionsQueryOptions);
	const loading = !optionsQuery.data && optionsQuery.isPending;
	const [open, setOpen] = useState(false);
	const panelId = useId();
	const { input, setInput, clear } = useDebouncedSearch(search.search, (next) =>
		onSearchChange((prev) => ({ ...prev, search: next }), { replace: true }),
	);

	const active = optionsQuery.data
		? FILTER_SELECTS.filter(({ id }) => id !== "sortOrder").flatMap(
				({ id, placeholder, getOptions }) => {
					const value = filterValue(search, id);
					const option = getOptions(optionsQuery.data).find(
						(entry) => entry.value === value,
					);
					return value !== "all" && option
						? [{ id, label: `${placeholder()}: ${option.label}` }]
						: [];
				},
			)
		: [];

	return (
		<div className="flex flex-col gap-3 border border-navy bg-cream p-3 text-navy sm:p-4">
			{optionsQuery.isError ? (
				<EventErrorAlert error={optionsQuery.error} />
			) : null}
			<div className="flex gap-2">
				<div className="relative min-w-0 flex-1">
					<SearchIcon
						aria-hidden
						className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
					/>
					<Input
						type="search"
						aria-label={filter_search_placeholder()}
						placeholder={filter_search_placeholder()}
						value={input}
						onChange={(event) => setInput(event.target.value)}
						className="h-11 pr-11 pl-9 [&::-webkit-search-cancel-button]:hidden"
					/>
					{input ? (
						<button
							type="button"
							onClick={clear}
							aria-label={filter_clear_search()}
							className="absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center outline-none hover:bg-purple focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-navy"
						>
							<XIcon aria-hidden className="size-4" />
						</button>
					) : null}
				</div>
				<Button
					type="button"
					variant="outline"
					className="h-11 md:hidden"
					aria-expanded={open}
					aria-controls={panelId}
					onClick={() => setOpen((value) => !value)}
				>
					<SlidersHorizontalIcon aria-hidden />
					{filter_toggle()}
					{active.length > 0 ? (
						<span className="bg-navy px-1.5 text-manela tabular-nums">
							{active.length}
						</span>
					) : null}
				</Button>
			</div>
			<div
				id={panelId}
				className={cn(
					"grid gap-2 sm:grid-cols-2 md:grid md:grid-cols-3",
					open ? "grid" : "hidden",
				)}
			>
				{loading || optionsQuery.isError
					? FILTER_SELECTS.map(({ id }) => (
							<Skeleton key={id} className="h-9 w-full" />
						))
					: FILTER_SELECTS.map(({ id, placeholder, getOptions }) => {
							const value = filterValue(search, id);
							const options = getOptions(optionsQuery.data);
							const selected = options.find((option) => option.value === value);
							return (
								<Select
									key={id}
									value={value}
									onValueChange={(value) =>
										onSearchChange((prev) => ({
											...prev,
											[id]: value === "all" ? undefined : value,
										}))
									}
								>
									<SelectTrigger
										className={cn(
											"w-full",
											id !== "sortOrder" && value !== "all" && "bg-purple",
										)}
										// The name keeps the chosen value, which a plain label would hide.
										aria-label={
											selected
												? `${placeholder()}: ${selected.label}`
												: placeholder()
										}
									>
										<SelectValue placeholder={placeholder()} />
									</SelectTrigger>
									<SelectContent>
										{options.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							);
						})}
			</div>
			{active.length > 0 ? (
				<div className="flex flex-wrap items-center gap-2">
					<ul aria-label={filter_active()} className="flex flex-wrap gap-2">
						{active.map((filter) => (
							<li key={filter.id}>
								<button
									type="button"
									onClick={() =>
										onSearchChange((prev) => ({
											...prev,
											[filter.id]: undefined,
										}))
									}
									aria-label={filter_remove({ label: filter.label })}
									className="flex items-center gap-1.5 border border-navy bg-purple px-2 py-1 font-mono text-xs font-bold outline-none hover:bg-white focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-navy"
								>
									{filter.label}
									<XIcon aria-hidden className="size-3" />
								</button>
							</li>
						))}
					</ul>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="underline underline-offset-4"
						onClick={() =>
							onSearchChange((prev) => ({
								...prev,
								...Object.fromEntries(
									active.map((filter) => [filter.id, undefined]),
								),
								search: undefined,
							}))
						}
					>
						{filter_clear_all()}
					</Button>
				</div>
			) : null}
		</div>
	);
}
