import { createFileRoute } from '@tanstack/react-router';
import { getEvents } from '@repo/api/handlers/events';
import { Button } from '@repo/ui/components/button';

export const Route = createFileRoute('/')({
	component: HomePage,
	loader: async () => {
		return getEvents();
	},
});

function HomePage() {
	const events = Route.useLoaderData();

	return (
		<div className="mx-auto max-w-4xl p-8">
			<h1 className="mb-6 text-2xl font-bold">
				University Event Registration
			</h1>
			<p className="mb-8 text-muted-foreground">
				Browse and register for upcoming university events.
			</p>

			<div className="space-y-4">
				{events.length === 0 ? (
					<p className="text-muted-foreground">
						No events available at the moment.
					</p>
				) : (
					<ul className="divide-y divide-border rounded-lg border">
						{events.map((event) => (
							<li
								key={event.id}
								className="flex items-center justify-between p-4"
							>
								<div>
									<h2 className="font-semibold">{event.title}</h2>
									<p className="text-sm text-muted-foreground">
										{new Date(event.date).toLocaleDateString()} ·{' '}
										{event.availableSeats} seats available
									</p>
								</div>
								<Button size="sm">Register</Button>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}
