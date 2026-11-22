import {
	admin_scan_back,
	admin_scan_title,
} from "@repo/i18n/paraglide/messages";
import { adminPageHead } from "@repo/router-utils/metadata/page-head";
import { createFileRoute, Link } from "@tanstack/react-router";
import { TicketScanner } from "~/components/check-in/ticket-scanner";

export const Route = createFileRoute("/_authenticated/events/$eventId_/scan")({
	head: () => adminPageHead(admin_scan_title()),
	component: ScanPage,
});

function ScanPage() {
	const { eventId } = Route.useParams();
	return (
		<div className="flex flex-col gap-4">
			<Link
				to="/events/$eventId"
				params={{ eventId }}
				className="text-sm text-muted-foreground hover:underline"
			>
				← {admin_scan_back()}
			</Link>
			<h1 className="text-2xl font-semibold tracking-tight">
				{admin_scan_title()}
			</h1>
			<TicketScanner eventId={eventId} />
		</div>
	);
}
