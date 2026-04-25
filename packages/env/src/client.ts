import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	clientPrefix: "VITE_",
	client: {
		VITE_TURNSTILE_SITE_KEY: z.string().optional(),
	},
	runtimeEnv: (
		import.meta as ImportMeta & {
			env: Record<string, string | undefined>;
		}
	).env,
	emptyStringAsUndefined: true,
});
