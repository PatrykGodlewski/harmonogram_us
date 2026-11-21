/** Server-only: the university's OpenID Connect sign-in, configured through env. */
import { env } from "@repo/env";
import type { GenericOAuthConfig } from "better-auth/plugins";
import { UNIVERSITY_PROVIDER_ID } from "./university-provider";

/** Claims a university server sends (OpenID Connect standard claims). */
export type UniversityProfile = {
	email?: string;
	name?: string;
	given_name?: string;
	family_name?: string;
	email_verified?: boolean;
};

/**
 * Not every university sends `name`: fall back to given + family name, then the e-mail.
 * The university vouches for its addresses unless it says otherwise (Entra ID sends no
 * `email_verified`), so they count as verified.
 */
export function universityProfileToUser(profile: UniversityProfile): {
	name: string;
	emailVerified: boolean;
} {
	const fullName = [profile.given_name, profile.family_name]
		.map((part) => part?.trim())
		.filter(Boolean)
		.join(" ");
	return {
		name: profile.name?.trim() || fullName || profile.email || "",
		emailVerified: profile.email_verified !== false,
	};
}

/** The provider for Better Auth's genericOAuth, or null when not configured. */
export function universityProviderConfig(): GenericOAuthConfig | null {
	const {
		UNIVERSITY_SSO_DISCOVERY_URL: discoveryUrl,
		UNIVERSITY_SSO_CLIENT_ID: clientId,
		UNIVERSITY_SSO_CLIENT_SECRET: clientSecret,
	} = env;
	if (!discoveryUrl || !clientId || !clientSecret) return null;
	return {
		providerId: UNIVERSITY_PROVIDER_ID,
		discoveryUrl,
		clientId,
		clientSecret,
		scopes: ["openid", "email", "profile"],
		pkce: true,
		mapProfileToUser: (profile) =>
			universityProfileToUser(profile as UniversityProfile),
	};
}

/** What the sign-in screens show: null when university sign-in is off. */
export type UniversitySignIn = { name: string | null } | null;

export function universitySignIn(): UniversitySignIn {
	if (!universityProviderConfig()) return null;
	return { name: env.UNIVERSITY_SSO_NAME ?? null };
}
