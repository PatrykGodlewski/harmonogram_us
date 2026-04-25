import {
	account_title,
	home_cta_login,
	home_cta_signup,
	home_title,
} from "@repo/i18n/paraglide/messages";
import { Button } from "@repo/ui/components/button";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	component: HomePage,
});

function HomePage() {
	const { user } = Route.useRouteContext();

	return (
		<div className="mx-auto flex max-w-3xl flex-col items-start gap-6 p-8">
			<h1 className="text-2xl font-bold">{home_title()}</h1>
			<div className="flex flex-wrap items-center gap-3">
				{user ? (
					<Button asChild>
						<Link to="/account">{account_title()}</Link>
					</Button>
				) : (
					<>
						<Button asChild>
							<Link to="/login">{home_cta_login()}</Link>
						</Button>
						<Button asChild variant="outline">
							<Link to="/signup">{home_cta_signup()}</Link>
						</Button>
					</>
				)}
			</div>
		</div>
	);
}
