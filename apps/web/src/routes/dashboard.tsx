import { requireAuthenticatedUser } from "@repo/router-utils/require-auth";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard")({
	beforeLoad: ({ context }) => {
		requireAuthenticatedUser(context);
	},
	component: DashboardPage,
});

function DashboardPage() {
	return (
		<div className="mx-auto max-w-4xl p-8">
			<h1 className="mb-6 text-2xl font-bold">Dashboard</h1>
			<p className="text-muted-foreground">
				Protected content – you are logged in.
			</p>
		</div>
	);
}
