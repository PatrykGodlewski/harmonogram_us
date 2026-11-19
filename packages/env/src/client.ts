import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import { mergeClientRuntimeEnv } from "./runtime-env";

const isTimeZone = (value: string): boolean =>
	Intl.supportedValuesOf("timeZone").includes(value) || value === "UTC";

export const env = createEnv({
	clientPrefix: "VITE_",
	client: {
		VITE_TURNSTILE_SITE_KEY: z.string().optional(),
		VITE_APP_TIME_ZONE: z
			.string()
			.refine(isTimeZone, {
				message: "VITE_APP_TIME_ZONE must be an IANA time zone",
			})
			.default("Europe/Warsaw"),
	},
	// Browser and SSR: values Vite inlined at build time. Worker and tests: process.env.
	runtimeEnv: mergeClientRuntimeEnv(
		(import.meta as ImportMeta & { env?: Record<string, string | undefined> })
			.env,
		typeof process === "undefined" ? {} : process.env,
	),
	emptyStringAsUndefined: true,
});
