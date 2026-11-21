import { setCheckedInServer } from "@repo/api/admin/check-in";
import type { AgendaItem, EventRegistrant } from "@repo/api/admin/queries";
import {
	type EventQuestion,
	eventQuestionsQueryOptions,
} from "@repo/api/admin/questions";
import { removeRegistrantServer } from "@repo/api/admin/registrants";
import {
	admin_action_cancel,
	admin_approval_show,
	admin_approval_waiting,
	admin_approve,
	admin_attendance,
	admin_attendance_count,
	admin_bulk_select,
	admin_bulk_select_all,
	admin_error_generic,
	admin_event_registrants,
	admin_event_registrants_empty,
	admin_group_badge,
	admin_group_unnamed,
	admin_registrant_pending,
	admin_registrant_rejected,
	admin_registrant_waitlisted,
	admin_registrants_filter,
	admin_registrants_filter_all,
	admin_registrants_filter_pending,
	admin_registrants_filter_registered,
	admin_registrants_filter_rejected,
	admin_registrants_filter_waitlisted,
	admin_registrants_no_match,
	admin_registrants_remove,
	admin_registrants_remove_body,
	admin_registrants_remove_title,
	admin_registrants_removed,
	admin_registrants_search,
	admin_reject,
	answers_no,
	answers_yes,
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
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { formatEventDateTime } from "@repo/ui/time";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { formatMutationError } from "~/lib/format-mutation-error";
import { AddRegistrantDialog } from "./add-registrant-dialog";
import { BulkActionsBar } from "./bulk-actions-bar";
import { EditAnswers } from "./edit-answers-dialog";
import { RegistrantExports } from "./registrant-exports";
import { useApprovalActions } from "./use-approval-actions";

type StateFilter = "all" | EventRegistrant["state"];

const FILTER_LABELS: Record<StateFilter, () => string> = {
	all: admin_registrants_filter_all,
	registered: admin_registrants_filter_registered,
	waitlisted: admin_registrants_filter_waitlisted,
	pending: admin_registrants_filter_pending,
	rejected: admin_registrants_filter_rejected,
};

const isRequest = (registrant: EventRegistrant) =>
	registrant.state === "pending" || registrant.state === "rejected";

/** At the door only people with a place or on the waitlist matter. */
const isAtDoor = (registrant: EventRegistrant) =>
	registrant.state === "registered" || registrant.state === "waitlisted";

type RegistrantsListProps = {
	eventId: string;
	eventTitle: string;
	registrants: EventRegistrant[];
	agenda: AgendaItem[];
	/** "checkin": a helper at the door marks attendance; nothing else changes. */
	mode: "manage" | "checkin";
	onChanged: () => Promise<unknown>;
};

export function RegistrantsList({
	eventId,
	eventTitle,
	registrants: allRegistrants,
	agenda,
	mode,
	onChanged,
}: RegistrantsListProps) {
	const canManage = mode === "manage";
	const registrants = canManage
		? allRegistrants
		: allRegistrants.filter(isAtDoor);
	const approval = useApprovalActions(eventId, onChanged);
	// Answers are for those who manage the event (helpers at the door don't need them).
	const { data: questions = [] } = useQuery({
		...eventQuestionsQueryOptions(eventId),
		enabled: canManage,
	});
	const pendingCount = registrants.filter(
		(registrant) => registrant.state === "pending",
	).length;
	const headingId = useId();
	const searchId = useId();
	const filterId = useId();
	const selectAllId = useId();
	const [search, setSearch] = useState("");
	const [stateFilter, setStateFilter] = useState<StateFilter>("all");
	const titleById = new Map(agenda.map((item) => [item.id, item.title]));
	const needle = search.trim().toLowerCase();
	const visible = registrants.filter(
		(registrant) =>
			(stateFilter === "all" || registrant.state === stateFilter) &&
			(!needle ||
				registrant.email.toLowerCase().includes(needle) ||
				(registrant.name ?? "").toLowerCase().includes(needle)),
	);

	// Selection for bulk actions; ids that left the list drop out on their own.
	const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
	const selectedIds = registrants
		.map((registrant) => registrant.registrationId)
		.filter((id) => selected.has(id));
	const allVisibleSelected =
		visible.length > 0 &&
		visible.every((registrant) => selected.has(registrant.registrationId));
	const handleSelect = (id: string, isSelected: boolean) =>
		setSelected((current) => {
			const next = new Set(current);
			if (isSelected) next.add(id);
			else next.delete(id);
			return next;
		});
	const handleSelectAllVisible = (isSelected: boolean) =>
		setSelected(
			isSelected
				? new Set([
						...selected,
						...visible.map((registrant) => registrant.registrationId),
					])
				: new Set(),
		);

	const registeredCount = registrants.filter(
		(registrant) => registrant.state === "registered",
	).length;
	const presentCount = registrants.filter(
		(registrant) => registrant.checkedInAt !== null,
	).length;

	return (
		<section aria-labelledby={headingId} className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div>
					<h2 id={headingId} className="text-lg font-semibold">
						{admin_event_registrants({ count: registrants.length })}
					</h2>
					<p className="text-sm text-muted-foreground tabular-nums">
						{admin_attendance_count({
							present: presentCount,
							registered: registeredCount,
						})}
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					{canManage ? (
						<AddRegistrantDialog eventId={eventId} onAdded={onChanged} />
					) : null}
					{canManage ? (
						<RegistrantExports
							eventTitle={eventTitle}
							registrants={registrants}
							agenda={agenda}
							questions={questions}
						/>
					) : null}
				</div>
			</div>
			{canManage && pendingCount > 0 ? (
				<div
					role="status"
					className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-950"
				>
					<p className="font-medium">
						{admin_approval_waiting({ count: pendingCount })}
					</p>
					{stateFilter === "pending" ? null : (
						<Button
							size="sm"
							variant="outline"
							onClick={() => setStateFilter("pending")}
						>
							{admin_approval_show()}
						</Button>
					)}
				</div>
			) : null}
			{registrants.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					{admin_event_registrants_empty()}
				</p>
			) : (
				<>
					<div className="grid gap-2 sm:grid-cols-[1fr_auto]">
						<div className="flex flex-col gap-1">
							<Label htmlFor={searchId}>{admin_registrants_search()}</Label>
							<Input
								id={searchId}
								type="search"
								value={search}
								onChange={(event) => setSearch(event.target.value)}
							/>
						</div>
						<div className="flex flex-col gap-1">
							<Label htmlFor={filterId}>{admin_registrants_filter()}</Label>
							<Select
								value={stateFilter}
								onValueChange={(value) => setStateFilter(value as StateFilter)}
							>
								<SelectTrigger id={filterId} className="w-full sm:w-44">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{(Object.keys(FILTER_LABELS) as StateFilter[]).map((key) => (
										<SelectItem key={key} value={key}>
											{FILTER_LABELS[key]()}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
					{visible.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							{admin_registrants_no_match()}
						</p>
					) : (
						<>
							{canManage ? (
								<div className="flex items-center gap-2 px-1">
									<input
										id={selectAllId}
										type="checkbox"
										className="size-5 accent-primary"
										checked={allVisibleSelected}
										onChange={(event) =>
											handleSelectAllVisible(event.target.checked)
										}
									/>
									<Label htmlFor={selectAllId}>{admin_bulk_select_all()}</Label>
								</div>
							) : null}
							<ul className="divide-y rounded-lg border">
								{visible.map((registrant) => (
									<RegistrantRow
										key={registrant.registrationId}
										eventId={eventId}
										registrant={registrant}
										titleById={titleById}
										questions={questions}
										selected={selected.has(registrant.registrationId)}
										onSelectedChange={(isSelected) =>
											handleSelect(registrant.registrationId, isSelected)
										}
										canManage={canManage}
										onChanged={onChanged}
										approval={approval}
									/>
								))}
							</ul>
							{canManage && selectedIds.length > 0 ? (
								<BulkActionsBar
									eventId={eventId}
									selectedIds={selectedIds}
									onDone={onChanged}
									onClear={() => setSelected(new Set())}
									approval={approval}
									hasRequests={registrants.some(
										(registrant) =>
											selected.has(registrant.registrationId) &&
											isRequest(registrant),
									)}
								/>
							) : null}
						</>
					)}
				</>
			)}
		</section>
	);
}

type RegistrantRowProps = {
	eventId: string;
	registrant: EventRegistrant;
	titleById: Map<string, string>;
	questions: EventQuestion[];
	selected: boolean;
	onSelectedChange: (selected: boolean) => void;
	canManage: boolean;
	onChanged: () => Promise<unknown>;
	approval: ReturnType<typeof useApprovalActions>;
};

function RegistrantRow({
	eventId,
	registrant,
	titleById,
	questions,
	selected,
	onSelectedChange,
	canManage,
	onChanged,
	approval,
}: RegistrantRowProps) {
	const attendanceId = useId();
	const removeMutation = useMutation({
		mutationFn: () =>
			removeRegistrantServer({
				data: { eventId, registrationId: registrant.registrationId },
			}),
		onSuccess: async () => {
			toast.success(admin_registrants_removed());
			await onChanged();
		},
		onError: (error) =>
			toast.error(formatMutationError(error, admin_error_generic)),
	});
	const attendanceMutation = useMutation({
		mutationFn: (checkedIn: boolean) =>
			setCheckedInServer({
				data: { eventId, registrationId: registrant.registrationId, checkedIn },
			}),
		onSuccess: onChanged,
		onError: (error) =>
			toast.error(formatMutationError(error, admin_error_generic)),
		onSettled: () => setPendingAttendance(null),
	});
	// The switch moves at once; the list catches up after the save.
	const [pendingAttendance, setPendingAttendance] = useState<boolean | null>(
		null,
	);
	const handleAttendanceChange = (checkedIn: boolean) => {
		setPendingAttendance(checkedIn);
		attendanceMutation.mutate(checkedIn);
	};

	return (
		<li className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between">
			<div className="flex min-w-0 gap-3">
				{canManage ? (
					<input
						type="checkbox"
						className="mt-1 size-5 shrink-0 accent-primary"
						aria-label={admin_bulk_select({ email: registrant.email })}
						checked={selected}
						onChange={(event) => onSelectedChange(event.target.checked)}
					/>
				) : null}
				<div className="flex min-w-0 flex-col gap-1">
					<div className="flex flex-wrap items-center gap-2">
						<p className="font-medium break-all">{registrant.email}</p>
						{registrant.state === "waitlisted" ? (
							<Badge variant="secondary">{admin_registrant_waitlisted()}</Badge>
						) : null}
						{registrant.state === "pending" ? (
							<Badge>{admin_registrant_pending()}</Badge>
						) : null}
						{registrant.state === "rejected" ? (
							<Badge variant="outline">{admin_registrant_rejected()}</Badge>
						) : null}
						{registrant.groupId ? (
							<Badge variant="outline">
								{admin_group_badge({
									name: registrant.groupName ?? admin_group_unnamed(),
								})}
							</Badge>
						) : null}
					</div>
					<p className="text-sm text-muted-foreground">
						{registrant.name ? `${registrant.name} · ` : ""}
						{formatEventDateTime(registrant.registeredAt, getLocale())}
					</p>
					<RegistrantAnswers
						questions={questions}
						answers={registrant.answers}
					/>
					{registrant.agendaItemIds.length > 0 ? (
						<div className="flex flex-wrap gap-1">
							{registrant.agendaItemIds.map((id) => (
								<Badge key={id} variant="secondary">
									{titleById.get(id) ?? id}
								</Badge>
							))}
						</div>
					) : null}
				</div>
			</div>
			<div className="flex flex-wrap items-center gap-3 self-start">
				{canManage && questions.length > 0 ? (
					<EditAnswers
						eventId={eventId}
						registrationId={registrant.registrationId}
						questions={questions}
						answers={registrant.answers}
						onSaved={onChanged}
					/>
				) : null}
				{canManage && isRequest(registrant) ? (
					<>
						<Button
							size="sm"
							disabled={approval.isBusy}
							onClick={() => approval.approve([registrant.registrationId])}
						>
							{admin_approve()}
						</Button>
						{registrant.state === "pending" ? (
							<Button
								size="sm"
								variant="outline"
								disabled={approval.isBusy}
								onClick={() => approval.reject([registrant.registrationId])}
							>
								{admin_reject()}
							</Button>
						) : null}
					</>
				) : null}
				{registrant.state === "registered" ? (
					<div className="flex items-center gap-2">
						<input
							id={attendanceId}
							type="checkbox"
							className="size-5 accent-primary"
							checked={pendingAttendance ?? registrant.checkedInAt !== null}
							disabled={attendanceMutation.isPending}
							onChange={(event) => handleAttendanceChange(event.target.checked)}
						/>
						<Label htmlFor={attendanceId}>{admin_attendance()}</Label>
					</div>
				) : null}
				{canManage ? (
					<AlertDialog>
						<AlertDialogTrigger asChild>
							<Button
								size="sm"
								variant="outline"
								disabled={removeMutation.isPending}
							>
								{admin_registrants_remove()}
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>
									{admin_registrants_remove_title({ email: registrant.email })}
								</AlertDialogTitle>
								<AlertDialogDescription>
									{admin_registrants_remove_body()}
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>{admin_action_cancel()}</AlertDialogCancel>
								<AlertDialogAction onClick={() => removeMutation.mutate()}>
									{admin_registrants_remove()}
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				) : null}
			</div>
		</li>
	);
}

/** "Question: answer" lines for the questions this person answered. */
function RegistrantAnswers({
	questions,
	answers,
}: {
	questions: EventQuestion[];
	answers: Record<string, string>;
}) {
	const answered = questions.filter((question) => answers[question.id]);
	if (answered.length === 0) {
		return null;
	}
	return (
		<ul className="text-sm">
			{answered.map((question) => {
				const value = answers[question.id] ?? "";
				const text =
					question.kind === "yesno"
						? value === "yes"
							? answers_yes()
							: answers_no()
						: value;
				return (
					<li key={question.id} className="break-words">
						{question.label}: {text}
					</li>
				);
			})}
		</ul>
	);
}
