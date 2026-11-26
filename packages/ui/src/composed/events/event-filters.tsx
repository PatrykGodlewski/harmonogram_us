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

/** A filter cell draws its right and bottom grid lines. */
const CELL = "border-r border-b border-navy";
/** Controls fill their cell, so their focus outline is drawn inside it. */
const CELL_FOCUS = "focus-visible:-outline-offset-2 focus-visible:shadow-none";

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
		<div className="border border-navy bg-cream text-navy">
			{optionsQuery.isError ? (
				<div className="border-b border-navy p-3">
					<EventErrorAlert error={optionsQuery.error} />
				</div>
			) : null}
			<div className="flex">
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
						className={cn(
							CELL_FOCUS,
							"h-12 border-0 pr-11 pl-9 [&::-webkit-search-cancel-button]:hidden",
						)}
					/>
					{input ? (
						<button
							type="button"
							onClick={clear}
							aria-label={filter_clear_search()}
							className="absolute top-1/2 right-1.5 grid size-9 -translate-y-1/2 place-items-center outline-none hover:bg-purple focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-navy"
						>
							<XIcon aria-hidden className="size-4" />
						</button>
					) : null}
				</div>
				<Button
					type="button"
					variant="ghost"
					className={cn(CELL_FOCUS, "min-h-12 border-l border-navy md:hidden")}
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
			{/* The outer cells' right and bottom lines fall outside the clipped panel. */}
			<div
				id={panelId}
				className={cn(
					"overflow-hidden border-t border-navy md:block",
					open ? "block" : "hidden",
				)}
			>
				<div className="-mr-px -mb-px grid sm:grid-cols-2 md:grid-cols-3">
					{loading || optionsQuery.isError
						? FILTER_SELECTS.map(({ id }) => (
								<div key={id} className={cn(CELL, "p-1.5")}>
									<Skeleton className="h-9 w-full" />
								</div>
							))
						: FILTER_SELECTS.map(({ id, placeholder, getOptions }) => {
								const value = filterValue(search, id);
								const options = getOptions(optionsQuery.data);
								const selected = options.find(
									(option) => option.value === value,
								);
								const chosen = id !== "sortOrder" && value !== "all";
								return (
									<div key={id} className={CELL}>
										<Select
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
													CELL_FOCUS,
													"w-full border-0 bg-transparent data-[size=default]:h-12",
													chosen ? "bg-purple" : "hover:bg-white",
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
									</div>
								);
							})}
				</div>
			</div>
			{active.length > 0 ? (
				<div className="flex flex-wrap items-center gap-2 border-t border-navy p-3">
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
