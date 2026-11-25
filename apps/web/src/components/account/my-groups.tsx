import { myGroupsQueryOptions } from "@repo/api/groups/queries";
import {
	groups_my_groups,
	groups_my_groups_empty,
	groups_open_group,
	groups_summary,
} from "@repo/i18n/paraglide/messages";
import { Button } from "@repo/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

/** The groups a teacher registered (F26), each with its places. */
export function MyGroups() {
	const { data: groups = [] } = useQuery(myGroupsQueryOptions);
	return (
		<section className="border border-navy bg-white p-4">
			<h2 className="mb-4 text-xl">{groups_my_groups()}</h2>
			{groups.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					{groups_my_groups_empty()}
				</p>
			) : (
				<ul className="divide-y">
					{groups.map((group) => (
						<li
							key={group.id}
							className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
						>
							<div>
								<p className="font-medium">
									{group.eventTitle}
									{group.name ? ` · ${group.name}` : ""}
								</p>
								<p className="text-sm text-muted-foreground tabular-nums">
									{groups_summary({
										confirmed: group.confirmed,
										invited: group.invited,
										free: Math.max(
											0,
											group.places - group.confirmed - group.invited,
										),
										places: group.places,
									})}
								</p>
							</div>
							<Button size="sm" variant="outline" asChild>
								<Link to="/groups/$groupId" params={{ groupId: group.id }}>
									{groups_open_group()}
								</Link>
							</Button>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
