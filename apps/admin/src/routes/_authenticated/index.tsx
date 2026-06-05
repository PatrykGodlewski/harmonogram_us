import {
	admin_home_description,
	admin_home_title,
} from "@repo/i18n/paraglide/messages";
import { PageHeader } from "@repo/ui/composed/page-header";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/")({
	component: AdminHomePage,
});

function AdminHomePage() {
	return (
		<PageHeader
			title={admin_home_title()}
			description={admin_home_description()}
		/>
	);
}
