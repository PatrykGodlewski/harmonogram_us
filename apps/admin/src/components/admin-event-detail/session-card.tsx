import type { AgendaSession } from "@repo/api/admin/queries";
import {
	admin_action_cancel,
	admin_action_delete,
	admin_action_edit,
	admin_session_copy,
	admin_session_copy_label,
	admin_session_delete_body,
	admin_session_delete_label,
	admin_session_delete_title,
	admin_session_edit_label,
	admin_session_items,
	admin_session_open,
	admin_session_open_label,
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
import { Button } from "@repo/ui/components/button";
import { sessionColorClasses } from "@repo/ui/session-colors";
import { formatEventTime } from "@repo/ui/time";
import { cn } from "@repo/ui/utils";
import { Link } from "@tanstack/react-router";

type SessionCardProps = {
	session: AgendaSession;
	itemCount: number;
	deleting: boolean;
	onCopy: () => void;
	onEdit: () => void;
	onDelete: () => void;
};

/** A session in the event's programme: its theme, time and place, and what can be done with it. */
export function SessionCard({
	session,
	itemCount,
	deleting,
	onCopy,
	onEdit,
	onDelete,
}: SessionCardProps) {
	const locale = getLocale();
	return (
		<li className="flex gap-3 p-3">
			<span
				aria-hidden
				className={cn(
					"w-1.5 shrink-0 rounded-full",
					sessionColorClasses[session.color].bar,
				)}
			/>
			<div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex min-w-0 flex-col gap-0.5">
					<p className="text-sm text-muted-foreground tabular-nums">
						{formatEventTime(session.startsAt, locale)}–
						{formatEventTime(session.endsAt, locale)}
						{session.locationLabel ? ` · ${session.locationLabel}` : ""}
					</p>
					<p className="font-semibold break-words">{session.title}</p>
					{session.description ? (
						<p className="text-sm text-muted-foreground break-words">
							{session.description}
						</p>
					) : null}
					<p className="text-sm tabular-nums">
						{admin_session_items({ count: itemCount })}
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button size="sm" asChild>
						<Link
							to="/events/$eventId/sessions/$sessionId"
							params={{ eventId: session.eventId, sessionId: session.id }}
							aria-label={admin_session_open_label({ title: session.title })}
						>
							{admin_session_open()}
						</Link>
					</Button>
					<Button
						size="sm"
						variant="outline"
						onClick={onCopy}
						aria-label={admin_session_copy_label({ title: session.title })}
					>
						{admin_session_copy()}
					</Button>
					<Button
						size="sm"
						variant="outline"
						onClick={onEdit}
						aria-label={admin_session_edit_label({ title: session.title })}
					>
						{admin_action_edit()}
					</Button>
					<AlertDialog>
						<AlertDialogTrigger asChild>
							<Button
								size="sm"
								variant="outline"
								disabled={deleting}
								aria-label={admin_session_delete_label({
									title: session.title,
								})}
							>
								{admin_action_delete()}
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>
									{admin_session_delete_title({ title: session.title })}
								</AlertDialogTitle>
								<AlertDialogDescription>
									{admin_session_delete_body({ items: itemCount })}
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>{admin_action_cancel()}</AlertDialogCancel>
								<AlertDialogAction onClick={onDelete}>
									{admin_action_delete()}
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</div>
			</div>
		</li>
	);
}
