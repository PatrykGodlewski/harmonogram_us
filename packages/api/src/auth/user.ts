import { db } from "@repo/db/client";
import { authAccounts } from "@repo/db/schema/better-auth";
import { error_title } from "@repo/i18n/paraglide/messages";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { APIError } from "better-auth/api";
import { and, eq, isNotNull } from "drizzle-orm";
import {
	assertPasswordMeetsPolicy,
	auth,
	resolveAuthLocaleFromHeaders,
} from "./better-auth";

export type AuthenticatedUser = {
	id: string;
	email: string;
	hasPassword: boolean;
};

export async function getCurrentSession() {
	const headers = getRequestHeaders();
	return auth.api.getSession({ headers });
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
	const session = await getCurrentSession();
	if (!session?.user) return null;
	const credentialAccount = await db.query.authAccounts.findFirst({
		where: and(
			eq(authAccounts.userId, session.user.id),
			eq(authAccounts.providerId, "credential"),
			isNotNull(authAccounts.password),
		),
		columns: {
			id: true,
		},
	});

	return {
		id: session.user.id,
		email: session.user.email,
		hasPassword: Boolean(credentialAccount),
	};
}

export async function setPasswordForCurrentSession(
	headers: Headers,
	newPassword: string,
): Promise<void> {
	try {
		await assertPasswordMeetsPolicy(
			newPassword,
			resolveAuthLocaleFromHeaders(headers),
		);
		const result = await auth.api.setPassword({
			body: {
				newPassword,
			},
			headers,
		});
		if (!result.status) {
			throw new Error(error_title());
		}
	} catch (error) {
		if (error instanceof APIError) {
			throw new Error(error.message || error_title());
		}
		throw error;
	}
}
