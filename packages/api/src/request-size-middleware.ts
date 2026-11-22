import { createMiddleware } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";

/** A 25 MB file (F14) plus its form fields; Start reads a server function's whole body into memory. */
export const MAX_REQUEST_BYTES = 26 * 1024 * 1024;

const SERVER_FN_PREFIX = "/_serverFn/";

/**
 * 413 for a server-function body over the limit, 411 when a body comes
 * without a length (browsers always send one; a chunked body could be endless).
 * Null for everything else, which Start handles as usual.
 */
export function oversizedRequestResponse(request: Request): Response | null {
	if (
		request.method === "GET" ||
		request.method === "HEAD" ||
		!new URL(request.url).pathname.startsWith(SERVER_FN_PREFIX)
	) {
		return null;
	}
	const header = request.headers.get("content-length");
	const length = header && /^\d+$/.test(header) ? Number(header) : null;
	if (length === null) {
		return new Response("Length Required", { status: 411 });
	}
	return length > MAX_REQUEST_BYTES
		? new Response("Payload Too Large", { status: 413 })
		: null;
}

/** Global request middleware (each app's `src/start.ts`): refuses oversized bodies before they are read. */
export const requestSizeMiddleware = createMiddleware().server(
	({ request, next }) => {
		const refusal = oversizedRequestResponse(request);
		if (refusal) {
			// Start answers a server-function request with its own response status, not the thrown one's.
			setResponseStatus(refusal.status);
			throw refusal;
		}
		return next();
	},
);
