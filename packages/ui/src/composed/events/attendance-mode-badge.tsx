import {
	attendance_mode_hybrid,
	attendance_mode_online,
} from "@repo/i18n/paraglide/messages";
import { Badge } from "@repo/ui/components/badge";

/** Marks online and hybrid events; on-site is the default and needs no badge. */
export function AttendanceModeBadge({
	mode,
}: {
	mode: "onsite" | "online" | "hybrid";
}) {
	if (mode === "onsite") {
		return null;
	}
	return (
		<Badge variant="outline">
			{mode === "online" ? attendance_mode_online() : attendance_mode_hybrid()}
		</Badge>
	);
}
