import { createMiddleware } from '@tanstack/react-start';

/**
 * Auth middleware that mocks checking a user session.
 * In production, replace with real auth (e.g., getSession from auth library).
 */
export const authMiddleware = createMiddleware({
	type: 'function',
}).server(async ({ next, request }) => {
	const authHeader = request.headers.get('Authorization');
	const sessionToken = authHeader?.replace(/^Bearer\s+/i, '');

	const user = sessionToken ? { id: 1, email: 'admin@university.edu', name: 'Admin User' } : null;

	return next({
		context: {
			session: user,
			isAuthenticated: !!user,
		},
	});
});
