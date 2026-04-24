import "./loadEnv";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	server: {
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
		SESSION_SECRET: z
			.string({ message: "SESSION_SECRET must be provided" })
			.min(32, "SESSION_SECRET must be at least 32 characters"),
		ENCRYPTION_KEY: z
			.string({ message: "ENCRYPTION_KEY must be provided" })
			.min(1, "ENCRYPTION_KEY must not be empty")
			.refine(
				(val) => {
					try {
						const decoded = Buffer.from(val, "base64");
						return decoded.length === 16;
					} catch {
						return false;
					}
				},
				{ message: "ENCRYPTION_KEY must be base64-encoded 16 bytes" },
			),
		DATABASE_URL: z
			.string()
			.url()
			.optional()
			.default("postgresql://postgres:postgres@localhost:5432/harmonogram_us"),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});
