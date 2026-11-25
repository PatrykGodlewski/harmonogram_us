import { profileQueryOptions } from "@repo/api/auth/profile";
import {
	account_field_email,
	account_tab_privacy,
	account_tab_profile,
	account_tab_security,
	account_tabs_label,
	account_title,
} from "@repo/i18n/paraglide/messages";
import { studentsPageHead } from "@repo/router-utils/metadata/page-head";
import { requireAuthenticatedUser } from "@repo/router-utils/require-auth";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@repo/ui/components/tabs";
import { PageHeader } from "@repo/ui/composed/page-header";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { MyData } from "~/components/account/my-data";
import { MyProfile } from "~/components/account/my-profile";
import { PasswordForm } from "~/components/account/password-form";

const TABS = ["profile", "security", "privacy"] as const;
type AccountTab = (typeof TABS)[number];

export const Route = createFileRoute("/account")({
	validateSearch: z.object({
		tab: z.enum(TABS).optional().catch(undefined),
	}),
	beforeLoad: ({ context }) => {
		requireAuthenticatedUser(context, { loginRedirect: "/account" });
	},
	loader: ({ context: { queryClient } }) =>
		queryClient.ensureQueryData(profileQueryOptions),
	head: () => studentsPageHead(account_title()),
	component: AccountPage,
});

/** Settings people change rarely, one tab at a time (the events themselves are on /my-events). */
function AccountPage() {
	const { user } = Route.useRouteContext();
	const tab = Route.useSearch().tab ?? "profile";
	const navigate = Route.useNavigate();
	const handleTabChange = (next: string) =>
		void navigate({
			search: { tab: next === "profile" ? undefined : (next as AccountTab) },
			replace: true,
			resetScroll: false,
		});
	if (!user) {
		return null;
	}

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
			<PageHeader
				title={account_title()}
				description={`${account_field_email()}: ${user.email}`}
			/>
			<Tabs value={tab} onValueChange={handleTabChange}>
				<TabsList aria-label={account_tabs_label()}>
					<TabsTrigger value="profile">{account_tab_profile()}</TabsTrigger>
					<TabsTrigger value="security">{account_tab_security()}</TabsTrigger>
					<TabsTrigger value="privacy">{account_tab_privacy()}</TabsTrigger>
				</TabsList>
				<TabsContent value="profile">
					<MyProfile />
				</TabsContent>
				<TabsContent value="security">
					<PasswordForm initialHasPassword={Boolean(user.hasPassword)} />
				</TabsContent>
				<TabsContent value="privacy">
					<MyData email={user.email} />
				</TabsContent>
			</Tabs>
		</div>
	);
}
