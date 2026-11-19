type EnvRecord = Record<string, string | undefined>;

/**
 * Values for client (`VITE_*`) variables: what Vite inlined at build time wins, so the
 * server-rendered HTML and the browser bundle always agree. Where nothing was inlined
 * (the esbuild-bundled worker, Vitest) the runtime `process.env` value is used.
 */
export function mergeClientRuntimeEnv(
	buildEnv: EnvRecord | undefined,
	processEnv: EnvRecord,
): EnvRecord {
	const merged: EnvRecord = { ...processEnv };
	for (const [key, value] of Object.entries(buildEnv ?? {})) {
		if (value !== undefined && value !== "") {
			merged[key] = value;
		}
	}
	return merged;
}
