import { FetchError } from "@electric-sql/client";

const RETRYABLE_STATUSES = new Set([408, 429]);

/**
 * `onError` for Electric shapes. The client already retries 5xx and network
 * failures with backoff; anything reaching here won't fix itself, except
 * timeouts and rate limiting. Returning `{}` retries with the same options,
 * returning nothing stops the stream (Electric docs), so permanent errors are
 * reported instead of retried forever.
 */
export function handleShapeError(
	error: Error,
): Record<string, never> | undefined {
	if (error instanceof FetchError && RETRYABLE_STATUSES.has(error.status)) {
		return {};
	}
	console.error("[Electric] Shape sync stopped:", error);
	return undefined;
}
