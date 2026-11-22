import {
	createAdminAgendaItemServer,
	updateAdminAgendaItemServer,
} from "@repo/api/admin/mutations";
import type { AgendaItem, FilterOption } from "@repo/api/admin/queries";
import {
	admin_dialog_add_title,
	admin_dialog_edit_title,
	admin_error_end_before_start,
	admin_error_generic,
	admin_event_agenda_item,
	admin_field_date,
	admin_field_description,
	admin_field_end_time,
	admin_field_none,
	admin_field_requires_registration,
	admin_field_room,
	admin_field_seat_limit,
	admin_field_seat_limit_hint,
	admin_field_start_time,
	admin_field_time_required,
	admin_field_title,
	admin_material_add,
	admin_material_label,
	admin_material_remove,
	admin_material_url,
	admin_material_url_invalid,
	admin_material_url_required,
	admin_materials,
	admin_save_success,
	admin_speaker_add,
	admin_speaker_affiliation,
	admin_speaker_name,
	admin_speaker_name_required,
	admin_speaker_remove,
	admin_speakers,
} from "@repo/i18n/paraglide/messages";
import { Button } from "@repo/ui/components/button";
import { FormMessage } from "@repo/ui/components/form-message";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { Textarea } from "@repo/ui/components/textarea";
import { AdminFormDialog } from "@repo/ui/composed/admin/admin-form-dialog";
import {
	fromEventWallTime,
	toEventDateInput,
	toEventTimeInput,
} from "@repo/ui/time";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { formatFieldError } from "../../lib/format-field-error";
import { formatMutationError } from "../../lib/format-mutation-error";

const NONE_VALUE = "__none__";
/** Speakers and materials per programme item (the server allows the same). */
const MAX_ROWS = 20;

const agendaItemFormSchema = z
	.object({
		title: z.string().min(1).max(500),
		description: z.string().max(5000),
		date: z.string().min(1),
		startTime: z.string().min(1, { error: () => admin_field_time_required() }),
		endTime: z.string().min(1, { error: () => admin_field_time_required() }),
		locationId: z.string(),
		maxSeats: z.string().regex(/^\d*$/),
		requiresRegistration: z.boolean(),
		speakers: z.array(
			z
				.object({ name: z.string().max(200), affiliation: z.string().max(200) })
				// A filled row needs a name; it is never dropped silently.
				.refine(
					(speaker) => speaker.name.trim() || !speaker.affiliation.trim(),
					{
						path: ["name"],
						message: admin_speaker_name_required(),
					},
				),
		),
		materials: z.array(
			z
				.object({
					label: z.string().max(200),
					url: z.union([
						z.literal(""),
						z
							.url({
								protocol: /^https?$/,
								error: () => admin_material_url_invalid(),
							})
							.max(2000),
					]),
				})
				.refine((material) => material.url || !material.label.trim(), {
					path: ["url"],
					message: admin_material_url_required(),
				}),
		),
	})
	.refine(
		// Zod runs this even when a field above failed: compare only complete times
		// (an empty time is not a date, and the "required" message covers it).
		(value) =>
			!value.date ||
			!value.startTime ||
			!value.endTime ||
			fromEventWallTime(value.date, value.endTime) >
				fromEventWallTime(value.date, value.startTime),
		{ path: ["endTime"], message: admin_error_end_before_start() },
	);

type AgendaItemFormValues = z.infer<typeof agendaItemFormSchema>;

function toFormValues(
	item: AgendaItem | null,
	eventDate: Date,
): AgendaItemFormValues {
	if (!item) {
		return {
			title: "",
			description: "",
			date: toEventDateInput(eventDate),
			startTime: "",
			endTime: "",
			locationId: NONE_VALUE,
			maxSeats: "",
			requiresRegistration: true,
			speakers: [],
			materials: [],
		};
	}
	const startsAt = new Date(item.startsAt);
	return {
		title: item.title,
		description: item.description ?? "",
		date: toEventDateInput(startsAt),
		startTime: toEventTimeInput(startsAt),
		endTime: toEventTimeInput(new Date(item.endsAt)),
		locationId: item.locationId ?? NONE_VALUE,
		maxSeats: item.maxSeats === null ? "" : String(item.maxSeats),
		requiresRegistration: item.requiresRegistration,
		speakers: item.speakers.map((speaker) => ({
			name: speaker.name,
			affiliation: speaker.affiliation ?? "",
		})),
		materials: item.materials,
	};
}

type AgendaItemDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	eventId: string;
	eventDate: Date;
	item: AgendaItem | null;
	locations: FilterOption[];
	onSaved: () => Promise<unknown>;
};

export function AgendaItemDialog({
	open,
	onOpenChange,
	eventId,
	eventDate,
	item,
	locations,
	onSaved,
}: AgendaItemDialogProps) {
	const saveMutation = useMutation({
		mutationFn: (values: AgendaItemFormValues) => {
			const payload = {
				title: values.title,
				description: values.description.trim() || null,
				startsAt: fromEventWallTime(values.date, values.startTime),
				endsAt: fromEventWallTime(values.date, values.endTime),
				locationId: values.locationId === NONE_VALUE ? null : values.locationId,
				maxSeats: values.maxSeats === "" ? null : Number(values.maxSeats),
				requiresRegistration: values.requiresRegistration,
				// Empty rows are dropped; a link without a name shows its address.
				speakers: values.speakers
					.filter((speaker) => speaker.name.trim())
					.map((speaker) => ({
						name: speaker.name.trim(),
						...(speaker.affiliation.trim()
							? { affiliation: speaker.affiliation.trim() }
							: {}),
					})),
				materials: values.materials
					.filter((material) => material.url)
					.map((material) => ({
						label: material.label.trim() || material.url,
						url: material.url,
					})),
			};
			return item
				? updateAdminAgendaItemServer({ data: { id: item.id, ...payload } })
				: createAdminAgendaItemServer({ data: { eventId, ...payload } });
		},
		onSuccess: async () => {
			await onSaved();
			onOpenChange(false);
			toast.success(admin_save_success());
		},
		onError: (error) => {
			toast.error(formatMutationError(error, admin_error_generic));
		},
	});

	const form = useForm({
		defaultValues: toFormValues(item, eventDate),
		validators: { onSubmit: agendaItemFormSchema },
		onSubmit: ({ value }) => {
			saveMutation.mutate(value);
		},
	});

	// Start from the item only when the dialog opens: a background refetch
	// re-renders the page (and passes a new eventDate) while someone is typing.
	const wasOpen = useRef(false);
	useEffect(() => {
		if (open && !wasOpen.current) {
			form.reset(toFormValues(item, eventDate));
		}
		wasOpen.current = open;
	}, [open, item, eventDate, form]);

	const disabled = saveMutation.isPending;
	const fieldError = (errors: unknown[]) =>
		errors.length > 0 ? (
			<FormMessage>{formatFieldError(errors[0])}</FormMessage>
		) : null;

	return (
		<AdminFormDialog
			open={open}
			onOpenChange={onOpenChange}
			title={
				item
					? admin_dialog_edit_title({ entity: admin_event_agenda_item() })
					: admin_dialog_add_title({ entity: admin_event_agenda_item() })
			}
			onSubmit={() => {
				void form.handleSubmit();
			}}
			isSubmitting={disabled}
		>
			<form.Field name="title">
				{(field) => (
					<div>
						<Label htmlFor={field.name}>{admin_field_title()}</Label>
						<Input
							id={field.name}
							className="mt-1"
							disabled={disabled}
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
						/>
						{fieldError(field.state.meta.errors)}
					</div>
				)}
			</form.Field>

			<form.Field name="date">
				{(field) => (
					<div>
						<Label htmlFor={field.name}>{admin_field_date()}</Label>
						<Input
							id={field.name}
							type="date"
							className="mt-1"
							disabled={disabled}
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
						/>
						{fieldError(field.state.meta.errors)}
					</div>
				)}
			</form.Field>

			<div className="grid grid-cols-2 gap-3">
				<form.Field name="startTime">
					{(field) => (
						<div>
							<Label htmlFor={field.name}>{admin_field_start_time()}</Label>
							<Input
								id={field.name}
								type="time"
								className="mt-1"
								disabled={disabled}
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
							/>
							{fieldError(field.state.meta.errors)}
						</div>
					)}
				</form.Field>
				<form.Field name="endTime">
					{(field) => (
						<div>
							<Label htmlFor={field.name}>{admin_field_end_time()}</Label>
							<Input
								id={field.name}
								type="time"
								className="mt-1"
								disabled={disabled}
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
							/>
							{fieldError(field.state.meta.errors)}
						</div>
					)}
				</form.Field>
			</div>

			<form.Field name="locationId">
				{(field) => (
					<div>
						<Label htmlFor={field.name}>{admin_field_room()}</Label>
						<Select
							value={field.state.value}
							onValueChange={(value) => field.handleChange(value)}
							disabled={disabled}
						>
							<SelectTrigger id={field.name} className="mt-1 w-full">
								<SelectValue placeholder={admin_field_room()} />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE_VALUE}>{admin_field_none()}</SelectItem>
								{locations.map((option) => (
									<SelectItem key={option.id} value={option.id}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				)}
			</form.Field>

			<form.Field name="maxSeats">
				{(field) => (
					<div>
						<Label htmlFor={field.name}>{admin_field_seat_limit()}</Label>
						<Input
							id={field.name}
							type="number"
							inputMode="numeric"
							min={0}
							className="mt-1"
							placeholder={admin_field_seat_limit_hint()}
							disabled={disabled}
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
						/>
						{fieldError(field.state.meta.errors)}
					</div>
				)}
			</form.Field>

			<form.Field name="requiresRegistration">
				{(field) => (
					<label className="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							className="size-4"
							disabled={disabled}
							checked={field.state.value}
							onChange={(event) => field.handleChange(event.target.checked)}
						/>
						{admin_field_requires_registration()}
					</label>
				)}
			</form.Field>

			<form.Field name="speakers" mode="array">
				{(speakersField) => (
					<fieldset className="flex flex-col gap-2">
						<legend className="text-sm font-medium">{admin_speakers()}</legend>
						{speakersField.state.value.map((_, index) => {
							const n = index + 1;
							return (
								<div
									// biome-ignore lint/suspicious/noArrayIndexKey: rows have no id; the index is their identity in the form
									key={index}
									className="flex flex-col gap-2 rounded-md border p-2"
								>
									<form.Field name={`speakers[${index}].name`}>
										{(field) => (
											<Input
												aria-label={admin_speaker_name({ n })}
												placeholder={admin_speaker_name({ n })}
												disabled={disabled}
												value={field.state.value}
												onChange={(event) =>
													field.handleChange(event.target.value)
												}
											/>
										)}
									</form.Field>
									<form.Field name={`speakers[${index}].affiliation`}>
										{(field) => (
											<Input
												aria-label={admin_speaker_affiliation({ n })}
												placeholder={admin_speaker_affiliation({ n })}
												disabled={disabled}
												value={field.state.value}
												onChange={(event) =>
													field.handleChange(event.target.value)
												}
											/>
										)}
									</form.Field>
									<Button
										type="button"
										size="sm"
										variant="ghost"
										className="self-end"
										disabled={disabled}
										onClick={() => speakersField.removeValue(index)}
									>
										{admin_speaker_remove({ n })}
									</Button>
								</div>
							);
						})}
						<Button
							type="button"
							size="sm"
							variant="outline"
							className="self-start"
							disabled={
								disabled || speakersField.state.value.length >= MAX_ROWS
							}
							onClick={() =>
								speakersField.pushValue({ name: "", affiliation: "" })
							}
						>
							{admin_speaker_add()}
						</Button>
					</fieldset>
				)}
			</form.Field>

			<form.Field name="materials" mode="array">
				{(materialsField) => (
					<fieldset className="flex flex-col gap-2">
						<legend className="text-sm font-medium">{admin_materials()}</legend>
						{materialsField.state.value.map((_, index) => {
							const n = index + 1;
							return (
								<div
									// biome-ignore lint/suspicious/noArrayIndexKey: rows have no id; the index is their identity in the form
									key={index}
									className="flex flex-col gap-2 rounded-md border p-2"
								>
									<form.Field name={`materials[${index}].label`}>
										{(field) => (
											<Input
												aria-label={admin_material_label({ n })}
												placeholder={admin_material_label({ n })}
												disabled={disabled}
												value={field.state.value}
												onChange={(event) =>
													field.handleChange(event.target.value)
												}
											/>
										)}
									</form.Field>
									<form.Field name={`materials[${index}].url`}>
										{(field) => (
											<div>
												<Input
													type="url"
													inputMode="url"
													aria-label={admin_material_url({ n })}
													placeholder="https://"
													disabled={disabled}
													value={field.state.value}
													onChange={(event) =>
														field.handleChange(event.target.value)
													}
												/>
												{fieldError(field.state.meta.errors)}
											</div>
										)}
									</form.Field>
									<Button
										type="button"
										size="sm"
										variant="ghost"
										className="self-end"
										disabled={disabled}
										onClick={() => materialsField.removeValue(index)}
									>
										{admin_material_remove({ n })}
									</Button>
								</div>
							);
						})}
						<Button
							type="button"
							size="sm"
							variant="outline"
							className="self-start"
							disabled={
								disabled || materialsField.state.value.length >= MAX_ROWS
							}
							onClick={() => materialsField.pushValue({ label: "", url: "" })}
						>
							{admin_material_add()}
						</Button>
					</fieldset>
				)}
			</form.Field>

			<form.Field name="description">
				{(field) => (
					<div>
						<Label htmlFor={field.name}>{admin_field_description()}</Label>
						<Textarea
							id={field.name}
							className="mt-1"
							rows={3}
							disabled={disabled}
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
						/>
					</div>
				)}
			</form.Field>
		</AdminFormDialog>
	);
}
