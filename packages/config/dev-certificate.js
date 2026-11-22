import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * The dev servers run on HTTPS so browsers use HTTP/2, as in production: over
 * HTTP/1.1 a browser opens at most 6 connections per origin, and Vite's many
 * module requests across a few open tabs queue behind each other.
 *
 * Returns a trusted certificate made with mkcert in `.certs/` (see
 * docs/development.md), or undefined to use a self-signed one instead.
 *
 * @param {string} workspaceRoot
 * @returns {{ cert: Buffer; key: Buffer } | undefined}
 */
export function devCertificate(workspaceRoot) {
	const cert = path.join(workspaceRoot, ".certs/localhost.pem");
	const key = path.join(workspaceRoot, ".certs/localhost-key.pem");
	return existsSync(cert) && existsSync(key)
		? { cert: readFileSync(cert), key: readFileSync(key) }
		: undefined;
}
