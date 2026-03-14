import { env } from '@repo/env';
import { useSession } from '@tanstack/react-start/server';

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
		},
	});
}
