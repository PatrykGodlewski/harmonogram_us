import {
	createAdminEventServer,
	updateAdminEventServer,
} from "@repo/api/admin/mutations";
import {
	adminEventFilterOptionsQueryOptions,
	type EventWithRelations,
	fetchAdminEventFilterOptionsServer,
} from "@repo/api/admin/queries";
import { formOptionalIdSchema } from "@repo/api/admin/schemas";
import {
	admin_dialog_add_title,
	admin_dialog_edit_title,
	admin_error_generic,
	admin_field_attendance_mode,
	admin_field_certificate_hint,
	admin_field_certificate_issuer,
	admin_field_certificate_note,
	admin_field_certificate_signer,
	admin_field_certificates,
	admin_field_certificates_hint,
	admin_field_date,
	admin_field_description,
	admin_field_ends_at,
	admin_field_faculty,
	admin_field_group_deadline_hours,
	admin_field_group_deadline_hours_hint,
	admin_field_id,
	admin_field_id_optional,
	admin_field_id_placeholder,
	admin_field_location,
	admin_field_max_seats,
	admin_field_none,
	admin_field_online_url,
	admin_field_reminder,
	admin_field_requires_approval,
	admin_field_requires_approval_hint,
	admin_field_room,
	admin_field_room_hint,
	admin_field_title,
	admin_field_type,
	admin_field_visibility,
	admin_nav_events,
	admin_reminder_1h,
	admin_reminder_24h,
	admin_reminder_48h,
	admin_reminder_off,
	admin_save_success,
	admin_visibility_authenticated,
	admin_visibility_private,
	admin_visibility_private_hint,
	admin_visibility_public,
	attendance_mode_hybrid,
	attendance_mode_online,
	attendance_mode_onsite,
} from "@repo/i18n/paraglide/messages";
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
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useMemo, useRef } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { formatFieldError } from "../lib/format-field-error";
import { formatMutationError } from "../lib/format-mutation-error";
import { TeamsMeetingButton } from "./teams-meeting-button";

const NONE_VALUE = "__none__";
/** Places a new event offers until the organizer changes it. */
const DEFAULT_MAX_SEATS = 50;

type AttendanceMode = EventWithRelations["attendanceMode"];
type EventVisibility = EventWithRelations["visibility"];

const ATTENDANCE_MODE_LABELS: Record<AttendanceMode, () => string> = {
	onsite: attendance_mode_onsite,
	online: attendance_mode_online,
	hybrid: attendance_mode_hybrid,
};

/** `datetime-local` value in Warsaw time (event times are always Polish time). */
function formatDateTimeLocal(value: Date) {
	return `${toEventDateInput(value)}T${toEventTimeInput(value)}`;
}

function parseDateTimeLocal(value: string) {
	const [date = "", time = "00:00"] = value.split("T");
	return fromEventWallTime(date, time);
}

const VISIBILITIES = ["public", "authenticated", "private"] as const;

/** The optional lines an organiser may put on certificates. */
const CERTIFICATE_FIELDS = [
	["certificateIssuer", admin_field_certificate_issuer],
	["certificateSigner", admin_field_certificate_signer],
	["certificateNote", admin_field_certificate_note],
] as const;

const VISIBILITY_LABELS: Record<EventVisibility, () => string> = {
	public: admin_visibility_public,
	authenticated: admin_visibility_authenticated,
	private: admin_visibility_private,
};

/** Reminder options offered in the form ("off" switches reminders off). */
const REMINDER_CHOICES = ["off", "1", "24", "48"] as const;
type ReminderChoice = (typeof REMINDER_CHOICES)[number];
const REMINDER_LABELS: Record<ReminderChoice, () => string> = {
	off: admin_reminder_off,
	"1": admin_reminder_1h,
	"24": admin_reminder_24h,
	"48": admin_reminder_48h,
};

function toReminderChoice(hours: number | null): ReminderChoice {
	if (hours === null) return "off";
	const choice = String(hours);
	return (REMINDER_CHOICES as readonly string[]).includes(choice)
		? (choice as ReminderChoice)
		: "24";
}

const EMPTY_VALUES = {
	id: "",
	title: "",
	description: "",
	date: "",
	endsAt: "",
	maxSeats: DEFAULT_MAX_SEATS,
	groupDeadlineHours: 48,
	typeId: "",
	locationId: NONE_VALUE,
	room: "",
	reminder: "24" as ReminderChoice,
	facultyId: NONE_VALUE,
	attendanceMode: "onsite" as AttendanceMode,
	visibility: "public" as EventVisibility,
	requiresApproval: false,
	certificatesEnabled: false,
	certificateIssuer: "",
	certificateSigner: "",
	certificateNote: "",
	onlineUrl: "",
};

type EventFormValues = typeof EMPTY_VALUES;

function toFormValues(event: EventWithRelations): EventFormValues {
	return {
		id: event.id,
		title: event.title,
		description: event.description ?? "",
		date: formatDateTimeLocal(new Date(event.date)),
		endsAt: event.endsAt ? formatDateTimeLocal(new Date(event.endsAt)) : "",
		maxSeats: event.maxSeats,
		groupDeadlineHours: event.groupDeadlineHours,
		typeId: event.typeId,
		locationId: event.locationId ?? NONE_VALUE,
		room: event.room ?? "",
		reminder: toReminderChoice(event.reminderHoursBefore),
		facultyId: event.facultyId ?? NONE_VALUE,
		attendanceMode: event.attendanceMode,
		visibility: event.visibility,
		requiresApproval: event.requiresApproval,
		certificatesEnabled: event.certificatesEnabled,
		certificateIssuer: event.certificateIssuer ?? "",
		certificateSigner: event.certificateSigner ?? "",
		certificateNote: event.certificateNote ?? "",
		onlineUrl: event.onlineUrl ?? "",
	};
}

export type EventFormDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** The event to edit; null creates a new one. */
	event: EventWithRelations | null;
	onSaved: () => Promise<unknown>;
};

/** The event form (create or edit), shared by the event list and the event page. */
export function EventFormDialog({
	open,
	onOpenChange,
	event,
	onSaved,
}: EventFormDialogProps) {
	const navigate = useNavigate();
	const certificateHintId = useId();
	const eventSchema = useMemo(
		() =>
			z.object({
				id: formOptionalIdSchema,
				title: z.string().min(1).max(500),
				description: z.string().max(5000),
				date: z.string().min(1),
				endsAt: z.string(),
				maxSeats: z.number().int().min(0),
				groupDeadlineHours: z.number().int().min(0).max(720),
				typeId: z.string().min(1),
				locationId: z.string(),
				room: z.string().max(100),
				reminder: z.enum(REMINDER_CHOICES),
				facultyId: z.string(),
				attendanceMode: z.enum(["onsite", "online", "hybrid"]),
				visibility: z.enum(VISIBILITIES),
				requiresApproval: z.boolean(),
				certificatesEnabled: z.boolean(),
				certificateIssuer: z.string().max(200),
				certificateSigner: z.string().max(200),
				certificateNote: z.string().max(200),
				onlineUrl: z.union([
					z.literal(""),
					z.url({ protocol: /^https$/ }).max(2000),
				]),
			}),
		[],
	);

	const { data: filterOptions } = useQuery({
		...adminEventFilterOptionsQueryOptions,
		queryFn: () => fetchAdminEventFilterOptionsServer(),
	});

	const saveMutation = useMutation({
		mutationFn: async (values: EventFormValues) => {
			const payload = {
				...(values.id.trim() ? { id: values.id.trim() } : {}),
				title: values.title,
				description: values.description.trim() || null,
				date: parseDateTimeLocal(values.date),
				endsAt: values.endsAt ? parseDateTimeLocal(values.endsAt) : null,
				maxSeats: values.maxSeats,
				groupDeadlineHours: values.groupDeadlineHours,
				typeId: values.typeId,
				locationId: values.locationId === NONE_VALUE ? null : values.locationId,
				room: values.room.trim() || null,
				reminderHoursBefore:
					values.reminder === "off" ? null : Number(values.reminder),
				facultyId: values.facultyId === NONE_VALUE ? null : values.facultyId,
				attendanceMode: values.attendanceMode,
				visibility: values.visibility,
				requiresApproval: values.requiresApproval,
				certificatesEnabled: values.certificatesEnabled,
				certificateIssuer: values.certificateIssuer.trim() || null,
				certificateSigner: values.certificateSigner.trim() || null,
				certificateNote: values.certificateNote.trim() || null,
				onlineUrl:
					values.attendanceMode === "onsite" || !values.onlineUrl.trim()
						? null
						: values.onlineUrl.trim(),
			};

			if (event) {
				return updateAdminEventServer({ data: { ...payload, id: event.id } });
			}
			return createAdminEventServer({ data: payload });
		},
		onSuccess: async (saved) => {
			await onSaved();
			onOpenChange(false);
			toast.success(admin_save_success());
			// A new event opens on its own page, where the publish checklist waits.
			if (!event && saved) {
				await navigate({
					to: "/events/$eventId",
					params: { eventId: saved.id },
				});
			}
		},
		onError: (error) => {
			toast.error(formatMutationError(error, admin_error_generic));
		},
	});

	// The form's defaults are the event itself: TanStack Form re-applies them while untouched.
	const defaultValues = useMemo(
		() => (event ? toFormValues(event) : EMPTY_VALUES),
		[event],
	);
	const form = useForm({
		defaultValues,
		validators: {
			onSubmit: eventSchema,
		},
		onSubmit: ({ value }) => {
			saveMutation.mutate(value);
		},
	});

	const firstTypeId = filterOptions?.types[0]?.id;
	// Each opening starts from the event (or an empty form); a new event gets the
	// first type, so it needs only a title, a date and a place or link.
	// Only when the dialog opens: a background refetch hands over a new event
	// object while someone is editing, and must not wipe their changes.
	const wasOpen = useRef(false);
	useEffect(() => {
		if (open && !wasOpen.current) {
			form.reset(defaultValues);
		}
		wasOpen.current = open;
	}, [open, defaultValues, form]);
	// The type options may arrive after the dialog opened.
	useEffect(() => {
		if (open && !event && firstTypeId && !form.getFieldValue("typeId")) {
			form.setFieldValue("typeId", firstTypeId);
		}
	}, [open, event, firstTypeId, form]);

	return (
		<AdminFormDialog
			open={open}
			onOpenChange={onOpenChange}
			title={
				event
					? admin_dialog_edit_title({ entity: admin_nav_events() })
					: admin_dialog_add_title({ entity: admin_nav_events() })
			}
			onSubmit={() => {
				void form.handleSubmit();
			}}
			isSubmitting={saveMutation.isPending}
		>
			<form.Field name="id">
				{(field) => (
					<div>
						<Label htmlFor={field.name}>
							{event ? admin_field_id() : admin_field_id_optional()}
						</Label>
						<Input
							id={field.name}
							className="mt-1"
							disabled={Boolean(event) || saveMutation.isPending}
							placeholder={event ? undefined : admin_field_id_placeholder()}
							value={String(field.state.value ?? "")}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
						/>
						{field.state.meta.errors.length > 0 ? (
							<FormMessage>
								{formatFieldError(field.state.meta.errors[0])}
							</FormMessage>
						) : null}
					</div>
				)}
			</form.Field>

			<form.Field name="title">
				{(field) => (
					<div>
						<Label htmlFor={field.name}>{admin_field_title()}</Label>
						<Input
							id={field.name}
							className="mt-1"
							disabled={saveMutation.isPending}
							value={String(field.state.value ?? "")}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
						/>
						{field.state.meta.errors.length > 0 ? (
							<FormMessage>
								{formatFieldError(field.state.meta.errors[0])}
							</FormMessage>
						) : null}
					</div>
				)}
			</form.Field>

			<form.Field name="date">
				{(field) => (
					<div>
						<Label htmlFor={field.name}>{admin_field_date()}</Label>
						<Input
							id={field.name}
							type="datetime-local"
							className="mt-1"
							disabled={saveMutation.isPending}
							value={String(field.state.value ?? "")}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
						/>
						{field.state.meta.errors.length > 0 ? (
							<FormMessage>
								{formatFieldError(field.state.meta.errors[0])}
							</FormMessage>
						) : null}
					</div>
				)}
			</form.Field>

			<form.Field name="endsAt">
				{(field) => (
					<div>
						<Label htmlFor={field.name}>{admin_field_ends_at()}</Label>
						<Input
							id={field.name}
							type="datetime-local"
							className="mt-1"
							disabled={saveMutation.isPending}
							value={String(field.state.value ?? "")}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
						/>
					</div>
				)}
			</form.Field>

			<form.Field name="description">
				{(field) => (
					<div>
						<Label htmlFor={field.name}>{admin_field_description()}</Label>
						<Textarea
							id={field.name}
							className="mt-1"
							rows={4}
							disabled={saveMutation.isPending}
							value={String(field.state.value ?? "")}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
						/>
					</div>
				)}
			</form.Field>

			<form.Field name="maxSeats">
				{(field) => (
					<div>
						<Label htmlFor={field.name}>{admin_field_max_seats()}</Label>
						<Input
							id={field.name}
							type="number"
							min={0}
							className="mt-1"
							disabled={saveMutation.isPending}
							value={String(field.state.value ?? 0)}
							onBlur={field.handleBlur}
							onChange={(event) =>
								field.handleChange(Number(event.target.value))
							}
						/>
						{field.state.meta.errors.length > 0 ? (
							<FormMessage>
								{formatFieldError(field.state.meta.errors[0])}
							</FormMessage>
						) : null}
					</div>
				)}
			</form.Field>

			<form.Field name="groupDeadlineHours">
				{(field) => (
					<div>
						<Label htmlFor={field.name}>
							{admin_field_group_deadline_hours()}
						</Label>
						<Input
							id={field.name}
							type="number"
							min={0}
							max={720}
							className="mt-1"
							disabled={saveMutation.isPending}
							value={String(field.state.value ?? 48)}
							onBlur={field.handleBlur}
							onChange={(event) =>
								field.handleChange(Number(event.target.value))
							}
						/>
						<p className="mt-1 text-xs text-muted-foreground">
							{admin_field_group_deadline_hours_hint()}
						</p>
						{field.state.meta.errors.length > 0 ? (
							<FormMessage>
								{formatFieldError(field.state.meta.errors[0])}
							</FormMessage>
						) : null}
					</div>
				)}
			</form.Field>

			<form.Field name="typeId">
				{(field) => (
					<div>
						<Label htmlFor={field.name}>{admin_field_type()}</Label>
						<Select
							value={String(field.state.value ?? "")}
							onValueChange={(value) => field.handleChange(value)}
							disabled={saveMutation.isPending}
						>
							<SelectTrigger id={field.name} className="mt-1 w-full">
								<SelectValue placeholder={admin_field_type()} />
							</SelectTrigger>
							<SelectContent>
								{filterOptions?.types.map((option) => (
									<SelectItem key={option.id} value={option.id}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{field.state.meta.errors.length > 0 ? (
							<FormMessage>
								{formatFieldError(field.state.meta.errors[0])}
							</FormMessage>
						) : null}
					</div>
				)}
			</form.Field>

			<form.Field name="locationId">
				{(field) => (
					<div>
						<Label htmlFor={field.name}>{admin_field_location()}</Label>
						<Select
							value={String(field.state.value ?? NONE_VALUE)}
							onValueChange={(value) => field.handleChange(value)}
							disabled={saveMutation.isPending}
						>
							<SelectTrigger id={field.name} className="mt-1 w-full">
								<SelectValue placeholder={admin_field_location()} />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE_VALUE}>{admin_field_none()}</SelectItem>
								{filterOptions?.locations.map((option) => (
									<SelectItem key={option.id} value={option.id}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				)}
			</form.Field>

			<form.Field name="room">
				{(field) => (
					<div>
						<Label htmlFor={field.name}>{admin_field_room()}</Label>
						<Input
							id={field.name}
							className="mt-1"
							maxLength={100}
							disabled={saveMutation.isPending}
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
						/>
						<p className="mt-1 text-xs text-muted-foreground">
							{admin_field_room_hint()}
						</p>
					</div>
				)}
			</form.Field>

			<form.Field name="attendanceMode">
				{(field) => (
					<div>
						<Label htmlFor={field.name}>{admin_field_attendance_mode()}</Label>
						<Select
							value={field.state.value}
							onValueChange={(value) =>
								field.handleChange(value as AttendanceMode)
							}
							disabled={saveMutation.isPending}
						>
							<SelectTrigger id={field.name} className="mt-1 w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{(Object.keys(ATTENDANCE_MODE_LABELS) as AttendanceMode[]).map(
									(mode) => (
										<SelectItem key={mode} value={mode}>
											{ATTENDANCE_MODE_LABELS[mode]()}
										</SelectItem>
									),
								)}
							</SelectContent>
						</Select>
					</div>
				)}
			</form.Field>

			<form.Subscribe selector={(state) => state.values.attendanceMode}>
				{(mode) =>
					mode === "onsite" ? null : (
						<form.Field name="onlineUrl">
							{(field) => (
								<div>
									<Label htmlFor={field.name}>{admin_field_online_url()}</Label>
									<Input
										id={field.name}
										type="url"
										inputMode="url"
										placeholder="https://"
										className="mt-1"
										disabled={saveMutation.isPending}
										value={field.state.value}
										onBlur={field.handleBlur}
										onChange={(event) => field.handleChange(event.target.value)}
									/>
									{field.state.meta.errors.length > 0 ? (
										<FormMessage>
											{formatFieldError(field.state.meta.errors[0])}
										</FormMessage>
									) : null}
									{/* The saved event must already be online: the server checks the stored mode. */}
									{event &&
									event.attendanceMode !== "onsite" &&
									!field.state.value.trim() ? (
										<div className="mt-2 flex">
											<TeamsMeetingButton
												eventId={event.id}
												onCreated={async (url) => field.handleChange(url)}
											/>
										</div>
									) : null}
								</div>
							)}
						</form.Field>
					)
				}
			</form.Subscribe>

			<form.Field name="reminder">
				{(field) => (
					<div>
						<Label htmlFor={field.name}>{admin_field_reminder()}</Label>
						<Select
							value={field.state.value}
							onValueChange={(value) =>
								field.handleChange(value as ReminderChoice)
							}
							disabled={saveMutation.isPending}
						>
							<SelectTrigger id={field.name} className="mt-1 w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{REMINDER_CHOICES.map((choice) => (
									<SelectItem key={choice} value={choice}>
										{REMINDER_LABELS[choice]()}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				)}
			</form.Field>

			<form.Field name="visibility">
				{(field) => (
					<div>
						<Label htmlFor={field.name}>{admin_field_visibility()}</Label>
						<Select
							value={field.state.value}
							onValueChange={(value) =>
								field.handleChange(value as EventVisibility)
							}
							disabled={saveMutation.isPending}
						>
							<SelectTrigger id={field.name} className="mt-1 w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{VISIBILITIES.map((visibility) => (
									<SelectItem key={visibility} value={visibility}>
										{VISIBILITY_LABELS[visibility]()}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{field.state.value === "private" ? (
							<p className="mt-1 text-xs text-muted-foreground">
								{admin_visibility_private_hint()}
							</p>
						) : null}
					</div>
				)}
			</form.Field>

			<form.Field name="requiresApproval">
				{(field) => (
					<div className="flex items-start gap-2">
						<input
							id={field.name}
							type="checkbox"
							className="mt-0.5 size-4 accent-primary"
							checked={field.state.value}
							disabled={saveMutation.isPending}
							aria-describedby={`${field.name}-hint`}
							onChange={(event) => field.handleChange(event.target.checked)}
						/>
						<div>
							<Label htmlFor={field.name}>
								{admin_field_requires_approval()}
							</Label>
							<p
								id={`${field.name}-hint`}
								className="text-xs text-muted-foreground"
							>
								{admin_field_requires_approval_hint()}
							</p>
						</div>
					</div>
				)}
			</form.Field>

			<form.Field name="certificatesEnabled">
				{(field) => (
					<div className="flex items-start gap-2">
						<input
							id={field.name}
							type="checkbox"
							className="mt-0.5 size-4 accent-primary"
							checked={field.state.value}
							disabled={saveMutation.isPending}
							aria-describedby={`${field.name}-hint`}
							onChange={(event) => field.handleChange(event.target.checked)}
						/>
						<div>
							<Label htmlFor={field.name}>{admin_field_certificates()}</Label>
							<p
								id={`${field.name}-hint`}
								className="text-xs text-muted-foreground"
							>
								{admin_field_certificates_hint()}
							</p>
						</div>
					</div>
				)}
			</form.Field>

			<form.Subscribe selector={(state) => state.values.certificatesEnabled}>
				{(enabled) =>
					enabled ? (
						<fieldset className="flex flex-col gap-3 rounded-md border p-3">
							<legend className="px-1 text-sm font-medium">
								{admin_field_certificates()}
							</legend>
							{CERTIFICATE_FIELDS.map(([name, label]) => (
								<form.Field key={name} name={name}>
									{(field) => (
										<div>
											<Label htmlFor={field.name}>{label()}</Label>
											<Input
												id={field.name}
												className="mt-1"
												maxLength={200}
												aria-describedby={certificateHintId}
												disabled={saveMutation.isPending}
												value={field.state.value}
												onChange={(event) =>
													field.handleChange(event.target.value)
												}
											/>
										</div>
									)}
								</form.Field>
							))}
							<p
								id={certificateHintId}
								className="text-xs text-muted-foreground"
							>
								{admin_field_certificate_hint()}
							</p>
						</fieldset>
					) : null
				}
			</form.Subscribe>

			<form.Field name="facultyId">
				{(field) => (
					<div>
						<Label htmlFor={field.name}>{admin_field_faculty()}</Label>
						<Select
							value={String(field.state.value ?? NONE_VALUE)}
							onValueChange={(value) => field.handleChange(value)}
							disabled={saveMutation.isPending}
						>
							<SelectTrigger id={field.name} className="mt-1 w-full">
								<SelectValue placeholder={admin_field_faculty()} />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE_VALUE}>{admin_field_none()}</SelectItem>
								{filterOptions?.faculties.map((option) => (
									<SelectItem key={option.id} value={option.id}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				)}
			</form.Field>
		</AdminFormDialog>
	);
}
