import {
	event_details_all_places,
	event_details_place,
} from "@repo/i18n/paraglide/messages";
import { Button } from "@repo/ui/components/button";

type AgendaPlaceFilterProps = {
	places: { id: string; label: string }[];
	/** The chosen place, or null for the whole programme. */
	value: string | null;
	onChange: (placeId: string | null) => void;
};

/** Narrows the programme to one place (F33): "Wszystkie miejsca · Katowice · Sosnowiec". */
export function AgendaPlaceFilter({
	places,
	value,
	onChange,
}: AgendaPlaceFilterProps) {
	const options = [{ id: null, label: event_details_all_places() }, ...places];
	return (
		<fieldset
			aria-label={event_details_place()}
			className="flex flex-wrap items-center gap-1"
		>
			<span aria-hidden className="mr-1 text-sm text-muted-foreground">
				{event_details_place()}:
			</span>
			{options.map((option) => (
				<Button
					key={option.id ?? "all"}
					size="sm"
					variant={value === option.id ? "default" : "outline"}
					aria-pressed={value === option.id}
					onClick={() => onChange(option.id)}
				>
					{option.label}
				</Button>
			))}
		</fieldset>
	);
}
