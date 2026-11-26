import { Checkerboard } from "@repo/ui/composed/brand/checkerboard";
import { cn } from "@repo/ui/utils";
import type { HomeEventListEvent } from "~/lib/events/types";

type EventCoverProps = {
	event: Pick<HomeEventListEvent, "imageUrl" | "imageStatus">;
	/** The invite from the page address (invite-only events). */
	invite?: string;
	className?: string;
};

/**
 * The generated cover (16:9, decorative: it only sets the mood), or a pixel band
 * while there is none — pending, failed or never generated.
 */
export function EventCover({ event, invite, className }: EventCoverProps) {
	if (event.imageStatus !== "ready" || !event.imageUrl) {
		return (
			<Checkerboard
				columns={24}
				rows={3}
				className={cn("text-navy", className)}
			/>
		);
	}
	return (
		<img
			src={`${event.imageUrl}${invite ? `?invite=${encodeURIComponent(invite)}` : ""}`}
			alt=""
			loading="lazy"
			className={cn("aspect-video w-full bg-manela object-cover", className)}
		/>
	);
}
