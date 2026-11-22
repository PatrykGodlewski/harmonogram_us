import type { EventDetails } from "@repo/api/events/queries";
import { materials_title } from "@repo/i18n/paraglide/messages";
import { useId } from "react";
import { FileLink } from "./file-link";

/** Links and files of the whole event (F14); programme items show their own. */
export function EventMaterials({
	event,
}: {
	event: Pick<EventDetails, "materials" | "files">;
}) {
	const headingId = useId();
	const files = event.files.filter((file) => !file.agendaItemId);
	if (files.length === 0 && event.materials.length === 0) {
		return null;
	}
	return (
		<section aria-labelledby={headingId} className="flex flex-col gap-2">
			<h2 id={headingId} className="text-lg font-semibold">
				{materials_title()}
			</h2>
			<ul className="flex flex-col gap-1">
				{event.materials.map((link, index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: a static list that may repeat a link
					<li key={index}>
						<a
							href={link.url}
							target="_blank"
							rel="noopener noreferrer"
							className="break-all underline underline-offset-2"
						>
							{link.label}
						</a>
					</li>
				))}
				{files.map((file) => (
					<li key={file.id}>
						<FileLink file={file} />
					</li>
				))}
			</ul>
		</section>
	);
}
