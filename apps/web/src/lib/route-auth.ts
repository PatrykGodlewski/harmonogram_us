import { redirect } from '@tanstack/react-router';

type RouteContext = {
	user: {
		id: number;
		email: string;
	} | null;
};

export function requireAuthenticatedUser(context: RouteContext) {
	if (!context.user) {
		throw redirect({
			to: '/login',
			search: { redirect: '/dashboard' },
		});
	}
}
