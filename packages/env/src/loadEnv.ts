import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Load .env from project root or monorepo root.
 * Tries: cwd/.env, cwd/../../.env (for apps/*)
 */
function loadEnv(): void {
	const cwd = process.cwd();
	const paths = [
		resolve(cwd, '.env'),
		resolve(cwd, '../../.env'),
		resolve(cwd, '../.env'),
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
