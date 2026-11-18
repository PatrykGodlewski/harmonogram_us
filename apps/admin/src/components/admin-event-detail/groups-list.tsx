import type { GroupSummary } from "@repo/api/admin/queries";
import {
	admin_event_groups,
	admin_event_groups_empty,
	admin_group_counts,
	admin_group_owner,
	admin_group_status_cancelled,
	admin_group_status_closed,
	admin_group_status_open,
	admin_group_unnamed,
} from "@repo/i18n/paraglide/messages";
import { Badge } from "@repo/ui/components/badge";

const STATUS_LABELS: Record<string, () => string> = {
	open: admin_group_status_open,
	closed: admin_group_status_closed,
	cancelled: admin_group_status_cancelled,
};

export function GroupsList({ groups }: { groups: GroupSummary[] }) {
	return (
		<section className="flex flex-col gap-3">
			<h2 className="text-lg font-semibold">
				{admin_event_groups({ count: groups.length })}
			</h2>
			{groups.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					{admin_event_groups_empty()}
				</p>
			) : (
				<ul className="divide-y rounded-lg border">
					{groups.map((group) => (
						<li key={group.id} className="flex flex-col gap-1 p-3">
							<div className="flex flex-wrap items-center gap-2">
								<span className="font-medium">
									{group.name ?? admin_group_unnamed()}
								</span>
								<Badge
									variant={group.status === "open" ? "default" : "secondary"}
								>
									{STATUS_LABELS[group.status]?.() ?? group.status}
								</Badge>
							</div>
							<p className="text-sm text-muted-foreground break-all">
								{admin_group_owner({ email: group.ownerEmail })}
							</p>
							<p className="text-sm tabular-nums">
								{admin_group_counts({
									confirmed: group.confirmed,
									invited: group.invited,
									places: group.places,
								})}
							</p>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
