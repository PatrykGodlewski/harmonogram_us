import { assertProductionSecurityConfig } from "@repo/api/security/production-config";
import { env } from "@repo/env";

assertProductionSecurityConfig({
	nodeEnv: env.NODE_ENV,
	turnstileSecretKey: env.TURNSTILE_SECRET_KEY,
});

import { warmUpJobQueue } from "@repo/jobs/client";

// Start the pg-boss producer with the server, not inside the first request's
// transaction. If it fails here, the first enqueue starts it lazily instead.
void warmUpJobQueue().catch((error: unknown) => {
	console.error(
		"[jobs] pg-boss start-up failed; will retry on first enqueue",
		error,
	);
});

export default {
	async fetch(request: Request) {
		const [{ paraglideMiddleware }, { default: startHandler }] =
			await Promise.all([
				import("@repo/i18n/paraglide/server"),
				import("@tanstack/react-start/server-entry"),
			]);
		return paraglideMiddleware(request, () => startHandler.fetch(request));
	},
};
