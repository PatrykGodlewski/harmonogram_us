import { assertProductionSecurityConfig } from "@repo/api/security/production-config";
import { env } from "@repo/env";

assertProductionSecurityConfig({
	nodeEnv: env.NODE_ENV,
	turnstileSecretKey: env.TURNSTILE_SECRET_KEY,
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
