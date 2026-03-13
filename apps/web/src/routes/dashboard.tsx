import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/dashboard')({
	beforeLoad: ({ context }) => {
		if (!context.user) {
			throw new Error('Not authenticated');
		}
	},
	errorComponent: ({ error }) => {
		if (error.message === 'Not authenticated') {
			return (
				<div className="flex flex-col items-center gap-4 p-8">
					<p>You must be logged in to view this page.</p>
					<Link to="/login" className="text-primary underline">
						Log in
					</Link>
				</div>
			);
		}
		throw error;
	},
	component: DashboardPage,
});

function DashboardPage() {
	return (
		<div className="mx-auto max-w-4xl p-8">
			<h1 className="mb-6 text-2xl font-bold">Dashboard</h1>
			<p className="text-muted-foreground">Protected content – you are logged in.</p>
		</div>
	);
}
