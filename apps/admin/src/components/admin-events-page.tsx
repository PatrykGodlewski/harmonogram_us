import {
	createAdminEventServer,
	deleteAdminEventServer,
	updateAdminEventServer,
} from "@repo/api/admin/mutations";
import {
	adminEventFilterOptionsQueryOptions,
	adminEventsQueryOptions,
	type EventWithRelations,
	fetchAdminEventFilterOptionsServer,
	fetchAdminEventsServer,
} from "@repo/api/admin/queries";
import { formOptionalIdSchema } from "@repo/api/admin/schemas";
import {
	admin_delete_confirm,
	admin_delete_success,
	admin_dialog_add_title,
	admin_dialog_edit_title,
	admin_error_generic,
	admin_event_status_draft,
	admin_event_status_published,
	admin_events_description,
	admin_events_title,
	admin_field_attendance_mode,
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
	admin_field_status,
	admin_field_title,
	admin_field_type,
	admin_nav_events,
	admin_save_success,
	attendance_mode_hybrid,
	attendance_mode_online,
	attendance_mode_onsite,
	event_status_cancelled,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import { Badge } from "@repo/ui/components/badge";
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
import { AdminEntityTable } from "@repo/ui/composed/admin/admin-entity-table";
import { AdminFormDialog } from "@repo/ui/composed/admin/admin-form-dialog";
import {
	formatEventDateTime,
	fromEventWallTime,
	toEventDateInput,
	toEventTimeInput,
} from "@repo/ui/time";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { formatFieldError } from "../lib/format-field-error";
import { formatMutationError } from "../lib/format-mutation-error";

const NONE_VALUE = "__none__";
/** Places a new event offers until the organizer changes it. */
const DEFAULT_MAX_SEATS = 50;

type AttendanceMode = EventWithRelations["attendanceMode"];

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

export function AdminEventsPage({
	canCreateEvents,
}: {
	/** Organizers and admins add events; co-organizers only edit theirs. */
	canCreateEvents: boolean;
}) {
	const queryClient = useQueryClient();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingRow, setEditingRow] = useState<EventWithRelations | null>(null);

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
				facultyId: z.string(),
				attendanceMode: z.enum(["onsite", "online", "hybrid"]),
				onlineUrl: z.union([
					z.literal(""),
					z.url({ protocol: /^https$/ }).max(2000),
				]),
			}),
		[],
	);

	const { data: rows = [], isLoading } = useQuery({
		...adminEventsQueryOptions("desc"),
		queryFn: () => fetchAdminEventsServer({ data: { sortOrder: "desc" } }),
	});

	const { data: filterOptions } = useQuery({
		...adminEventFilterOptionsQueryOptions,
		queryFn: () => fetchAdminEventFilterOptionsServer(),
	});

	const invalidate = async () => {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: ["admin", "events"] }),
			queryClient.invalidateQueries({
				queryKey: ["admin", "event-filter-options"],
			}),
		]);
	};

	const saveMutation = useMutation({
		mutationFn: async (values: z.infer<typeof eventSchema>) => {
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
				facultyId: values.facultyId === NONE_VALUE ? null : values.facultyId,
				attendanceMode: values.attendanceMode,
				onlineUrl:
					values.attendanceMode === "onsite" || !values.onlineUrl.trim()
						? null
						: values.onlineUrl.trim(),
			};

			if (editingRow) {
				return updateAdminEventServer({
					data: { ...payload, id: editingRow.id },
				});
			}
			return createAdminEventServer({ data: payload });
		},
		onSuccess: async () => {
			await invalidate();
			setDialogOpen(false);
			setEditingRow(null);
			toast.success(admin_save_success());
		},
		onError: (error) => {
			toast.error(formatMutationError(error, admin_error_generic));
		},
	});

	const deleteMutation = useMutation({
		mutationFn: async (id: string) => deleteAdminEventServer({ data: { id } }),
		onSuccess: async () => {
			await invalidate();
			toast.success(admin_delete_success());
		},
		onError: (error) => {
			toast.error(formatMutationError(error, admin_error_generic));
		},
	});

	const form = useForm({
		defaultValues: {
			id: "",
			title: "",
			description: "",
			date: "",
			endsAt: "",
			maxSeats: DEFAULT_MAX_SEATS,
			groupDeadlineHours: 48,
			typeId: "",
			locationId: NONE_VALUE,
			facultyId: NONE_VALUE,
			attendanceMode: "onsite" as AttendanceMode,
			onlineUrl: "",
		},
		validators: {
			onSubmit: eventSchema,
		},
		onSubmit: ({ value }) => {
			saveMutation.mutate(value);
		},
	});

	const firstTypeId = filterOptions?.types[0]?.id;
	// Sensible default: the first type, so a new event needs only a title, a date and a place or link.
	// The options may arrive after the dialog opened.
	useEffect(() => {
		if (
			dialogOpen &&
			!editingRow &&
			firstTypeId &&
			!form.getFieldValue("typeId")
		) {
			form.setFieldValue("typeId", firstTypeId);
		}
	}, [dialogOpen, editingRow, firstTypeId, form]);

	const openCreateDialog = () => {
		setEditingRow(null);
		form.reset();
		if (firstTypeId) {
			form.setFieldValue("typeId", firstTypeId);
		}
		setDialogOpen(true);
	};

	const openEditDialog = (row: EventWithRelations) => {
		setEditingRow(row);
		form.setFieldValue("id", row.id);
		form.setFieldValue("title", row.title);
		form.setFieldValue("description", row.description ?? "");
		form.setFieldValue("date", formatDateTimeLocal(new Date(row.date)));
		form.setFieldValue(
			"endsAt",
			row.endsAt ? formatDateTimeLocal(new Date(row.endsAt)) : "",
		);
		form.setFieldValue("maxSeats", row.maxSeats);
		form.setFieldValue("groupDeadlineHours", row.groupDeadlineHours);
		form.setFieldValue("typeId", row.typeId);
		form.setFieldValue("locationId", row.locationId ?? NONE_VALUE);
		form.setFieldValue("facultyId", row.facultyId ?? NONE_VALUE);
		form.setFieldValue("attendanceMode", row.attendanceMode);
		form.setFieldValue("onlineUrl", row.onlineUrl ?? "");
		setDialogOpen(true);
	};

	const handleDelete = (row: EventWithRelations) => {
		if (window.confirm(admin_delete_confirm())) {
			deleteMutation.mutate(row.id);
		}
	};

	return (
		<>
			<AdminEntityTable
				title={admin_events_title()}
				description={admin_events_description()}
				isLoading={isLoading}
				rows={rows}
				rowKey={(row) => row.id}
				onAdd={canCreateEvents ? openCreateDialog : undefined}
				onEdit={openEditDialog}
				onDelete={handleDelete}
				columns={[
					{
						key: "title",
						header: admin_field_title(),
						cell: (row) => (
							<Link
								to="/events/$eventId"
								params={{ eventId: row.id }}
								className="font-medium hover:underline"
							>
								{row.title}
							</Link>
						),
					},
					{
						key: "status",
						header: admin_field_status(),
						cell: (row) =>
							row.status === "draft" ? (
								<Badge variant="secondary">{admin_event_status_draft()}</Badge>
							) : row.status === "cancelled" ? (
								<Badge variant="destructive">{event_status_cancelled()}</Badge>
							) : (
								admin_event_status_published()
							),
					},
					{
						key: "date",
						header: admin_field_date(),
						cell: (row) => formatEventDateTime(row.date, getLocale()),
					},
					{
						key: "type",
						header: admin_field_type(),
						cell: (row) => row.typeLabel,
					},
					{
						key: "location",
						header: admin_field_location(),
						cell: (row) => row.locationLabel ?? admin_field_none(),
					},
					{
						key: "faculty",
						header: admin_field_faculty(),
						cell: (row) => row.facultyLabel ?? admin_field_none(),
					},
					{
						key: "maxSeats",
						header: admin_field_max_seats(),
						cell: (row) => row.maxSeats,
					},
				]}
			/>

			<AdminFormDialog
				open={dialogOpen}
				onOpenChange={(open) => {
					setDialogOpen(open);
					if (!open) {
						setEditingRow(null);
					}
				}}
				title={
					editingRow
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
								{editingRow ? admin_field_id() : admin_field_id_optional()}
							</Label>
							<Input
								id={field.name}
								className="mt-1"
								disabled={Boolean(editingRow) || saveMutation.isPending}
								placeholder={
									editingRow ? undefined : admin_field_id_placeholder()
								}
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
									<SelectItem value={NONE_VALUE}>
										{admin_field_none()}
									</SelectItem>
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

				<form.Field name="attendanceMode">
					{(field) => (
						<div>
							<Label htmlFor={field.name}>
								{admin_field_attendance_mode()}
							</Label>
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
									{(
										Object.keys(ATTENDANCE_MODE_LABELS) as AttendanceMode[]
									).map((mode) => (
										<SelectItem key={mode} value={mode}>
											{ATTENDANCE_MODE_LABELS[mode]()}
										</SelectItem>
									))}
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
										<Label htmlFor={field.name}>
											{admin_field_online_url()}
										</Label>
										<Input
											id={field.name}
											type="url"
											inputMode="url"
											placeholder="https://"
											className="mt-1"
											disabled={saveMutation.isPending}
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(event) =>
												field.handleChange(event.target.value)
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
						)
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
									<SelectItem value={NONE_VALUE}>
										{admin_field_none()}
									</SelectItem>
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
		</>
	);
}
