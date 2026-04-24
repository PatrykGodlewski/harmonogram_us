import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
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
