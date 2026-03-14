/** Extracts a user-friendly message from validation/server errors (e.g. Zod) */
export function getErrorMessage(err: Error | undefined, fallback = 'Something went wrong'): string {
	const msg = err?.message ?? fallback;
	try {
		const parsed = JSON.parse(msg);
		const first = Array.isArray(parsed) ? parsed[0] : parsed;
		return typeof first === 'object' && first?.message ? first.message : msg;
	} catch {
		return msg;
	}
}
