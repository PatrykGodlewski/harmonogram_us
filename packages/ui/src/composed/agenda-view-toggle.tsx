import {
	event_details_view_calendar,
	event_details_view_label,
	event_details_view_list,
} from "@repo/i18n/paraglide/messages";
import { Button } from "../components/button";

export type AgendaViewMode = "list" | "calendar";

type AgendaViewToggleProps = {
	value: AgendaViewMode;
	onChange: (value: AgendaViewMode) => void;
};

export function AgendaViewToggle({ value, onChange }: AgendaViewToggleProps) {
	const options = [
		{ mode: "list", label: event_details_view_list() },
		{ mode: "calendar", label: event_details_view_calendar() },
	] as const;
	return (
		<fieldset aria-label={event_details_view_label()} className="flex gap-1">
			{options.map((option) => (
				<Button
					key={option.mode}
					size="sm"
					variant={value === option.mode ? "default" : "outline"}
					aria-pressed={value === option.mode}
					onClick={() => onChange(option.mode)}
				>
					{option.label}
				</Button>
			))}
		</fieldset>
	);
}
