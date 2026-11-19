import { deleteAdminAgendaItemServer } from "@repo/api/admin/mutations";
import type { AgendaItem, FilterOption } from "@repo/api/admin/queries";
import {
	admin_action_delete,
	admin_action_edit,
	admin_delete_confirm,
	admin_delete_success,
	admin_error_generic,
	admin_event_agenda,
	admin_event_agenda_add,
	admin_event_agenda_empty,
	admin_event_places,
	admin_event_registered_count,
	event_details_no_registration,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import { markParallel } from "@repo/ui/agenda";
import { Button } from "@repo/ui/components/button";
import { formatEventTime } from "@repo/ui/time";
import { cn } from "@repo/ui/utils";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { formatMutationError } from "../../lib/format-mutation-error";
import { AgendaItemDialog } from "./agenda-item-dialog";

type AgendaEditorProps = {
	eventId: string;
	eventDate: Date;
	agenda: AgendaItem[];
	locations: FilterOption[];
	onChanged: () => Promise<unknown>;
};

export function AgendaEditor({
	eventId,
	eventDate,
	agenda,
	locations,
	onChanged,
}: AgendaEditorProps) {
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingItem, setEditingItem] = useState<AgendaItem | null>(null);
	const locale = getLocale();

	const deleteMutation = useMutation({
		mutationFn: (id: string) => deleteAdminAgendaItemServer({ data: { id } }),
		onSuccess: async () => {
			await onChanged();
			toast.success(admin_delete_success());
		},
		onError: (error) => {
			toast.error(formatMutationError(error, admin_error_generic));
		},
	});

	const handleAdd = () => {
		setEditingItem(null);
		setDialogOpen(true);
	};

	const handleEdit = (item: AgendaItem) => {
		setEditingItem(item);
		setDialogOpen(true);
	};

	const handleDelete = (item: AgendaItem) => {
		if (window.confirm(admin_delete_confirm())) {
			deleteMutation.mutate(item.id);
		}
	};

	return (
		<section className="flex flex-col gap-3">
			<div className="flex items-center justify-between gap-2">
				<h2 className="text-lg font-semibold">{admin_event_agenda()}</h2>
				<Button size="sm" onClick={handleAdd}>
					{admin_event_agenda_add()}
				</Button>
			</div>

			{agenda.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					{admin_event_agenda_empty()}
				</p>
			) : (
				<ol className="divide-y rounded-lg border">
					{markParallel(agenda).map((item) => (
						<li
							key={item.id}
							className={cn(
								"flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between",
								item.parallel && "pl-6",
							)}
						>
							<div className="flex flex-col gap-0.5">
								<p className="text-sm text-muted-foreground tabular-nums">
									{formatEventTime(item.startsAt, locale)}–
									{formatEventTime(item.endsAt, locale)}
									{item.locationLabel ? ` · ${item.locationLabel}` : ""}
								</p>
								<p className="font-medium">{item.title}</p>
								<p className="text-sm tabular-nums">
									{!item.requiresRegistration
										? event_details_no_registration()
										: item.maxSeats === null
											? admin_event_registered_count({
													registered: item.registeredCount,
												})
											: admin_event_places({
													registered: item.registeredCount,
													max: item.maxSeats,
												})}
								</p>
							</div>
							<div className="flex gap-2">
								<Button
									size="sm"
									variant="outline"
									onClick={() => handleEdit(item)}
								>
									{admin_action_edit()}
								</Button>
								<Button
									size="sm"
									variant="outline"
									disabled={deleteMutation.isPending}
									onClick={() => handleDelete(item)}
								>
									{admin_action_delete()}
								</Button>
							</div>
						</li>
					))}
				</ol>
			)}

			<AgendaItemDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				eventId={eventId}
				eventDate={eventDate}
				item={editingItem}
				locations={locations}
				onSaved={onChanged}
			/>
		</section>
	);
}
