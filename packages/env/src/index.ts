import "./loadEnv";
import { decodeBase64 } from "@oslojs/encoding";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

function isValidEncryptionKey(value: string): boolean {
	try {
		return decodeBase64(value).length === 16;
	} catch {
		return false;
	}
}

export const env = createEnv({
	server: {
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
		ENCRYPTION_KEY: z
			.string({ message: "ENCRYPTION_KEY must be provided" })
			.refine(isValidEncryptionKey, {
				message: "ENCRYPTION_KEY must be base64-encoded 16 bytes",
			}),

		DATABASE_URL: z
			.url()
			.optional()
			.default("postgresql://postgres:postgres@localhost:5432/harmonogram_us"),

		BETTER_AUTH_SECRET: z
			.string({ message: "BETTER_AUTH_SECRET must be provided" })
			.min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
		BETTER_AUTH_URL: z.url().default("https://localhost:3000"),
		ADMIN_URL: z.url().default("https://localhost:3001"),
		TURNSTILE_SECRET_KEY: z.string().optional(),
		HIBP_MIN_BREACH_COUNT: z.coerce.number().int().positive().default(1),
		/** Days after an event ends before its registrations are deleted (GDPR). */
		REGISTRATION_RETENTION_DAYS: z.coerce
			.number()
			.int()
			.positive()
			.default(365),
		/** Who controls personal data (GDPR art. 13), shown on the privacy page. */
		PRIVACY_CONTROLLER: z.string().min(1).optional(),
		PRIVACY_CONTACT_EMAIL: z.email().optional(),

		/** University sign-in (OpenID Connect); on when the URL, ID and secret are all set. */
		UNIVERSITY_SSO_DISCOVERY_URL: z.url().optional(),
		UNIVERSITY_SSO_CLIENT_ID: z.string().min(1).optional(),
		UNIVERSITY_SSO_CLIENT_SECRET: z.string().min(1).optional(),
		/** Shown on the sign-in button, e.g. "Uniwersytet Śląski". */
		UNIVERSITY_SSO_NAME: z.string().min(1).optional(),

		/** Teams meetings through Microsoft Graph (F23); on when tenant, client, secret and organizer are set. */
		TEAMS_TENANT_ID: z.string().min(1).optional(),
		TEAMS_CLIENT_ID: z.string().min(1).optional(),
		TEAMS_CLIENT_SECRET: z.string().min(1).optional(),
		/** Entra object id or UPN of the account the meetings belong to (needs an application access policy). */
		TEAMS_ORGANIZER_ID: z.string().min(1).optional(),
		TEAMS_LOGIN_URL: z.url().default("https://login.microsoftonline.com"),
		TEAMS_GRAPH_URL: z.url().default("https://graph.microsoft.com"),

		/** Files in an S3-compatible bucket (F14): Cloudflare R2 in production, SeaweedFS locally; on when all four are set. */
		S3_ENDPOINT: z.url().optional(),
		S3_BUCKET: z.string().min(1).optional(),
		S3_ACCESS_KEY_ID: z.string().min(1).optional(),
		S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
		S3_REGION: z.string().min(1).default("auto"),

		SMTP_HOST: z.string().optional(),
		SMTP_PORT: z.coerce.number().int().positive().optional(),
		SMTP_USER: z.string().optional(),
		SMTP_PASSWORD: z.string().optional(),
		SMTP_FROM: z.string().min(1, "SMTP_FROM must be provided (sender address)"),

		/** Password of the seeded local test accounts (pnpm db:seed); never set in production. */
		SEED_ACCOUNT_PASSWORD: z.string().min(12).optional(),

		/** Bearer token Prometheus sends to /api/metrics; unset = the endpoint answers 404. */
		METRICS_TOKEN: z.string().min(16).optional(),

		/** The Rust documents service (gRPC) and the token it requires; used by web and admin. */
		DOCUMENTS_URL: z.url().optional(),
		DOCUMENTS_TOKEN: z.string().min(32).optional(),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
