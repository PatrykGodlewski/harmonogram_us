import type { LookupRow } from "@repo/db/queries/lookups";
import {
	admin_delete_confirm,
	admin_delete_success,
	admin_dialog_add_title,
	admin_dialog_edit_title,
	admin_error_generic,
	admin_field_id,
	admin_field_label,
	admin_field_slug,
	admin_field_sort_order,
	admin_save_success,
} from "@repo/i18n/paraglide/messages";
import { FormMessage } from "@repo/ui/components/form-message";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { AdminEntityTable } from "@repo/ui/composed/admin/admin-entity-table";
import { AdminFormDialog } from "@repo/ui/composed/admin/admin-form-dialog";
import { useForm } from "@tanstack/react-form";
import {
	useMutation,
	useQuery,
	useQueryClient,
	type QueryKey,
} from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

type LookupMutation<TInput> = {
	(data: { data: TInput }): Promise<unknown>;
};

export interface AdminLookupPageProps {
	entityName: string;
	title: string;
	description: string;
	queryKey: QueryKey;
	queryFn: () => Promise<LookupRow[]>;
	createFn: LookupMutation<{
		id: string;
		slug: string;
		label: string;
		sortOrder: number;
	}>;
	updateFn: LookupMutation<{
		id: string;
		slug?: string;
		label?: string;
		sortOrder?: number;
	}>;
	deleteFn: LookupMutation<{ id: string }>;
}

export function AdminLookupPage({
	entityName,
	title,
	description,
	queryKey,
	queryFn,
	createFn,
	updateFn,
	deleteFn,
}: AdminLookupPageProps) {
	const queryClient = useQueryClient();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingRow, setEditingRow] = useState<LookupRow | null>(null);

	const lookupSchema = useMemo(
		() =>
			z.object({
				id: z.string().min(1).max(100),
				slug: z.string().min(1).max(100),
				label: z.string().min(1).max(200),
				sortOrder: z.number().int().min(0),
			}),
		[],
	);

	const { data: rows = [], isLoading } = useQuery({
		queryKey,
		queryFn,
	});

	const invalidate = () => queryClient.invalidateQueries({ queryKey });

	const saveMutation = useMutation({
		mutationFn: async (values: z.infer<typeof lookupSchema>) => {
			if (editingRow) {
				return updateFn({
					data: {
						id: editingRow.id,
						slug: values.slug,
						label: values.label,
						sortOrder: values.sortOrder,
					},
				});
			}
			return createFn({ data: values });
		},
		onSuccess: async () => {
			await invalidate();
			setDialogOpen(false);
			setEditingRow(null);
			toast.success(admin_save_success());
		},
		onError: () => {
			toast.error(admin_error_generic());
		},
	});

	const deleteMutation = useMutation({
		mutationFn: async (id: string) => deleteFn({ data: { id } }),
		onSuccess: async () => {
			await invalidate();
			toast.success(admin_delete_success());
		},
		onError: () => {
			toast.error(admin_error_generic());
		},
	});

	const form = useForm({
		defaultValues: {
			id: "",
			slug: "",
			label: "",
			sortOrder: 0,
		},
		validators: {
			onSubmit: lookupSchema,
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

	const openEditDialog = (row: LookupRow) => {
		setEditingRow(row);
		form.setFieldValue("id", row.id);
		form.setFieldValue("slug", row.slug);
		form.setFieldValue("label", row.label);
		form.setFieldValue("sortOrder", row.sortOrder);
		setDialogOpen(true);
	};

	const handleDelete = (row: LookupRow) => {
		if (window.confirm(admin_delete_confirm())) {
			deleteMutation.mutate(row.id);
		}
	};

	return (
		<>
			<AdminEntityTable
				title={title}
				description={description}
				isLoading={isLoading}
				rows={rows}
				rowKey={(row) => row.id}
				onAdd={openCreateDialog}
				onEdit={openEditDialog}
				onDelete={handleDelete}
				columns={[
					{
						key: "id",
						header: admin_field_id(),
						cell: (row) => row.id,
					},
					{
						key: "slug",
						header: admin_field_slug(),
						cell: (row) => row.slug,
					},
					{
						key: "label",
						header: admin_field_label(),
						cell: (row) => row.label,
					},
					{
						key: "sortOrder",
						header: admin_field_sort_order(),
						cell: (row) => row.sortOrder,
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
						? admin_dialog_edit_title({ entity: entityName })
						: admin_dialog_add_title({ entity: entityName })
				}
				onSubmit={() => {
					void form.handleSubmit();
				}}
				isSubmitting={saveMutation.isPending}
			>
				<form.Field name="id">
					{(field) => (
						<div>
							<Label htmlFor={field.name}>{admin_field_id()}</Label>
							<Input
								id={field.name}
								className="mt-1"
								disabled={Boolean(editingRow) || saveMutation.isPending}
								value={String(field.state.value ?? "")}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
							/>
							{field.state.meta.errors.length > 0 ? (
								<FormMessage>{String(field.state.meta.errors[0])}</FormMessage>
							) : null}
						</div>
					)}
				</form.Field>

				<form.Field name="slug">
					{(field) => (
						<div>
							<Label htmlFor={field.name}>{admin_field_slug()}</Label>
							<Input
								id={field.name}
								className="mt-1"
								disabled={saveMutation.isPending}
								value={String(field.state.value ?? "")}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
							/>
							{field.state.meta.errors.length > 0 ? (
								<FormMessage>{String(field.state.meta.errors[0])}</FormMessage>
							) : null}
						</div>
					)}
				</form.Field>

				<form.Field name="label">
					{(field) => (
						<div>
							<Label htmlFor={field.name}>{admin_field_label()}</Label>
							<Input
								id={field.name}
								className="mt-1"
								disabled={saveMutation.isPending}
								value={String(field.state.value ?? "")}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
							/>
							{field.state.meta.errors.length > 0 ? (
								<FormMessage>{String(field.state.meta.errors[0])}</FormMessage>
							) : null}
						</div>
					)}
				</form.Field>

				<form.Field name="sortOrder">
					{(field) => (
						<div>
							<Label htmlFor={field.name}>{admin_field_sort_order()}</Label>
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
								<FormMessage>{String(field.state.meta.errors[0])}</FormMessage>
							) : null}
						</div>
					)}
				</form.Field>
			</AdminFormDialog>
		</>
	);
}
