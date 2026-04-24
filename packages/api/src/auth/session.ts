import { useSession } from '@tanstack/react-start/server';
import { env } from '@repo/env';

export type SessionData = {
	userId?: number;
	email?: string;
};

export function useAppSession() {
	return useSession<SessionData>({
		name: 'session',
		password: env.SESSION_SECRET,
		cookie: {
			secure: env.NODE_ENV === 'production',
			sameSite: 'lax',
			httpOnly: true,
			path: '/',
		},
	});
}
