import type { EventDetails } from "@repo/api/events/queries";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import { formatFileSize } from "@repo/ui/file-size";
import { useSearch } from "@tanstack/react-router";

/** A download of an event file; on an invite-only event the page's invite secret goes along. */
export function FileLink({ file }: { file: EventDetails["files"][number] }) {
	const { invite } = useSearch({ strict: false }) as { invite?: string };
	const href = invite
		? `/api/files/${file.id}?invite=${encodeURIComponent(invite)}`
		: `/api/files/${file.id}`;
	return (
		<a href={href} className="break-all underline underline-offset-2">
			{file.name}{" "}
			<span className="text-muted-foreground">
				({formatFileSize(file.size, getLocale())})
			</span>
		</a>
	);
}
