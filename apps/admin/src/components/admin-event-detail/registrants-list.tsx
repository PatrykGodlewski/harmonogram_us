import type { AgendaItem, EventRegistrant } from "@repo/api/admin/queries";
import {
	admin_event_registrants,
	admin_event_registrants_empty,
	admin_group_badge,
	admin_group_unnamed,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import { Badge } from "@repo/ui/components/badge";
import { formatWarsawDateTime } from "@repo/ui/time";

type RegistrantsListProps = {
	registrants: EventRegistrant[];
	agenda: AgendaItem[];
};

export function RegistrantsList({ registrants, agenda }: RegistrantsListProps) {
	const locale = getLocale();
	const titleById = new Map(agenda.map((item) => [item.id, item.title]));

	return (
		<section className="flex flex-col gap-3">
			<h2 className="text-lg font-semibold">
				{admin_event_registrants({ count: registrants.length })}
			</h2>
			{registrants.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					{admin_event_registrants_empty()}
				</p>
			) : (
				<ul className="divide-y rounded-lg border">
					{registrants.map((registrant) => (
						<li
							key={registrant.registrationId}
							className="flex flex-col gap-1 p-3"
						>
							<div className="flex flex-wrap items-center gap-2">
								<p className="font-medium break-all">{registrant.email}</p>
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
								{formatWarsawDateTime(registrant.registeredAt, locale)}
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
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
