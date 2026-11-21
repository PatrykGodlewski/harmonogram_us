import { searchUsersQueryOptions } from "@repo/api/admin/users";
import { admin_users_title } from "@repo/i18n/paraglide/messages";
import { adminPageHead } from "@repo/router-utils/metadata/page-head";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AdminUsersPage } from "~/components/admin-users-page";

export const Route = createFileRoute("/_authenticated/users")({
	validateSearch: z.object({
		q: z.string().max(200).optional().catch(undefined),
	}),
	loaderDeps: ({ search }) => ({ q: search.q ?? "" }),
	loader: ({ context: { queryClient }, deps }) =>
		queryClient.ensureQueryData(searchUsersQueryOptions(deps.q)),
	head: () => adminPageHead(admin_users_title()),
	component: AdminUsersRoute,
});

function AdminUsersRoute() {
	const { q = "" } = Route.useSearch();
	const { user } = Route.useRouteContext();
	const navigate = Route.useNavigate();
	const handleQueryChange = (next: string) =>
		void navigate({
			search: { q: next || undefined },
			replace: true,
			resetScroll: false,
		});
	return (
		<AdminUsersPage
			query={q}
			onQueryChange={handleQueryChange}
			currentUserId={user?.id ?? ""}
		/>
	);
}
