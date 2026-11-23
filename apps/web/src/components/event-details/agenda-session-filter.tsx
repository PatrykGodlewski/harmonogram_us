import {
	event_details_all_sessions,
	event_details_session,
} from "@repo/i18n/paraglide/messages";
import { useId } from "react";

type AgendaSessionFilterProps = {
	titles: string[];
	/** The chosen session title, or null for all sessions. */
	value: string | null;
	onChange: (title: string | null) => void;
};

/** Narrows the programme to one session (F33); same-named sessions on several days count as one. */
export function AgendaSessionFilter({
	titles,
	value,
	onChange,
}: AgendaSessionFilterProps) {
	const id = useId();
	return (
		<div className="flex items-center gap-2">
			<label htmlFor={id} className="text-sm text-muted-foreground">
				{event_details_session()}:
			</label>
			<select
				id={id}
				value={value ?? ""}
				onChange={(event) => onChange(event.target.value || null)}
				className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none sm:flex-none"
			>
				<option value="">{event_details_all_sessions()}</option>
				{titles.map((title) => (
					<option key={title} value={title}>
						{title}
					</option>
				))}
			</select>
		</div>
	);
}
