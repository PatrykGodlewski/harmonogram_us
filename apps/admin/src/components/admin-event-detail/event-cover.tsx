import type { AdminEventDetails } from "@repo/api/admin/queries";
import { regenerateEventImageServer } from "@repo/api/event-images/regenerate";
import {
	admin_error_generic,
	admin_event_image_failed,
	admin_event_image_pending,
	admin_event_image_regenerate,
	admin_event_image_requested,
} from "@repo/i18n/paraglide/messages";
import { Button } from "@repo/ui/components/button";
import { Checkerboard } from "@repo/ui/composed/brand/checkerboard";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { formatMutationError } from "../../lib/format-mutation-error";

type EventCoverProps = {
	event: Pick<
		AdminEventDetails,
		"id" | "imageUrl" | "imageStatus" | "imageGenerationEnabled"
	>;
	onChanged: () => Promise<unknown>;
};

/** The generated cover (or a pixel band without one), its state and the regenerate action. */
export function EventCover({ event, onChanged }: EventCoverProps) {
	// A new address after each request, so the new image replaces the cached one.
	const [version, setVersion] = useState(0);
	const regenerateMutation = useMutation({
		mutationFn: () => regenerateEventImageServer({ data: { id: event.id } }),
		onSuccess: async () => {
			setVersion((current) => current + 1);
			toast.success(admin_event_image_requested());
			await onChanged();
		},
		onError: (error) =>
			toast.error(formatMutationError(error, admin_error_generic)),
	});
	const isPending = event.imageStatus === "pending";
	const handleRegenerate = () => regenerateMutation.mutate();

	return (
		<div className="border-t border-navy">
			{event.imageStatus === "ready" && event.imageUrl ? (
				<img
					src={`${event.imageUrl}?v=${version}`}
					alt=""
					className="aspect-video w-full bg-manela object-cover"
				/>
			) : (
				<Checkerboard columns={24} rows={3} className="text-navy" />
			)}
			{isPending || event.imageStatus === "failed" ? (
				<p role="status" className="border-t border-navy px-4 py-2 text-sm">
					{isPending ? admin_event_image_pending() : admin_event_image_failed()}
				</p>
			) : null}
			{event.imageGenerationEnabled ? (
				<div className="border-t border-navy px-4 py-3">
					<Button
						type="button"
						size="sm"
						variant="outline"
						disabled={isPending || regenerateMutation.isPending}
						onClick={handleRegenerate}
					>
						{admin_event_image_regenerate()}
					</Button>
				</div>
			) : null}
		</div>
	);
}
