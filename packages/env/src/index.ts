import "./loadEnv";
import { isAbsolute } from "node:path";
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
		BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
		ADMIN_URL: z.url().default("http://localhost:3001"),
		TURNSTILE_SECRET_KEY: z.string().optional(),
		HIBP_MIN_BREACH_COUNT: z.coerce.number().int().positive().default(1),
		/**
		 * Days after an event ends before its registrations are deleted (GDPR).
		 * At least 30, the survey window (SURVEY_OPEN_DAYS in @repo/db, which
		 * this package cannot import): retention must not delete a registration
		 * while its survey is still open.
		 */
		REGISTRATION_RETENTION_DAYS: z.coerce.number().int().min(30).default(365),
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

		/**
		 * Generated event cover images: on when enabled, ANTHROPIC_API_KEY is set, the image
		 * provider has its keys (fal: FAL_KEY; cloudflare: account id and API token) and the
		 * image has a place to go (the S3 bucket or EVENT_IMAGE_DIR).
		 * An enum, not z.coerce.boolean(): that turns "false" into true.
		 */
		EVENT_IMAGE_ENABLED: z.enum(["true", "false"]).default("true"),
		ANTHROPIC_API_KEY: z.string().min(1).optional(),
		/** Model that turns an event's title and description into an image prompt. */
		EVENT_IMAGE_MODEL: z.string().min(1).default("claude-haiku-5-5"),
		/** Appended to every image prompt; the code has a default. */
		EVENT_IMAGE_STYLE: z.string().min(1).optional(),
		IMAGE_PROVIDER: z.enum(["fal", "cloudflare"]).default("fal"),
		FAL_KEY: z.string().min(1).optional(),
		CLOUDFLARE_ACCOUNT_ID: z.string().min(1).optional(),
		CLOUDFLARE_API_TOKEN: z.string().min(1).optional(),
		/** Where images are kept when no S3 bucket is set; absolute (each app has its own working directory). */
		EVENT_IMAGE_DIR: z
			.string()
			.min(1)
			.refine(isAbsolute, {
				message: "EVENT_IMAGE_DIR must be an absolute path",
			})
			.optional(),

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
