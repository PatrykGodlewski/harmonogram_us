import {
	createAdminAgendaItemServer,
	updateAdminAgendaItemServer,
} from "@repo/api/admin/mutations";
import type {
	AgendaItem,
	AgendaSession,
	FilterOption,
} from "@repo/api/admin/queries";
import {
	AGENDA_ITEM_LIMITS,
	type EventFilterOptions,
} from "@repo/api/events/schemas";
import {
	admin_dialog_add_title,
	admin_dialog_edit_title,
	admin_error_end_before_start,
	admin_error_generic,
	admin_event_agenda_item,
	admin_field_audience,
	admin_field_audience_hint,
	admin_field_date,
	admin_field_description,
	admin_field_end_time,
	admin_field_ends_next_day,
	admin_field_item_faculty,
	admin_field_item_type,
	admin_field_languages,
	admin_field_none,
	admin_field_requires_registration,
	admin_field_room,
	admin_field_seat_limit,
	admin_field_seat_limit_hint,
	admin_field_start_time,
	admin_field_time_required,
	admin_field_title,
	admin_field_topic,
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
	admin_speaker_bio,
	admin_speaker_name,
	admin_speaker_name_required,
	admin_speaker_remove,
	admin_speaker_unit,
	admin_speakers,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
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
import { agendaLanguageOptions } from "@repo/ui/languages";
import {
	endsNextDay,
	fromEventWallTimeRange,
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
import { AgendaItemImage } from "./agenda-item-image";

const NONE_VALUE = "__none__";
const L = AGENDA_ITEM_LIMITS;

const agendaItemFormSchema = z
	.object({
		title: z.string().min(1).max(L.title),
		description: z.string().max(L.description),
		date: z.string().min(1),
		startTime: z.string().min(1, { error: () => admin_field_time_required() }),
		endTime: z.string().min(1, { error: () => admin_field_time_required() }),
		locationId: z.string(),
		maxSeats: z.string().regex(/^\d*$/),
		requiresRegistration: z.boolean(),
		typeId: z.string(),
		facultyId: z.string(),
		topic: z.string().max(L.detail),
		audience: z.string().max(L.detail),
		languages: z.array(z.string()),
		speakers: z.array(
			z
				.object({
					name: z.string().max(L.shortText),
					affiliation: z.string().max(L.shortText),
					unit: z.string().max(L.shortText),
					bio: z.string().max(L.bio),
				})
				// A filled row needs a name; it is never dropped silently.
				.refine(
					({ name, affiliation, unit, bio }) =>
						name.trim() || !(affiliation + unit + bio).trim(),
					{
						path: ["name"],
						message: admin_speaker_name_required(),
					},
				),
		),
		materials: z.array(
			z
				.object({
					label: z.string().max(L.shortText),
					url: z.union([
						z.literal(""),
						z
							.url({
								protocol: /^https?$/,
								error: () => admin_material_url_invalid(),
							})
							.max(L.url),
					]),
				})
				.refine((material) => material.url || !material.label.trim(), {
					path: ["url"],
					message: admin_material_url_required(),
				}),
		),
	})
	.refine(
		// An end before the start is on the next day (23:00–01:30); the same time is empty.
		// Zod runs this even when a field above failed, so compare only complete times.
		(value) =>
			!value.date ||
			!value.startTime ||
			!value.endTime ||
			value.endTime !== value.startTime,
		{ path: ["endTime"], message: admin_error_end_before_start() },
	);

type AgendaItemFormValues = z.infer<typeof agendaItemFormSchema>;

/** A new item in a session starts on the session's day, in its place. */
function toFormValues(
	item: AgendaItem | null,
	eventDate: Date,
	session: AgendaSession | null,
): AgendaItemFormValues {
	if (!item) {
		return {
			title: "",
			description: "",
			date: toEventDateInput(session ? new Date(session.startsAt) : eventDate),
			startTime: "",
			endTime: "",
			locationId: session?.locationId ?? NONE_VALUE,
			maxSeats: "",
			requiresRegistration: true,
			typeId: NONE_VALUE,
			facultyId: NONE_VALUE,
			topic: "",
			audience: "",
			languages: [],
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
		typeId: item.typeId ?? NONE_VALUE,
		facultyId: item.facultyId ?? NONE_VALUE,
		topic: item.topic ?? "",
		audience: item.audience ?? "",
		languages: item.languages,
		speakers: item.speakers.map((speaker) => ({
			name: speaker.name,
			affiliation: speaker.affiliation ?? "",
			unit: speaker.unit ?? "",
			bio: speaker.bio ?? "",
		})),
		materials: item.materials,
	};
}

/** The form's values as the server takes them: "none" and blanks become null. */
function toPayload(values: AgendaItemFormValues) {
	return {
		title: values.title,
		description: values.description.trim() || null,
		...fromEventWallTimeRange(values.date, values.startTime, values.endTime),
		locationId: values.locationId === NONE_VALUE ? null : values.locationId,
		maxSeats: values.maxSeats === "" ? null : Number(values.maxSeats),
		requiresRegistration: values.requiresRegistration,
		typeId: values.typeId === NONE_VALUE ? null : values.typeId,
		facultyId: values.facultyId === NONE_VALUE ? null : values.facultyId,
		topic: values.topic.trim() || null,
		audience: values.audience.trim() || null,
		languages: values.languages,
		// Empty rows are dropped; a link without a name shows its address.
		speakers: values.speakers
			.filter((speaker) => speaker.name.trim())
			.map(({ name, affiliation, unit, bio }) => ({
				name: name.trim(),
				affiliation: affiliation.trim() || undefined,
				unit: unit.trim() || undefined,
				bio: bio.trim() || undefined,
			})),
		materials: values.materials
			.filter((material) => material.url)
			.map((material) => ({
				label: material.label.trim() || material.url,
				url: material.url,
			})),
	};
}

type AgendaItemDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	eventId: string;
	eventDate: Date;
	item: AgendaItem | null;
	/** New items go into this session (F33). */
	session?: AgendaSession | null;
	/** Places, categories and units to pick from. */
	options: EventFilterOptions;
	onSaved: () => Promise<unknown>;
};

export function AgendaItemDialog({
	open,
	onOpenChange,
	eventId,
	eventDate,
	item,
	session = null,
	options,
	onSaved,
}: AgendaItemDialogProps) {
	const locale = getLocale();
	const saveMutation = useMutation({
		mutationFn: (values: AgendaItemFormValues) => {
			const payload = toPayload(values);
			return item
				? updateAdminAgendaItemServer({ data: { id: item.id, ...payload } })
				: createAdminAgendaItemServer({
						data: { eventId, sessionId: session?.id ?? null, ...payload },
					});
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
		defaultValues: toFormValues(item, eventDate, session),
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
			form.reset(toFormValues(item, eventDate, session));
		}
		wasOpen.current = open;
	}, [open, item, eventDate, session, form]);

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

			<form.Field name="typeId">
				{(field) => (
					<LookupSelect
						id={field.name}
						label={admin_field_item_type()}
						options={options.types}
						value={field.state.value}
						onChange={field.handleChange}
						disabled={disabled}
					/>
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
							<form.Subscribe
								selector={(state) =>
									endsNextDay(state.values.startTime, state.values.endTime)
								}
							>
								{(nextDay) =>
									nextDay ? (
										<p className="mt-1 font-mono text-xs">
											{admin_field_ends_next_day()}
										</p>
									) : null
								}
							</form.Subscribe>
						</div>
					)}
				</form.Field>
			</div>

			<form.Field name="locationId">
				{(field) => (
					<LookupSelect
						id={field.name}
						label={admin_field_room()}
						options={options.locations}
						value={field.state.value}
						onChange={field.handleChange}
						disabled={disabled}
					/>
				)}
			</form.Field>

			<form.Field name="facultyId">
				{(field) => (
					<LookupSelect
						id={field.name}
						label={admin_field_item_faculty()}
						options={options.faculties}
						value={field.state.value}
						onChange={field.handleChange}
						disabled={disabled}
					/>
				)}
			</form.Field>

			<div className="grid gap-3 sm:grid-cols-2">
				<form.Field name="topic">
					{(field) => (
						<div>
							<Label htmlFor={field.name}>{admin_field_topic()}</Label>
							<Input
								id={field.name}
								className="mt-1"
								maxLength={L.detail}
								disabled={disabled}
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
							/>
						</div>
					)}
				</form.Field>
				<form.Field name="audience">
					{(field) => (
						<div>
							<Label htmlFor={field.name}>{admin_field_audience()}</Label>
							<Input
								id={field.name}
								className="mt-1"
								maxLength={L.detail}
								placeholder={admin_field_audience_hint()}
								disabled={disabled}
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
							/>
						</div>
					)}
				</form.Field>
			</div>

			<form.Field name="languages">
				{(field) => (
					<fieldset>
						<legend className="text-sm font-medium">
							{admin_field_languages()}
						</legend>
						<div className="mt-1 flex flex-wrap gap-x-4 gap-y-2">
							{agendaLanguageOptions(locale).map(({ code, label }) => (
								<label key={code} className="flex items-center gap-2 text-sm">
									<input
										type="checkbox"
										className="size-4"
										disabled={disabled}
										checked={field.state.value.includes(code)}
										onChange={(event) =>
											field.handleChange(
												event.target.checked
													? [...field.state.value, code]
													: field.state.value.filter(
															(language) => language !== code,
														),
											)
										}
									/>
									{label}
								</label>
							))}
						</div>
					</fieldset>
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
									<form.Field name={`speakers[${index}].unit`}>
										{(field) => (
											<Input
												aria-label={admin_speaker_unit({ n })}
												placeholder={admin_speaker_unit({ n })}
												disabled={disabled}
												value={field.state.value}
												onChange={(event) =>
													field.handleChange(event.target.value)
												}
											/>
										)}
									</form.Field>
									<form.Field name={`speakers[${index}].bio`}>
										{(field) => (
											<Textarea
												aria-label={admin_speaker_bio({ n })}
												placeholder={admin_speaker_bio({ n })}
												rows={3}
												maxLength={L.bio}
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
							disabled={disabled || speakersField.state.value.length >= L.rows}
							onClick={() =>
								speakersField.pushValue({
									name: "",
									affiliation: "",
									unit: "",
									bio: "",
								})
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
							disabled={disabled || materialsField.state.value.length >= L.rows}
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
			<AgendaItemImage
				key={item?.id ?? "new"}
				item={item}
				onChanged={onSaved}
			/>
		</AdminFormDialog>
	);
}

type LookupSelectProps = {
	id: string;
	label: string;
	options: FilterOption[];
	value: string;
	onChange: (value: string) => void;
	disabled: boolean;
};

/** One of the event's lookup lists, with "none" first. */
function LookupSelect({
	id,
	label,
	options,
	value,
	onChange,
	disabled,
}: LookupSelectProps) {
	return (
		<div>
			<Label htmlFor={id}>{label}</Label>
			<Select value={value} onValueChange={onChange} disabled={disabled}>
				<SelectTrigger id={id} className="mt-1 w-full">
					<SelectValue placeholder={label} />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value={NONE_VALUE}>{admin_field_none()}</SelectItem>
					{options.map((option) => (
						<SelectItem key={option.id} value={option.id}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}
