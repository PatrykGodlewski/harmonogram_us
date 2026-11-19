/** Refuses to start a production server without the protections it relies on. */
export function assertProductionSecurityConfig(config: {
	nodeEnv: string;
	turnstileSecretKey?: string;
}): void {
	if (config.nodeEnv === "production" && !config.turnstileSecretKey) {
		throw new Error("TURNSTILE_SECRET_KEY is required in production");
	}
}
