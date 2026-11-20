import { deleteAdminEventServer } from "@repo/api/admin/mutations";
import {
	adminEventsQueryOptions,
	type EventWithRelations,
	fetchAdminEventsServer,
} from "@repo/api/admin/queries";
import {
	admin_delete_confirm,
	admin_delete_success,
	admin_error_generic,
	admin_event_status_draft,
	admin_event_status_published,
	admin_events_description,
	admin_events_title,
	admin_field_date,
	admin_field_faculty,
	admin_field_location,
	admin_field_max_seats,
	admin_field_none,
	admin_field_status,
	admin_field_title,
	admin_field_type,
	event_status_cancelled,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import { Badge } from "@repo/ui/components/badge";
import { AdminEntityTable } from "@repo/ui/composed/admin/admin-entity-table";
import { formatEventDateTime } from "@repo/ui/time";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { formatMutationError } from "../lib/format-mutation-error";
import { EventFormDialog } from "./event-form-dialog";

export function AdminEventsPage({
	canCreateEvents,
}: {
	/** Organizers and admins add events; co-organizers only edit theirs. */
	canCreateEvents: boolean;
}) {
	const queryClient = useQueryClient();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingRow, setEditingRow] = useState<EventWithRelations | null>(null);

	const { data: rows = [], isLoading } = useQuery({
		...adminEventsQueryOptions("desc"),
		queryFn: () => fetchAdminEventsServer({ data: { sortOrder: "desc" } }),
	});

	const invalidate = async () => {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: ["admin", "events"] }),
			queryClient.invalidateQueries({
				queryKey: ["admin", "event-filter-options"],
			}),
		]);
	};

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

	const openCreateDialog = () => {
		setEditingRow(null);
		setDialogOpen(true);
	};

	const openEditDialog = (row: EventWithRelations) => {
		setEditingRow(row);
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

			<EventFormDialog
				open={dialogOpen}
				onOpenChange={(open) => {
					setDialogOpen(open);
					if (!open) {
						setEditingRow(null);
					}
				}}
				event={editingRow}
				onSaved={invalidate}
			/>
		</>
	);
}
