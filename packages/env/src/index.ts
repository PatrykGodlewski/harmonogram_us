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
		BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
		TURNSTILE_SECRET_KEY: z.string().optional(),
		REDIS_URL: z.string().optional(),
		REDIS_PASSWORD: z.string().optional(),
		HIBP_MIN_BREACH_COUNT: z.coerce.number().int().positive().default(1),

		GOOGLE_CLIENT_ID: z.string().optional(),
		GOOGLE_CLIENT_SECRET: z.string().optional(),

		SMTP_HOST: z.string().optional(),
		SMTP_PORT: z.coerce.number().int().positive().optional(),
		SMTP_USER: z.string().optional(),
		SMTP_PASSWORD: z.string().optional(),
		SMTP_FROM: z.string().optional(),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
