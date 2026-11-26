import {
	event_details_all_sessions,
	event_details_session,
} from "@repo/i18n/paraglide/messages";
import { Label } from "@repo/ui/components/label";
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
			<Label htmlFor={id}>{event_details_session()}:</Label>
			<select
				id={id}
				value={value ?? ""}
				onChange={(event) => onChange(event.target.value || null)}
				className="h-9 min-w-0 flex-1 border border-input bg-white px-3 text-sm outline-none focus-visible:shadow-[3px_3px_0_0_var(--green)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-solid focus-visible:outline-navy sm:flex-none"
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
