import { ELECTRIC_PROTOCOL_QUERY_PARAMS } from "@electric-sql/client";
import type { ShapeDefinition } from "./shapes";

export type ElectricProxyConfig = {
	/** Base URL of the Electric service, e.g. `http://localhost:5133`. */
	electricUrl: string;
	/** Electric shared secret; added server-side, never sent to the browser. */
	secret?: string;
	fetchImpl?: typeof fetch;
};

/**
 * Proxies a shape request to Electric (server-only).
 * Forwards only Electric protocol params from the client; the server sets
 * the table, columns and secret, so clients can't read other tables or rows.
 */
export async function proxyShape(
	request: Request,
	shape: ShapeDefinition,
	{ electricUrl, secret, fetchImpl = fetch }: ElectricProxyConfig,
): Promise<Response> {
	const incoming = new URL(request.url);
	const upstream = new URL("/v1/shape", electricUrl);

	for (const [key, value] of incoming.searchParams) {
		if (ELECTRIC_PROTOCOL_QUERY_PARAMS.includes(key)) {
			upstream.searchParams.set(key, value);
		}
	}

	upstream.searchParams.set("table", shape.table);
	upstream.searchParams.set("columns", shape.columns.join(","));
	if (secret) {
		upstream.searchParams.set("secret", secret);
	}

	const response = await fetchImpl(upstream, {
		headers: { accept: request.headers.get("accept") ?? "application/json" },
		cache: "no-store",
	});

	// fetch already decoded the body; forwarding these would corrupt it.
	const headers = new Headers(response.headers);
	headers.delete("content-encoding");
	headers.delete("content-length");

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}
