import { setCheckedInServer } from "@repo/api/admin/check-in";
import type { AgendaItem, EventRegistrant } from "@repo/api/admin/queries";
import { removeRegistrantServer } from "@repo/api/admin/registrants";
import {
	admin_action_cancel,
	admin_attendance,
	admin_attendance_count,
	admin_error_generic,
	admin_event_registrants,
	admin_event_registrants_empty,
	admin_group_badge,
	admin_group_unnamed,
	admin_registrant_waitlisted,
	admin_registrants_csv,
	admin_registrants_filter,
	admin_registrants_filter_all,
	admin_registrants_filter_registered,
	admin_registrants_filter_waitlisted,
	admin_registrants_no_match,
	admin_registrants_remove,
	admin_registrants_remove_body,
	admin_registrants_remove_title,
	admin_registrants_removed,
	admin_registrants_search,
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
import { toRegistrantsCsv } from "@repo/ui/registrants-csv";
import { formatEventDateTime, toEventDateInput } from "@repo/ui/time";
import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";
import { toast } from "sonner";
import { formatMutationError } from "~/lib/format-mutation-error";
import { AddRegistrantDialog } from "./add-registrant-dialog";

type StateFilter = "all" | "registered" | "waitlisted";

const FILTER_LABELS: Record<StateFilter, () => string> = {
	all: admin_registrants_filter_all,
	registered: admin_registrants_filter_registered,
	waitlisted: admin_registrants_filter_waitlisted,
};

type RegistrantsListProps = {
	eventId: string;
	eventTitle: string;
	registrants: EventRegistrant[];
	agenda: AgendaItem[];
	onChanged: () => Promise<unknown>;
};

export function RegistrantsList({
	eventId,
	eventTitle,
	registrants,
	agenda,
	onChanged,
}: RegistrantsListProps) {
	const headingId = useId();
	const searchId = useId();
	const filterId = useId();
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

	const registeredCount = registrants.filter(
		(registrant) => registrant.state === "registered",
	).length;
	const presentCount = registrants.filter(
		(registrant) => registrant.checkedInAt !== null,
	).length;

	const handleDownload = () => {
		const locale = getLocale();
		downloadCsv(
			`zapisani-${slugify(eventTitle)}-${toEventDateInput(new Date())}.csv`,
			toRegistrantsCsv(registrants, agenda, locale),
		);
	};

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
					<AddRegistrantDialog eventId={eventId} onAdded={onChanged} />
					<Button
						size="sm"
						variant="outline"
						onClick={handleDownload}
						disabled={registrants.length === 0}
					>
						{admin_registrants_csv()}
					</Button>
				</div>
			</div>
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
						<ul className="divide-y rounded-lg border">
							{visible.map((registrant) => (
								<RegistrantRow
									key={registrant.registrationId}
									eventId={eventId}
									registrant={registrant}
									titleById={titleById}
									onChanged={onChanged}
								/>
							))}
						</ul>
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
	onChanged: () => Promise<unknown>;
};

function RegistrantRow({
	eventId,
	registrant,
	titleById,
	onChanged,
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
			<div className="flex min-w-0 flex-col gap-1">
				<div className="flex flex-wrap items-center gap-2">
					<p className="font-medium break-all">{registrant.email}</p>
					{registrant.state === "waitlisted" ? (
						<Badge variant="secondary">{admin_registrant_waitlisted()}</Badge>
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
			<div className="flex items-center gap-3 self-start">
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
			</div>
		</li>
	);
}

function slugify(text: string): string {
	return (
		text
			.normalize("NFD")
			.replace(/[̀-ͯ]/g, "")
			.replace(/ł/g, "l")
			.replace(/Ł/g, "L")
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "")
			.slice(0, 40) || "wydarzenie"
	);
}

function downloadCsv(filename: string, content: string): void {
	const url = URL.createObjectURL(
		new Blob([content], { type: "text/csv;charset=utf-8" }),
	);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}
