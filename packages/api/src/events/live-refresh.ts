/**
 * How often open pages refetch seat counts, event state and waitlist positions.
 * TanStack Query pauses the interval in hidden tabs and refetches on focus.
 */
export const LIVE_REFRESH_MS = 15_000;
