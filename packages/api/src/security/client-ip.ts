/** Best-effort client IP from proxy headers (Railway/Nitro set x-forwarded-for). */
export function getClientIp(headers: Headers | undefined): string {
	if (!headers) return "unknown";
	const forwarded = headers.get("x-forwarded-for");
	if (forwarded) {
		const firstIp = forwarded.split(",")[0]?.trim();
		if (firstIp) return firstIp;
	}
	const realIp = headers.get("x-real-ip");
	if (realIp) return realIp.trim();
	return "unknown";
}
