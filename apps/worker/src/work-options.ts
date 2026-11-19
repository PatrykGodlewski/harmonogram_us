import type { WorkOptions } from "pg-boss";

/**
 * E-mail queues fetch one job at a time: pg-boss fails (and retries) the whole fetched
 * batch when the handler throws, which would resend e-mails already delivered and, for
 * invitations, replace a token the student already received. Throughput comes from
 * running several handlers at once instead.
 *
 * pg-boss waits `pollingIntervalSeconds` between fetches, so 5 handlers × 1 job / 2 s
 * (the default) sent 2.5 e-mails/s and a 500-registration rush waited minutes for its
 * confirmations (load test). With a backlog, burst mode fetches without waiting; when
 * idle, a 1 s poll keeps a single confirmation quick.
 */
export const EMAIL_WORK = {
	batchSize: 1,
	localConcurrency: 5,
	pollingIntervalSeconds: 1,
	burstWhenReadyExceeds: 10,
} satisfies WorkOptions;
