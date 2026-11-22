import {
	deleteEventFileServer,
	filesAvailableQueryOptions,
	setEventMaterialLinksServer,
	uploadEventFileServer,
} from "@repo/api/admin/materials";
import type { EventDetails } from "@repo/api/events/queries";
import { ACCEPTED_EXTENSIONS, MAX_FILE_BYTES } from "@repo/api/files/rules";
import {
	admin_action_cancel,
	admin_action_delete,
	admin_error_generic,
	error_file_too_large,
	materials_add_file,
	materials_add_link,
	materials_delete_file,
	materials_delete_file_body,
	materials_delete_file_title,
	materials_empty,
	materials_file,
	materials_file_added,
	materials_file_hint,
	materials_files_off,
	materials_link_invalid,
	materials_link_label,
	materials_link_url,
	materials_remove_link,
	materials_target,
	materials_target_event,
	materials_title,
	materials_uploading,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@repo/ui/components/alert-dialog";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { formatFileSize } from "@repo/ui/file-size";
import { useMutation, useQuery } from "@tanstack/react-query";
import { type FormEvent, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { formatMutationError } from "~/lib/format-mutation-error";

type MaterialsCardProps = {
	eventId: string;
	agenda: Pick<EventDetails["agenda"][number], "id" | "title">[];
	materials: EventDetails["materials"];
	files: EventDetails["files"];
	onChanged: () => Promise<unknown>;
};

const LINK_URL = /^https?:\/\/\S+$/i;

/** Files and links for the event page (F14), files also for programme items (F19). */
export function MaterialsCard({
	eventId,
	agenda,
	materials,
	files,
	onChanged,
}: MaterialsCardProps) {
	const headingId = useId();
	const fileId = useId();
	const targetId = useId();
	const hintId = useId();
	const labelId = useId();
	const urlId = useId();
	const fileInput = useRef<HTMLInputElement>(null);
	const [target, setTarget] = useState("");
	const [linkLabel, setLinkLabel] = useState("");
	const [linkUrl, setLinkUrl] = useState("");
	const [linkError, setLinkError] = useState(false);
	const { data: filesAvailable } = useQuery(filesAvailableQueryOptions);
	const locale = getLocale();
	const itemTitle = new Map(agenda.map((item) => [item.id, item.title]));
	const handleError = (error: unknown) =>
		toast.error(formatMutationError(error, admin_error_generic));

	const uploadMutation = useMutation({
		mutationFn: (data: FormData) => uploadEventFileServer({ data }),
		onSuccess: async () => {
			if (fileInput.current) fileInput.current.value = "";
			toast.success(materials_file_added());
			await onChanged();
		},
		onError: handleError,
	});
	const deleteMutation = useMutation({
		mutationFn: (id: string) =>
			deleteEventFileServer({ data: { eventId, id } }),
		onSuccess: onChanged,
		onError: handleError,
	});
	const linksMutation = useMutation({
		mutationFn: (links: EventDetails["materials"]) =>
			setEventMaterialLinksServer({ data: { eventId, links } }),
		onSuccess: onChanged,
		onError: handleError,
	});

	const handleUpload = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const file = fileInput.current?.files?.[0];
		if (!file) {
			fileInput.current?.focus();
			return;
		}
		if (file.size > MAX_FILE_BYTES) {
			toast.error(error_file_too_large());
			return;
		}
		const data = new FormData();
		data.set("eventId", eventId);
		if (target) data.set("agendaItemId", target);
		data.set("file", file);
		uploadMutation.mutate(data);
	};

	const handleAddLink = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const label = linkLabel.trim();
		const url = linkUrl.trim();
		if (!label || !LINK_URL.test(url)) {
			setLinkError(true);
			return;
		}
		setLinkError(false);
		linksMutation.mutate([...materials, { label, url }], {
			onSuccess: () => {
				setLinkLabel("");
				setLinkUrl("");
			},
		});
	};

	const handleRemoveLink = (index: number) =>
		linksMutation.mutate(materials.filter((_, i) => i !== index));

	return (
		<section aria-labelledby={headingId} className="flex flex-col gap-4">
			<h2 id={headingId} className="text-lg font-semibold">
				{materials_title()}
			</h2>
			{files.length === 0 && materials.length === 0 ? (
				<p className="text-sm text-muted-foreground">{materials_empty()}</p>
			) : (
				<ul className="divide-y rounded-lg border">
					{files.map((file) => (
						<li
							key={file.id}
							className="flex flex-wrap items-center justify-between gap-2 p-3"
						>
							<div className="flex min-w-0 flex-col">
								<a
									href={`/api/files/${file.id}`}
									className="break-all font-medium underline underline-offset-2"
								>
									{file.name}{" "}
									<span className="font-normal text-muted-foreground">
										({formatFileSize(file.size, locale)})
									</span>
								</a>
								{file.agendaItemId ? (
									<span className="text-sm text-muted-foreground">
										{itemTitle.get(file.agendaItemId)}
									</span>
								) : null}
							</div>
							<AlertDialog>
								<AlertDialogTrigger asChild>
									<Button
										size="sm"
										variant="outline"
										disabled={deleteMutation.isPending}
										aria-label={materials_delete_file({ name: file.name })}
									>
										{admin_action_delete()}
									</Button>
								</AlertDialogTrigger>
								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>
											{materials_delete_file_title({ name: file.name })}
										</AlertDialogTitle>
										<AlertDialogDescription>
											{materials_delete_file_body()}
										</AlertDialogDescription>
									</AlertDialogHeader>
									<AlertDialogFooter>
										<AlertDialogCancel>
											{admin_action_cancel()}
										</AlertDialogCancel>
										<AlertDialogAction
											onClick={() => deleteMutation.mutate(file.id)}
										>
											{admin_action_delete()}
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
						</li>
					))}
					{materials.map((link, index) => (
						<li
							// biome-ignore lint/suspicious/noArrayIndexKey: links may repeat; the list is replaced whole
							key={index}
							className="flex flex-wrap items-center justify-between gap-2 p-3"
						>
							<a
								href={link.url}
								target="_blank"
								rel="noopener noreferrer"
								className="min-w-0 break-all font-medium underline underline-offset-2"
							>
								{link.label}
							</a>
							<Button
								size="sm"
								variant="outline"
								disabled={linksMutation.isPending}
								aria-label={materials_remove_link({ label: link.label })}
								onClick={() => handleRemoveLink(index)}
							>
								{admin_action_delete()}
							</Button>
						</li>
					))}
				</ul>
			)}

			{filesAvailable === false ? (
				<p className="text-sm text-muted-foreground">{materials_files_off()}</p>
			) : (
				<form onSubmit={handleUpload} className="flex flex-col gap-3">
					<div className="flex flex-col gap-1.5">
						<Label htmlFor={fileId}>{materials_file()}</Label>
						<Input
							id={fileId}
							ref={fileInput}
							type="file"
							accept={ACCEPTED_EXTENSIONS}
							aria-describedby={hintId}
						/>
						<p id={hintId} className="text-sm text-muted-foreground">
							{materials_file_hint()}
						</p>
					</div>
					{agenda.length > 0 ? (
						<div className="flex flex-col gap-1.5">
							<Label htmlFor={targetId}>{materials_target()}</Label>
							<select
								id={targetId}
								value={target}
								onChange={(event) => setTarget(event.target.value)}
								className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
							>
								<option value="">{materials_target_event()}</option>
								{agenda.map((item) => (
									<option key={item.id} value={item.id}>
										{item.title}
									</option>
								))}
							</select>
						</div>
					) : null}
					<Button
						type="submit"
						variant="outline"
						className="self-start"
						disabled={uploadMutation.isPending}
					>
						{uploadMutation.isPending
							? materials_uploading()
							: materials_add_file()}
					</Button>
				</form>
			)}

			<form onSubmit={handleAddLink} className="flex flex-col gap-3" noValidate>
				<div className="grid gap-3 sm:grid-cols-2">
					<div className="flex flex-col gap-1.5">
						<Label htmlFor={labelId}>{materials_link_label()}</Label>
						<Input
							id={labelId}
							value={linkLabel}
							maxLength={200}
							aria-invalid={linkError && !linkLabel.trim()}
							onChange={(event) => setLinkLabel(event.target.value)}
						/>
					</div>
					<div className="flex flex-col gap-1.5">
						<Label htmlFor={urlId}>{materials_link_url()}</Label>
						<Input
							id={urlId}
							type="url"
							inputMode="url"
							value={linkUrl}
							maxLength={2000}
							placeholder="https://"
							aria-invalid={linkError && !LINK_URL.test(linkUrl.trim())}
							onChange={(event) => setLinkUrl(event.target.value)}
						/>
					</div>
				</div>
				{linkError ? (
					<p role="alert" className="text-sm text-destructive">
						{materials_link_invalid()}
					</p>
				) : null}
				<Button
					type="submit"
					variant="outline"
					className="self-start"
					disabled={linksMutation.isPending}
				>
					{materials_add_link()}
				</Button>
			</form>
		</section>
	);
}
