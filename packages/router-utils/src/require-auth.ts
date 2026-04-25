import { redirect } from "@tanstack/react-router";

export type AuthenticatedRouteContext = {
	user: {
		id: string;
		email: string;
	} | null;
};

/**
 * Use in route `beforeLoad` when the route requires a session.
 * Redirects to login with a return path (default `/account`).
 */
export function requireAuthenticatedUser(
	context: AuthenticatedRouteContext,
	options?: { loginRedirect?: string },
) {
	if (!context.user) {
		const redirectTo = options?.loginRedirect ?? "/account";
		throw redirect({
			to: "/login",
			search: { redirect: redirectTo },
		});
	}
}
