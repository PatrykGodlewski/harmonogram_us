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
	admin_events_description,
	admin_events_title,
	admin_field_date,
	admin_field_faculty,
	admin_field_id,
	admin_field_id_optional,
	admin_field_id_placeholder,
	admin_field_location,
	admin_field_max_seats,
	admin_field_none,
	admin_field_title,
	admin_field_type,
	admin_nav_events,
	admin_save_success,
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
import { AdminEntityTable } from "@repo/ui/composed/admin/admin-entity-table";
import { AdminFormDialog } from "@repo/ui/composed/admin/admin-form-dialog";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { formatFieldError } from "../lib/format-field-error";
import { formatMutationError } from "../lib/format-mutation-error";

const NONE_VALUE = "__none__";

function formatDateTimeLocal(value: Date) {
	const pad = (part: number) => String(part).padStart(2, "0");
	return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function parseDateTimeLocal(value: string) {
	return new Date(value);
}

export function AdminEventsPage() {
	const queryClient = useQueryClient();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingRow, setEditingRow] = useState<EventWithRelations | null>(null);

	const eventSchema = useMemo(
		() =>
			z.object({
				id: formOptionalIdSchema,
				title: z.string().min(1).max(500),
				date: z.string().min(1),
				maxSeats: z.coerce.number().int().min(0),
				typeId: z.string().min(1),
				locationId: z.string(),
				facultyId: z.string(),
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
				date: parseDateTimeLocal(values.date),
				maxSeats: values.maxSeats,
				typeId: values.typeId,
				locationId: values.locationId === NONE_VALUE ? null : values.locationId,
				facultyId: values.facultyId === NONE_VALUE ? null : values.facultyId,
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
			date: "",
			maxSeats: 0,
			typeId: "",
			locationId: NONE_VALUE,
			facultyId: NONE_VALUE,
		},
		validators: {
			onSubmit: eventSchema,
		},
		onSubmit: ({ value }) => {
			saveMutation.mutate(value);
		},
	});

	const openCreateDialog = () => {
		setEditingRow(null);
		form.reset();
		setDialogOpen(true);
	};

	const openEditDialog = (row: EventWithRelations) => {
		setEditingRow(row);
		form.setFieldValue("id", row.id);
		form.setFieldValue("title", row.title);
		form.setFieldValue("date", formatDateTimeLocal(new Date(row.date)));
		form.setFieldValue("maxSeats", row.maxSeats);
		form.setFieldValue("typeId", row.typeId);
		form.setFieldValue("locationId", row.locationId ?? NONE_VALUE);
		form.setFieldValue("facultyId", row.facultyId ?? NONE_VALUE);
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
				onAdd={openCreateDialog}
				onEdit={openEditDialog}
				onDelete={handleDelete}
				columns={[
					{
						key: "title",
						header: admin_field_title(),
						cell: (row) => row.title,
					},
					{
						key: "date",
						header: admin_field_date(),
						cell: (row) =>
							new Date(row.date).toLocaleString(undefined, {
								dateStyle: "medium",
								timeStyle: "short",
							}),
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
