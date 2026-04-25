import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

/**
 * Load .env from project root or monorepo root.
 * Prefer monorepo root .env for server runtime in apps/*.
 * Tries: cwd/../../.env, cwd/.env, cwd/../.env
 */
function loadEnv(): void {
	const cwd = process.cwd();
	const paths = [
		resolve(cwd, "../../.env"),
		resolve(cwd, ".env"),
		resolve(cwd, "../.env"),
	];
	for (const p of paths) {
		if (existsSync(p)) {
			config({ path: p });
			return;
		}
	}
	config(); // fallback: dotenv default (cwd)
}

loadEnv();
