import {
	publishAdminEventServer,
	updateAdminEventServer,
} from "@repo/api/admin/mutations";
import {
	type AdminEventDetails,
	adminEventFilterOptionsQueryOptions,
} from "@repo/api/admin/queries";
import {
	admin_error_generic,
	admin_event_publish,
	admin_event_published,
	admin_field_attendance_mode,
	admin_field_location,
	admin_field_none,
	admin_field_room,
	attendance_mode_hybrid,
	attendance_mode_online,
	attendance_mode_onsite,
	event_room,
	publish_checklist_basics,
	publish_checklist_change,
	publish_checklist_done,
	publish_checklist_fix_first,
	publish_checklist_link,
	publish_checklist_link_hint,
	publish_checklist_link_invalid,
	publish_checklist_missing,
	publish_checklist_place,
	publish_checklist_place_hint,
	publish_checklist_progress,
	publish_checklist_ready,
	publish_checklist_save,
	publish_checklist_saved,
	publish_checklist_title,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
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
import { type FormEvent, type ReactNode, useId, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { formatMutationError } from "~/lib/format-mutation-error";

type AttendanceMode = AdminEventDetails["attendanceMode"];
type EventChanges = {
	attendanceMode?: AttendanceMode;
	locationId?: string | null;
	room?: string | null;
	onlineUrl?: string | null;
};

const NONE_VALUE = "__none__";
const MODE_LABELS: Record<AttendanceMode, () => string> = {
	onsite: attendance_mode_onsite,
	online: attendance_mode_online,
	hybrid: attendance_mode_hybrid,
};
const onlineUrlSchema = z.url({ protocol: /^https$/ });

type PublishChecklistProps = {
	event: AdminEventDetails;
	onChanged: () => Promise<unknown>;
};

/**
 * What a draft needs before it can be published, one row per requirement,
 * each fixable in place; Publish is enabled once every row is done.
 */
export function PublishChecklist({ event, onChanged }: PublishChecklistProps) {
	const headingId = useId();
	const modeId = useId();
	const missing = new Set(event.missingForPublish);
	const needsPlace = event.attendanceMode !== "online";
	const needsLink = event.attendanceMode !== "onsite";
	const total = 1 + Number(needsPlace) + Number(needsLink);
	const done = total - missing.size;

	const saveMutation = useMutation({
		mutationFn: (changes: EventChanges) =>
			updateAdminEventServer({ data: { id: event.id, ...changes } }),
		onSuccess: async () => {
			toast.success(publish_checklist_saved());
			await onChanged();
		},
		onError: (error) =>
			toast.error(formatMutationError(error, admin_error_generic)),
	});
	const publishMutation = useMutation({
		mutationFn: () => publishAdminEventServer({ data: { id: event.id } }),
		onSuccess: async () => {
			toast.success(admin_event_published());
			await onChanged();
		},
		onError: (error) =>
			toast.error(formatMutationError(error, admin_error_generic)),
	});

	return (
		<section
			aria-labelledby={headingId}
			className="flex flex-col gap-4 rounded-lg border p-4"
		>
			<div className="flex flex-col gap-2">
				<div className="flex items-baseline justify-between gap-2">
					<h2 id={headingId} className="font-semibold">
						{publish_checklist_title()}
					</h2>
					<p className="text-sm text-muted-foreground tabular-nums">
						{publish_checklist_progress({ done, total })}
					</p>
				</div>
				<div
					className="h-2 overflow-hidden rounded-full bg-muted"
					aria-hidden="true"
				>
					<div
						className="h-full rounded-full bg-primary transition-[width]"
						style={{ width: `${(done / total) * 100}%` }}
					/>
				</div>
			</div>

			<ul className="flex flex-col gap-3">
				<ChecklistRow label={publish_checklist_basics()} done>
					<p className="text-sm text-muted-foreground">
						{event.title} · {formatEventDateTime(event.date, getLocale())}
					</p>
				</ChecklistRow>

				<li className="flex flex-col gap-1">
					<Label htmlFor={modeId}>{admin_field_attendance_mode()}</Label>
					<Select
						value={event.attendanceMode}
						disabled={saveMutation.isPending}
						onValueChange={(value) =>
							saveMutation.mutate({ attendanceMode: value as AttendanceMode })
						}
					>
						<SelectTrigger id={modeId} className="w-full sm:w-56">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{(Object.keys(MODE_LABELS) as AttendanceMode[]).map((mode) => (
								<SelectItem key={mode} value={mode}>
									{MODE_LABELS[mode]()}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</li>

				{needsPlace ? (
					<PlaceRow
						event={event}
						done={!missing.has("place")}
						saving={saveMutation.isPending}
						onSave={(changes) => saveMutation.mutateAsync(changes)}
					/>
				) : null}
				{needsLink ? (
					<LinkRow
						event={event}
						done={!missing.has("link")}
						saving={saveMutation.isPending}
						onSave={(changes) => saveMutation.mutateAsync(changes)}
					/>
				) : null}
			</ul>

			<div className="flex flex-col gap-2 border-t pt-4">
				<p className="text-sm text-muted-foreground">
					{missing.size === 0
						? publish_checklist_ready()
						: publish_checklist_fix_first()}
				</p>
				<Button
					className="w-full sm:w-auto sm:self-start"
					onClick={() => publishMutation.mutate()}
					disabled={missing.size > 0 || publishMutation.isPending}
				>
					{admin_event_publish()}
				</Button>
			</div>
		</section>
	);
}

type ChecklistRowProps = {
	label: string;
	done: boolean;
	children: ReactNode;
};

function ChecklistRow({ label, done, children }: ChecklistRowProps) {
	return (
		<li className="flex gap-3">
			<span
				aria-hidden="true"
				className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${done ? "bg-green-600" : "bg-amber-500"}`}
			>
				{done ? "✓" : "!"}
			</span>
			<div className="flex min-w-0 flex-1 flex-col gap-2">
				<div className="flex flex-wrap items-center gap-2">
					<span className="font-medium">{label}</span>
					<span
						className={
							done
								? "rounded bg-green-100 px-1.5 text-xs text-green-800"
								: "rounded bg-amber-100 px-1.5 text-xs text-amber-900"
						}
					>
						{done ? publish_checklist_done() : publish_checklist_missing()}
					</span>
				</div>
				{children}
			</div>
		</li>
	);
}

type FixRowProps = {
	event: AdminEventDetails;
	done: boolean;
	saving: boolean;
	onSave: (changes: EventChanges) => Promise<unknown>;
};

function PlaceRow({ event, done, saving, onSave }: FixRowProps) {
	const roomId = useId();
	const locationId = useId();
	const [editing, setEditing] = useState(false);
	const [room, setRoom] = useState(event.room ?? "");
	const [location, setLocation] = useState(event.locationId ?? NONE_VALUE);
	const { data: options } = useQuery(adminEventFilterOptionsQueryOptions);
	const summary = [
		event.locationLabel,
		event.room ? event_room({ room: event.room }) : null,
	]
		.filter(Boolean)
		.join(" · ");

	const handleSubmit = async (formEvent: FormEvent) => {
		formEvent.preventDefault();
		await onSave({
			room: room.trim() || null,
			locationId: location === NONE_VALUE ? null : location,
		});
		setEditing(false);
	};

	return (
		<ChecklistRow label={publish_checklist_place()} done={done}>
			{done && !editing ? (
				<div className="flex flex-wrap items-center gap-2">
					<p className="text-sm text-muted-foreground">{summary}</p>
					<Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
						{publish_checklist_change()}
					</Button>
				</div>
			) : (
				<form
					noValidate
					onSubmit={handleSubmit}
					className="flex flex-col gap-2"
				>
					<p className="text-sm text-muted-foreground">
						{publish_checklist_place_hint()}
					</p>
					<div className="flex flex-col gap-1">
						<Label htmlFor={roomId}>{admin_field_room()}</Label>
						<Input
							id={roomId}
							maxLength={100}
							placeholder="B105"
							value={room}
							onChange={(change) => setRoom(change.target.value)}
						/>
					</div>
					<div className="flex flex-col gap-1">
						<Label htmlFor={locationId}>{admin_field_location()}</Label>
						<Select value={location} onValueChange={setLocation}>
							<SelectTrigger id={locationId} className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE_VALUE}>{admin_field_none()}</SelectItem>
								{options?.locations.map((option) => (
									<SelectItem key={option.id} value={option.id}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<Button
						type="submit"
						size="sm"
						className="self-start"
						disabled={saving || (!room.trim() && location === NONE_VALUE)}
					>
						{publish_checklist_save()}
					</Button>
				</form>
			)}
		</ChecklistRow>
	);
}

function LinkRow({ event, done, saving, onSave }: FixRowProps) {
	const inputId = useId();
	const errorId = useId();
	const [editing, setEditing] = useState(false);
	const [link, setLink] = useState(event.onlineUrl ?? "");
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async (formEvent: FormEvent) => {
		formEvent.preventDefault();
		const value = link.trim();
		if (!onlineUrlSchema.safeParse(value).success) {
			setError(publish_checklist_link_invalid());
			return;
		}
		setError(null);
		await onSave({ onlineUrl: value });
		setEditing(false);
	};

	return (
		<ChecklistRow label={publish_checklist_link()} done={done}>
			{done && !editing ? (
				<div className="flex flex-wrap items-center gap-2">
					<p className="min-w-0 text-sm break-all text-muted-foreground">
						{event.onlineUrl}
					</p>
					<Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
						{publish_checklist_change()}
					</Button>
				</div>
			) : (
				<form
					noValidate
					onSubmit={handleSubmit}
					className="flex flex-col gap-2"
				>
					<p className="text-sm text-muted-foreground">
						{publish_checklist_link_hint()}
					</p>
					<div className="flex flex-col gap-1">
						<Label htmlFor={inputId}>{publish_checklist_link()}</Label>
						<Input
							id={inputId}
							inputMode="url"
							autoComplete="url"
							placeholder="https://"
							value={link}
							aria-invalid={error ? true : undefined}
							aria-describedby={error ? errorId : undefined}
							onChange={(change) => {
								setLink(change.target.value);
								setError(null);
							}}
						/>
						{error ? (
							<p id={errorId} role="alert" className="text-sm text-destructive">
								{error}
							</p>
						) : null}
					</div>
					<Button
						type="submit"
						size="sm"
						className="self-start"
						disabled={saving || !link.trim()}
					>
						{publish_checklist_save()}
					</Button>
				</form>
			)}
		</ChecklistRow>
	);
}
