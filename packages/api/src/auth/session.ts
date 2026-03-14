import { useSession } from '@tanstack/react-start/server';
import { z } from 'zod';

const sessionSecretSchema = z
	.string({ required_error: 'SESSION_SECRET must be provided' })
	.min(32, 'SESSION_SECRET must be at least 32 characters');

function getSessionPassword(): string {
	return sessionSecretSchema.parse(process.env.SESSION_SECRET);
}

export type SessionData = {
	userId?: number;
	email?: string;
};

export function useAppSession() {
	return useSession<SessionData>({
		name: 'session',
		password: getSessionPassword(),
		cookie: {
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			httpOnly: true,
		},
	});
}
