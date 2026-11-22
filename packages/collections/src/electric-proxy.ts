import { ELECTRIC_PROTOCOL_QUERY_PARAMS } from "@electric-sql/client";
import type { ShapeDefinition } from "./shapes";

export type ElectricProxyConfig = {
	/** Base URL of the Electric service, e.g. `http://localhost:5133`. */
	electricUrl: string;
	/** Electric shared secret; added server-side, never sent to the browser. */
	secret?: string;
	fetchImpl?: typeof fetch;
};

const HOP_BY_HOP_HEADERS = [
	"connection",
	"keep-alive",
	"proxy-connection",
	"transfer-encoding",
	"upgrade",
	"te",
	"trailer",
];

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
	// Subset filters (subset__where) may only use the shape's own columns.
	upstream.searchParams.set("queryable_columns", shape.columns.join(","));
	if ("where" in shape && shape.where) {
		upstream.searchParams.set("where", shape.where);
	}
	if (secret) {
		upstream.searchParams.set("secret", secret);
	}

	const response = await fetchImpl(upstream, {
		headers: { accept: request.headers.get("accept") ?? "application/json" },
		cache: "no-store",
	});

	const headers = new Headers(response.headers);
	// Per-connection headers (RFC 9110 §7.6.1) belong to the upstream hop; HTTP/2 refuses them.
	const perConnection = (headers.get("connection") ?? "")
		.split(",")
		.map((name) => name.trim())
		.filter(Boolean);
	for (const name of [...HOP_BY_HOP_HEADERS, ...perConnection]) {
		headers.delete(name);
	}
	// fetch already decoded the body; forwarding these would corrupt it.
	headers.delete("content-encoding");
	headers.delete("content-length");

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}
