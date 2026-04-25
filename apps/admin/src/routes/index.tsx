import { getCurrentUser } from "@repo/api/auth/user";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

const getCurrentUserFn = createServerFn({ method: "GET" }).handler(async () => {
	return getCurrentUser();
});

export const Route = createFileRoute("/")({
	beforeLoad: async ({ location }) => {
		const user = await getCurrentUserFn();
		if (!user) {
			throw redirect({
				to: "/login",
				search: { redirect: location.href },
			});
		}
	},
	component: AdminHomePage,
});

function AdminHomePage() {
	return (
		<div className="mx-auto max-w-4xl p-8">
			<h1 className="mb-6 text-2xl font-bold">Admin Dashboard</h1>
			<p className="text-muted-foreground">
				Event organizer dashboard - manage events and registrations.
			</p>
		</div>
	);
}
