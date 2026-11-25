import { Button } from "@repo/ui/components/button";

type AgendaFilterChipsProps = {
	/** The group's name ("Miejsce", "Dzień"); also its accessible name. */
	label: string;
	/** The first chip, which clears the choice ("Wszystkie miejsca"). */
	allLabel: string;
	options: { id: string; label: string }[];
	/** The chosen option, or null for all. */
	value: string | null;
	onChange: (id: string | null) => void;
};

/** One row of chips narrowing the programme (by place, by day). */
export function AgendaFilterChips({
	label,
	allLabel,
	options,
	value,
	onChange,
}: AgendaFilterChipsProps) {
	return (
		<fieldset aria-label={label} className="min-w-0">
			{/* One scrolling row on a phone (a fieldset itself scrolls badly in Chromium). */}
			<div className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-1.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
				<span
					aria-hidden
					className="mr-1 shrink-0 font-mono text-xs font-bold tracking-widest uppercase"
				>
					{label}
				</span>
				{[{ id: null, label: allLabel }, ...options].map((option) => (
					<Button
						key={option.id ?? "all"}
						size="sm"
						className="shrink-0"
						variant={value === option.id ? "default" : "outline"}
						aria-pressed={value === option.id}
						onClick={() => onChange(option.id)}
					>
						{option.label}
					</Button>
				))}
			</div>
		</fieldset>
	);
}
