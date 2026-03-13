import { createServerFn } from '@tanstack/react-start';
import { authMiddleware } from './auth/middleware';

/**
 * Builder pattern for server function procedures.
 * - publicQueryFn: Public read-only functions, no auth required
 * - protectedActionFn: Protected mutations, requires authenticated session
 */
export const publicQueryFn = createServerFn({ method: 'GET' });

export const protectedActionFn = createServerFn({ method: 'POST' }).middleware([
	authMiddleware,
]);
