import { ticketQueryOptions } from "@repo/api/events/ticket";
import { tickets_back, tickets_not_found } from "@repo/i18n/paraglide/messages";
import { requireAuthenticatedUser } from "@repo/router-utils/require-auth";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { TicketCard } from "~/components/tickets/ticket-card";

export const Route = createFileRoute("/tickets/$registrationId")({
	beforeLoad: ({ context, location }) => {
		requireAuthenticatedUser(context, { loginRedirect: location.href });
	},
	loader: ({ context: { queryClient }, params }) =>
		queryClient.ensureQueryData(ticketQueryOptions(params.registrationId)),
	component: TicketPage,
});

function TicketPage() {
	const { registrationId } = Route.useParams();
	const { data: ticket } = useSuspenseQuery(ticketQueryOptions(registrationId));

	return (
		<div className="mx-auto flex w-full max-w-md flex-col gap-4 p-4 sm:p-8">
			<Link
				to="/account"
				className="text-sm text-muted-foreground hover:underline print:hidden"
			>
				← {tickets_back()}
			</Link>
			{ticket ? (
				<TicketCard ticket={ticket} />
			) : (
				<p className="text-muted-foreground">{tickets_not_found()}</p>
			)}
		</div>
	);
}
