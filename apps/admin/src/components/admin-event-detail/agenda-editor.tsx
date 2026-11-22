import { deleteAdminAgendaItemServer } from "@repo/api/admin/mutations";
import type {
	AgendaItem,
	AgendaSession,
	FilterOption,
} from "@repo/api/admin/queries";
import { deleteAgendaSessionServer } from "@repo/api/admin/sessions";
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
	admin_session_add,
	admin_session_empty,
	admin_session_programme,
	event_details_no_registration,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import {
	markParallel,
	type ProgrammeEntry,
	programmeEntries,
	programmeNowIndex,
} from "@repo/ui/agenda";
import { Button } from "@repo/ui/components/button";
import { AgendaCalendarGrid } from "@repo/ui/composed/agenda-calendar-grid";
import { AgendaNowDivider, useNow } from "@repo/ui/composed/agenda-now";
import {
	type AgendaViewMode,
	AgendaViewToggle,
} from "@repo/ui/composed/agenda-view-toggle";
import { formatEventTime } from "@repo/ui/time";
import { cn } from "@repo/ui/utils";
import { useMutation } from "@tanstack/react-query";
import { Fragment, useId, useState } from "react";
import { toast } from "sonner";
import { formatMutationError } from "../../lib/format-mutation-error";
import { AgendaItemDialog } from "./agenda-item-dialog";
import { SessionCard } from "./session-card";
import { SessionCopyDialog } from "./session-copy-dialog";
import { SessionDialog } from "./session-dialog";

type AgendaEditorProps = {
	eventId: string;
	eventDate: Date;
	agenda: AgendaItem[];
	/**
	 * The event's sessions (F33): the list shows them with the items outside any
	 * session. Omitted inside a session, where `session` scopes the editor.
	 */
	sessions?: AgendaSession[];
	session?: AgendaSession;
	locations: FilterOption[];
	onChanged: () => Promise<unknown>;
	view: AgendaViewMode;
	onViewChange: (view: AgendaViewMode) => void;
};

function placesLabel(item: AgendaItem): string {
	if (!item.requiresRegistration) {
		return event_details_no_registration();
	}
	return item.maxSeats === null
		? admin_event_registered_count({ registered: item.registeredCount })
		: admin_event_places({
				registered: item.registeredCount,
				max: item.maxSeats,
			});
}

export function AgendaEditor({
	eventId,
	eventDate,
	agenda,
	sessions,
	session,
	locations,
	onChanged,
	view,
	onViewChange,
}: AgendaEditorProps) {
	const headingId = useId();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingItem, setEditingItem] = useState<AgendaItem | null>(null);
	const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
	const [editingSession, setEditingSession] = useState<AgendaSession | null>(
		null,
	);
	const [copying, setCopying] = useState<AgendaSession | null>(null);
	const locale = getLocale();
	const now = useNow();

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

	const deleteSessionMutation = useMutation({
		mutationFn: (id: string) => deleteAgendaSessionServer({ data: { id } }),
		onSuccess: async () => {
			await onChanged();
			toast.success(admin_delete_success());
		},
		onError: (error) => {
			toast.error(formatMutationError(error, admin_error_generic));
		},
	});

	const handleAddSession = () => {
		setEditingSession(null);
		setSessionDialogOpen(true);
	};

	const handleEditSession = (target: AgendaSession) => {
		setEditingSession(target);
		setSessionDialogOpen(true);
	};

	// At event level the list shows sessions and the items outside them, in time order;
	// inside a session, its items.
	const entries: ProgrammeEntry<AgendaItem, AgendaSession>[] = sessions
		? programmeEntries(agenda, sessions)
		: markParallel(agenda).map((item) => ({ kind: "item", item }));
	const nowIndex = now ? programmeNowIndex(entries, now) : null;
	const itemCountOf = (sessionId: string) =>
		agenda.filter((item) => item.sessionId === sessionId).length;
	const locationOf = (item: AgendaItem) =>
		item.locationLabel ??
		(session && item.sessionId === session.id ? session.locationLabel : null);

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
		<section aria-labelledby={headingId} className="flex flex-col gap-3">
			<div className="flex items-center justify-between gap-2">
				<h2 id={headingId} className="text-lg font-semibold">
					{session ? admin_session_programme() : admin_event_agenda()}
				</h2>
				<div className="flex flex-wrap items-center justify-end gap-2">
					{agenda.length > 0 ? (
						<AgendaViewToggle value={view} onChange={onViewChange} />
					) : null}
					{sessions ? (
						<Button size="sm" variant="outline" onClick={handleAddSession}>
							{admin_session_add()}
						</Button>
					) : null}
					<Button size="sm" onClick={handleAdd}>
						{admin_event_agenda_add()}
					</Button>
				</div>
			</div>

			{entries.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					{session ? admin_session_empty() : admin_event_agenda_empty()}
				</p>
			) : view === "calendar" ? (
				<AgendaCalendarGrid
					items={agenda}
					onSelect={handleEdit}
					renderBlock={(item) => (
						<>
							<span className="tabular-nums text-muted-foreground">
								{formatEventTime(item.startsAt, locale)}–
								{formatEventTime(item.endsAt, locale)}
								{item.locationLabel ? ` · ${item.locationLabel}` : ""}
							</span>
							<span className="line-clamp-2 font-medium">{item.title}</span>
							<span className="tabular-nums">{placesLabel(item)}</span>
						</>
					)}
				/>
			) : (
				<ol className="divide-y rounded-lg border">
					{entries.map((entry, index) =>
						entry.kind === "session" ? (
							<Fragment key={entry.session.id}>
								{index === nowIndex && now ? (
									<AgendaNowDivider now={now} />
								) : null}
								<SessionCard
									session={entry.session}
									itemCount={itemCountOf(entry.session.id)}
									deleting={deleteSessionMutation.isPending}
									onCopy={() => setCopying(entry.session)}
									onEdit={() => handleEditSession(entry.session)}
									onDelete={() =>
										deleteSessionMutation.mutate(entry.session.id)
									}
								/>
							</Fragment>
						) : (
							<Fragment key={entry.item.id}>
								{index === nowIndex && now ? (
									<AgendaNowDivider now={now} />
								) : null}
								<li
									className={cn(
										"flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between",
										entry.item.parallel && "pl-6",
									)}
								>
									<div className="flex flex-col gap-0.5">
										<p className="text-sm text-muted-foreground tabular-nums">
											{formatEventTime(entry.item.startsAt, locale)}–
											{formatEventTime(entry.item.endsAt, locale)}
											{locationOf(entry.item)
												? ` · ${locationOf(entry.item)}`
												: ""}
										</p>
										<p className="font-medium">{entry.item.title}</p>
										{entry.item.speakers.length > 0 ? (
											<p className="text-sm text-muted-foreground">
												{entry.item.speakers
													.map((speaker) => speaker.name)
													.join(", ")}
											</p>
										) : null}
										<p className="text-sm tabular-nums">
											{placesLabel(entry.item)}
										</p>
									</div>
									<div className="flex gap-2">
										<Button
											size="sm"
											variant="outline"
											onClick={() => handleEdit(entry.item)}
										>
											{admin_action_edit()}
										</Button>
										<Button
											size="sm"
											variant="outline"
											disabled={deleteMutation.isPending}
											onClick={() => handleDelete(entry.item)}
										>
											{admin_action_delete()}
										</Button>
									</div>
								</li>
							</Fragment>
						),
					)}
					{nowIndex === entries.length && now ? (
						<AgendaNowDivider now={now} />
					) : null}
				</ol>
			)}

			<AgendaItemDialog
				open={dialogOpen}
				onOpenChange={setDialogOpen}
				eventId={eventId}
				eventDate={eventDate}
				item={editingItem}
				session={session ?? null}
				locations={locations}
				onSaved={onChanged}
			/>
			{sessions ? (
				<>
					<SessionDialog
						open={sessionDialogOpen}
						onOpenChange={setSessionDialogOpen}
						eventId={eventId}
						eventDate={eventDate}
						session={editingSession}
						locations={locations}
						onSaved={onChanged}
					/>
					<SessionCopyDialog
						session={copying}
						onOpenChange={(open) => {
							if (!open) setCopying(null);
						}}
						locations={locations}
						onCopied={onChanged}
					/>
				</>
			) : null}
		</section>
	);
}
