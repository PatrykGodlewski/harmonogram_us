import { redirect } from "@tanstack/react-router";

export type AuthenticatedRouteContext = {
	user: {
		id: number;
		email: string;
	} | null;
};

/**
 * Use in route `beforeLoad` when the route requires a session.
 * Redirects to login with a return path (default `/dashboard`).
 */
export function requireAuthenticatedUser(
	context: AuthenticatedRouteContext,
	options?: { loginRedirect?: string },
) {
	if (!context.user) {
		const redirectTo = options?.loginRedirect ?? "/dashboard";
		throw redirect({
			to: "/login",
			search: { redirect: redirectTo },
		});
	}
}
