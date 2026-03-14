import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

/**
 * Load .env so server code (createServerFn handlers, db, etc.) always has env.
 * Tries, in order: monorepo root (from package location), cwd, cwd/../..
 */
function loadEnv(): void {
	const cwd = process.cwd();
	// Monorepo root: packages/env/src -> packages/env -> packages -> root
	const pkgDir = dirname(dirname(fileURLToPath(import.meta.url)));
	const rootDir = resolve(pkgDir, '../..');

	const paths = [
		resolve(rootDir, '.env'), // monorepo root – ensures server has env
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
	config(); // fallback: dotenv default
}

loadEnv();
