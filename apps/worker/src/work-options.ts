import type { WorkOptions } from "pg-boss";

/**
 * E-mail queues fetch one job at a time: pg-boss fails (and retries) the whole fetched
 * batch when the handler throws, which would resend e-mails already delivered and, for
 * invitations, replace a token the student already received. Throughput comes from
 * running several handlers at once instead.
 */
export const EMAIL_WORK = {
	batchSize: 1,
	localConcurrency: 5,
} satisfies WorkOptions;
