import {
	removeAgendaItemImageServer,
	uploadAgendaItemImageServer,
} from "@repo/api/admin/agenda-item-image";
import { AGENDA_ITEM_LIMITS } from "@repo/api/events/schemas";
import {
	ACCEPTED_IMAGE_EXTENSIONS,
	MAX_IMAGE_BYTES,
} from "@repo/api/files/image-rules";
import {
	admin_error_generic,
	admin_item_image,
	admin_item_image_after_save,
	admin_item_image_alt,
	admin_item_image_alt_required,
	admin_item_image_file,
	admin_item_image_file_required,
	admin_item_image_hint,
	admin_item_image_remove,
	admin_item_image_upload,
	error_image_too_large,
} from "@repo/i18n/paraglide/messages";
import { Button } from "@repo/ui/components/button";
import { FormMessage } from "@repo/ui/components/form-message";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { useMutation } from "@tanstack/react-query";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { formatMutationError } from "../../lib/format-mutation-error";

type AgendaItemImageProps = {
	/** Null for an item not saved yet: an image needs the item. */
	item: { id: string; hasImage: boolean; imageAlt: string | null } | null;
	onChanged: () => Promise<unknown>;
};

/**
 * The item's image (F18), saved on its own: inside the item dialog, but not part of
 * its form (no nested form, so the buttons are plain buttons).
 */
export function AgendaItemImage({ item, onChanged }: AgendaItemImageProps) {
	const fileId = useId();
	const altId = useId();
	const hintId = useId();
	const fileInput = useRef<HTMLInputElement>(null);
	const [alt, setAlt] = useState("");
	const [error, setError] = useState<string | null>(null);
	// The dialog keeps the item it opened with; this follows uploads and removals.
	const [shownAlt, setShownAlt] = useState(
		item?.hasImage ? item.imageAlt : null,
	);
	// A new address after each upload, so the preview shows the new image.
	const [version, setVersion] = useState(0);
	const handleError = (mutationError: unknown) =>
		toast.error(formatMutationError(mutationError, admin_error_generic));

	const uploadMutation = useMutation({
		mutationFn: (data: FormData) => uploadAgendaItemImageServer({ data }),
		onSuccess: async (_, data) => {
			setShownAlt(String(data.get("alt")));
			setVersion((current) => current + 1);
			setAlt("");
			if (fileInput.current) fileInput.current.value = "";
			await onChanged();
		},
		onError: handleError,
	});
	const removeMutation = useMutation({
		mutationFn: (agendaItemId: string) =>
			removeAgendaItemImageServer({ data: { agendaItemId } }),
		onSuccess: async () => {
			setShownAlt(null);
			await onChanged();
		},
		onError: handleError,
	});

	if (!item) {
		return (
			<fieldset className="flex flex-col gap-1">
				<legend className="text-sm font-medium">{admin_item_image()}</legend>
				<p className="text-sm text-muted-foreground">
					{admin_item_image_after_save()}
				</p>
			</fieldset>
		);
	}

	const handleUpload = () => {
		const file = fileInput.current?.files?.[0];
		if (!file) {
			setError(admin_item_image_file_required());
			fileInput.current?.focus();
			return;
		}
		if (!alt.trim()) {
			setError(admin_item_image_alt_required());
			return;
		}
		if (file.size > MAX_IMAGE_BYTES) {
			setError(error_image_too_large());
			return;
		}
		setError(null);
		const data = new FormData();
		data.set("agendaItemId", item.id);
		data.set("alt", alt.trim());
		data.set("file", file);
		uploadMutation.mutate(data);
	};

	const busy = uploadMutation.isPending || removeMutation.isPending;
	return (
		<fieldset className="flex flex-col gap-3">
			<legend className="text-sm font-medium">{admin_item_image()}</legend>
			{shownAlt ? (
				<div className="flex flex-col gap-2">
					<img
						src={`/api/agenda-items/${item.id}/image?v=${version}`}
						alt={shownAlt}
						className="aspect-video w-full border border-navy object-cover"
					/>
					<Button
						type="button"
						size="sm"
						variant="outline"
						className="self-start"
						disabled={busy}
						onClick={() => removeMutation.mutate(item.id)}
					>
						{admin_item_image_remove()}
					</Button>
				</div>
			) : null}
			<div className="flex flex-col gap-1.5">
				<Label htmlFor={fileId}>{admin_item_image_file()}</Label>
				<Input
					id={fileId}
					ref={fileInput}
					type="file"
					accept={ACCEPTED_IMAGE_EXTENSIONS}
					aria-describedby={hintId}
					disabled={busy}
				/>
				<p id={hintId} className="text-sm text-muted-foreground">
					{admin_item_image_hint()}
				</p>
			</div>
			<div className="flex flex-col gap-1.5">
				<Label htmlFor={altId}>{admin_item_image_alt()}</Label>
				<Input
					id={altId}
					maxLength={AGENDA_ITEM_LIMITS.imageAlt}
					value={alt}
					disabled={busy}
					onChange={(event) => setAlt(event.target.value)}
				/>
			</div>
			{error ? <FormMessage>{error}</FormMessage> : null}
			<Button
				type="button"
				size="sm"
				variant="outline"
				className="self-start"
				disabled={busy}
				onClick={handleUpload}
			>
				{admin_item_image_upload()}
			</Button>
		</fieldset>
	);
}
