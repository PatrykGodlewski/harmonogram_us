import { createHash } from "node:crypto";
import { db } from "@repo/db/client";
import {
	findMagicLinkEmail,
	resetUnverifiedAccount,
} from "@repo/db/queries/account-safety";
import {
	authAccounts,
	authSessions,
	authUsers,
	authVerifications,
} from "@repo/db/schema/better-auth";
import { env } from "@repo/env";
import {
	auth_email_magic_link_ignore,
	auth_email_magic_link_intro,
	auth_email_magic_link_preview,
	auth_error_password_breached,
	auth_error_password_safety_check_failed,
	verify_email_ignore,
	verify_email_intro,
	verify_email_subject,
} from "@repo/i18n/paraglide/messages";
import {
	baseLocale,
	type Locale,
	toLocale,
} from "@repo/i18n/paraglide/runtime";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { captcha, magicLink } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { Redis } from "ioredis";
import { RateLimiterRedis } from "rate-limiter-flexible";
import { z } from "zod";
import {
	renderMagicLinkEmail,
	sendTransactionalEmail,
} from "../notifications/email";
import { getClientIp } from "../security/client-ip";
import { checkEmails } from "../security/email-policy";
import {
	INVITATION_ACCEPT_LIMIT,
	invitationAcceptRateKey,
} from "../security/rate-limit-keys";
import { groupInvitation } from "./group-invitation-plugin";
import { enabledSocialProviders } from "./social-providers";

const MAGIC_LINK_EXPIRATION_SECONDS = 15 * 60;
const magicLinkMetadataSchema = z.object({
	locale: z.string().optional(),
});

const socialProviderConfigs = {
	google:
		env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
			? {
					clientId: env.GOOGLE_CLIENT_ID,
					clientSecret: env.GOOGLE_CLIENT_SECRET,
				}
			: undefined,
} as const;

const socialProviders = Object.fromEntries(
	enabledSocialProviders
		.map((provider) => {
			const config = socialProviderConfigs[provider];
			return config ? [provider, config] : undefined;
		})
		.filter(
			(
				entry,
			): entry is [
				keyof typeof socialProviderConfigs,
				NonNullable<
					(typeof socialProviderConfigs)[keyof typeof socialProviderConfigs]
				>,
			] => Boolean(entry),
		),
);

const rateLimitWindowSeconds = 15 * 60;
const rateLimitBlockSeconds = 15 * 60;
const signInMaxAttempts = 10;
const signUpMaxAttempts = 6;
const magicLinkMaxAttempts = 6;
const PASSWORD_MIN_LENGTH = 8;

const redisClient = env.REDIS_URL
	? new Redis(env.REDIS_URL, {
			password: env.REDIS_PASSWORD || undefined,
			maxRetriesPerRequest: 3,
		})
	: null;

const signInLimiter = redisClient
	? new RateLimiterRedis({
			storeClient: redisClient,
			keyPrefix: "auth:signin",
			points: signInMaxAttempts,
			duration: rateLimitWindowSeconds,
			blockDuration: rateLimitBlockSeconds,
		})
	: null;

const signUpLimiter = redisClient
	? new RateLimiterRedis({
			storeClient: redisClient,
			keyPrefix: "auth:signup",
			points: signUpMaxAttempts,
			duration: rateLimitWindowSeconds,
			blockDuration: rateLimitBlockSeconds,
		})
	: null;

const magicLinkLimiter = redisClient
	? new RateLimiterRedis({
			storeClient: redisClient,
			keyPrefix: "auth:magic-link",
			points: magicLinkMaxAttempts,
			duration: rateLimitWindowSeconds,
			blockDuration: rateLimitBlockSeconds,
		})
	: null;

const invitationAcceptLimiter = redisClient
	? new RateLimiterRedis({
			storeClient: redisClient,
			keyPrefix: "auth:group-invitation",
			points: INVITATION_ACCEPT_LIMIT.points,
			duration: INVITATION_ACCEPT_LIMIT.durationSeconds,
		})
	: null;

function normalizeEmail(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const normalized = value.trim().toLowerCase();
	return normalized.length > 0 ? normalized : null;
}

function normalizeText(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const normalized = value.trim();
	return normalized.length > 0 ? normalized : null;
}

function getBodyValue(
	body: unknown,
	key: "email" | "password" | "newPassword",
): unknown {
	if (!body || typeof body !== "object") return undefined;
	return Reflect.get(body, key);
}

function getBodyValueAsString(
	body: unknown,
	key: "email" | "password" | "newPassword",
): string | null {
	const value = getBodyValue(body, key);
	if (key === "email") {
		return normalizeEmail(value);
	}
	if (key === "password") {
		return normalizeText(value);
	}
	return normalizeText(value);
}

async function consumeRateLimit(
	limiter: RateLimiterRedis | null,
	key: string,
	message: string,
): Promise<void> {
	if (!limiter) return;
	try {
		await limiter.consume(key);
	} catch {
		throw new APIError("TOO_MANY_REQUESTS", { message });
	}
}

async function assertEmailIsAllowed(email: string): Promise<void> {
	const { rejected } = await checkEmails([email]);
	const reason = rejected[0]?.reason;
	if (!reason) {
		return;
	}
	throw new APIError("BAD_REQUEST", {
		message:
			reason === "disposable"
				? "Disposable email addresses are not allowed."
				: reason === "invalid"
					? "Invalid email address."
					: "Please provide a valid email address.",
	});
}

async function isCompromisedPassword(
	password: string,
	locale: Locale,
): Promise<boolean> {
	const hash = createHash("sha1").update(password).digest("hex").toUpperCase();
	const prefix = hash.slice(0, 5);
	const suffix = hash.slice(5);
	const response = await fetch(
		`https://api.pwnedpasswords.com/range/${prefix}`,
		{
			method: "GET",
			headers: {
				"Add-Padding": "true",
				"User-Agent": "harmonogram-us-auth",
			},
		},
	);
	if (!response.ok) {
		throw new APIError("INTERNAL_SERVER_ERROR", {
			message: auth_error_password_safety_check_failed({}, { locale }),
		});
	}
	const body = await response.text();
	for (const line of body.split("\n")) {
		const [hashSuffix, countRaw] = line.trim().split(":");
		if (!hashSuffix || !countRaw) continue;
		if (hashSuffix.toUpperCase() !== suffix) continue;
		const breachCount = Number.parseInt(countRaw, 10);
		return breachCount >= env.HIBP_MIN_BREACH_COUNT;
	}
	return false;
}

export async function assertPasswordMeetsPolicy(
	password: string,
	locale: Locale,
): Promise<void> {
	if (password.length < PASSWORD_MIN_LENGTH) {
		throw new APIError("BAD_REQUEST", {
			message: "Password too short",
		});
	}

	if (await isCompromisedPassword(password, locale)) {
		throw new APIError("BAD_REQUEST", {
			message: auth_error_password_breached({}, { locale }),
		});
	}
}

function getPathFirstSegment(pathname: string): string | undefined {
	return pathname.split("/").filter(Boolean)[0];
}

function resolveLocaleFromPath(pathname: string): Locale | undefined {
	return toLocale(getPathFirstSegment(pathname));
}

function resolveLocaleFromCallbackUrl(url: string): Locale | undefined {
	try {
		const callbackUrl = new URL(url).searchParams.get("callbackURL");
		if (!callbackUrl) return undefined;
		return resolveLocaleFromPath(
			new URL(callbackUrl, env.BETTER_AUTH_URL).pathname,
		);
	} catch {
		return undefined;
	}
}

function resolveLocaleFromHeaders(
	headers: Headers | undefined,
): Locale | undefined {
	if (!headers) return undefined;

	try {
		const referer = headers.get("referer");
		if (referer) {
			const refererLocale = resolveLocaleFromPath(new URL(referer).pathname);
			if (refererLocale) return refererLocale;
		}
	} catch {
		// Ignore invalid referer and continue with other signals.
	}

	const acceptLanguage = headers.get("accept-language");
	if (!acceptLanguage) return undefined;

	const firstLanguage = acceptLanguage.split(",")[0]?.split("-")[0]?.trim();
	return toLocale(firstLanguage);
}

export function resolveAuthLocaleFromHeaders(
	headers: Headers | undefined,
): Locale {
	return resolveLocaleFromHeaders(headers) ?? baseLocale;
}

function resolveMagicLinkLocale(params: {
	metadata: Record<string, unknown> | undefined;
	url: string;
	headers: Headers | undefined;
}): Locale {
	const parsedMetadata = magicLinkMetadataSchema.safeParse(params.metadata);
	const metadataLocale = toLocale(
		parsedMetadata.success ? parsedMetadata.data.locale : undefined,
	);
	return (
		metadataLocale ??
		resolveLocaleFromCallbackUrl(params.url) ??
		resolveLocaleFromHeaders(params.headers) ??
		baseLocale
	);
}

export const auth = betterAuth({
	baseURL: env.BETTER_AUTH_URL,
	secret: env.BETTER_AUTH_SECRET,
	trustedOrigins: [env.ADMIN_URL],
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: {
			user: authUsers,
			session: authSessions,
			account: authAccounts,
			verification: authVerifications,
		},
	}),
	emailAndPassword: {
		enabled: true,
	},
	emailVerification: {
		sendOnSignUp: true,
		sendVerificationEmail: async ({ user, url }, request) => {
			const locale = resolveAuthLocaleFromHeaders(request?.headers);
			// Not awaited, per Better Auth docs (avoids timing attacks).
			void sendTransactionalEmail({
				to: user.email,
				subject: verify_email_subject({}, { locale }),
				text: `${verify_email_intro({}, { locale })}\n\n${url}\n\n${verify_email_ignore({}, { locale })}`,
			}).catch((error: unknown) => {
				console.error("[auth] verification email failed", error);
			});
		},
	},
	hooks: {
		before: createAuthMiddleware(async (ctx) => {
			const ip = getClientIp(ctx.headers);
			const email = getBodyValueAsString(ctx.body, "email");
			const password = getBodyValueAsString(ctx.body, "password");
			const locale = resolveAuthLocaleFromHeaders(ctx.headers);

			if (ctx.path === "/sign-up/email") {
				await consumeRateLimit(
					signUpLimiter,
					`${ip}:${email ?? "unknown-email"}`,
					"Too many sign-up attempts. Please try again later.",
				);
				if (email) {
					await assertEmailIsAllowed(email);
				}
				if (password) await assertPasswordMeetsPolicy(password, locale);
				return;
			}

			if (ctx.path === "/sign-in/email") {
				await consumeRateLimit(
					signInLimiter,
					`${ip}:${email ?? "unknown-email"}`,
					"Too many sign-in attempts. Please try again later.",
				);
				return;
			}

			if (ctx.path === "/sign-in/magic-link") {
				await consumeRateLimit(
					magicLinkLimiter,
					`${ip}:${email ?? "unknown-email"}`,
					"Too many magic link requests. Please try again later.",
				);
				if (email) {
					await assertEmailIsAllowed(email);
				}
				return;
			}

			if (ctx.path === "/group-invitation/accept") {
				const token: unknown = (ctx.body as { token?: unknown } | undefined)
					?.token;
				await consumeRateLimit(
					invitationAcceptLimiter,
					typeof token === "string" ? invitationAcceptRateKey(token) : ip,
					"Too many invitation attempts. Please try again later.",
				);
				return;
			}

			if (ctx.path === "/magic-link/verify") {
				// The link proves the inbox; a stranger may have created this account with a password.
				const queryToken: unknown = ctx.query?.token;
				const token = typeof queryToken === "string" ? queryToken : null;
				const magicEmail = token ? await findMagicLinkEmail(token) : null;
				if (magicEmail) {
					const user = await db.query.authUsers.findFirst({
						where: (users, { eq }) => eq(users.email, magicEmail),
						columns: { id: true },
					});
					if (user) {
						await resetUnverifiedAccount(user.id);
					}
				}
				return;
			}

			if (ctx.path === "/change-password") {
				const newPassword = getBodyValueAsString(ctx.body, "newPassword");
				if (newPassword) await assertPasswordMeetsPolicy(newPassword, locale);
				return;
			}

			if (ctx.path === "/set-password") {
				const newPassword = getBodyValueAsString(ctx.body, "newPassword");
				if (newPassword) await assertPasswordMeetsPolicy(newPassword, locale);
			}
		}),
	},
	socialProviders,
	plugins: [
		...(env.TURNSTILE_SECRET_KEY
			? [
					captcha({
						provider: "cloudflare-turnstile",
						secretKey: env.TURNSTILE_SECRET_KEY,
						endpoints: [
							"/sign-up/email",
							"/sign-in/email",
							"/sign-in/magic-link",
						],
					}),
				]
			: []),
		magicLink({
			expiresIn: MAGIC_LINK_EXPIRATION_SECONDS,
			storeToken: "hashed",
			sendMagicLink: async ({ email, url, metadata }, ctx) => {
				const locale = resolveMagicLinkLocale({
					metadata,
					url,
					headers: ctx?.headers,
				});
				const html = await renderMagicLinkEmail({ url, locale });
				await sendTransactionalEmail({
					to: email,
					subject: auth_email_magic_link_preview({}, { locale }),
					text: `${auth_email_magic_link_intro({}, { locale })}\n\n${url}\n\n${auth_email_magic_link_ignore({}, { locale })}`,
					html,
				});
			},
		}),
		groupInvitation(),
		tanstackStartCookies(),
	],
});
