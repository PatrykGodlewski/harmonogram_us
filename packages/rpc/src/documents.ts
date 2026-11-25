/** Server-only: the client for the Rust documents service (apps/documents). */
import {
	type Client,
	Code,
	ConnectError,
	createClient,
	type Interceptor,
} from "@connectrpc/connect";
import { createGrpcTransport } from "@connectrpc/connect-node";
import { env } from "@repo/env";
import { DocumentService } from "./gen/harmonogram/documents/v1/documents_pb";

export type DocumentsClient = Client<typeof DocumentService>;

/** Matches the service's own limit (apps/documents/src/limits.rs). */
const MAX_MESSAGE_BYTES = 64 * 1024 * 1024;
const DEADLINE_MS = 5000;

function bearer(token: string): Interceptor {
	return (next) => (request) => {
		request.header.set("authorization", `Bearer ${token}`);
		return next(request);
	};
}

/** Rendering is idempotent: a call that never reached the service is tried once more. */
const retryUnavailableOnce: Interceptor = (next) => async (request) => {
	try {
		return await next(request);
	} catch (error) {
		if (ConnectError.from(error).code !== Code.Unavailable) throw error;
		return next(request);
	}
};

/** A client for the service at `baseUrl`; prefer `documentsClient()`. */
export function createDocumentsClient(
	baseUrl: string,
	token: string,
): DocumentsClient {
	const transport = createGrpcTransport({
		baseUrl,
		interceptors: [retryUnavailableOnce, bearer(token)],
		defaultTimeoutMs: DEADLINE_MS,
		readMaxBytes: MAX_MESSAGE_BYTES,
		writeMaxBytes: MAX_MESSAGE_BYTES,
	});
	return createClient(DocumentService, transport);
}

let shared: DocumentsClient | undefined;

/** The process-wide client (one HTTP/2 connection), configured by DOCUMENTS_URL/TOKEN. */
export function documentsClient(): DocumentsClient {
	if (!shared) {
		if (!env.DOCUMENTS_URL || !env.DOCUMENTS_TOKEN) {
			throw new Error("DOCUMENTS_URL and DOCUMENTS_TOKEN must be set");
		}
		shared = createDocumentsClient(env.DOCUMENTS_URL, env.DOCUMENTS_TOKEN);
	}
	return shared;
}

/** The service is down, overloaded or too slow: worth trying again shortly. */
export function isDocumentsBusy(error: unknown): boolean {
	return (
		error instanceof ConnectError &&
		[Code.Unavailable, Code.DeadlineExceeded, Code.ResourceExhausted].includes(
			error.code,
		)
	);
}
