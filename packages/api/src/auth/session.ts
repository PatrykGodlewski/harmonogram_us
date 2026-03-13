import { useSession } from '@tanstack/react-start/server';

type SessionData = {
	userEmail?: string;
};

export function useAppSession() {
	return useSession<SessionData>({
		password:
			process.env.SESSION_SECRET ??
			'ChangeThisBeforeShippingToProdOrYouWillBeFired',
	});
}
