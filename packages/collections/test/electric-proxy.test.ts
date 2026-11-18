import { describe, expect, it } from "vitest";
import { proxyShape } from "../src/electric-proxy";
import { shapes } from "../src/shapes";

function fakeElectric(body = "[]") {
	const calls: URL[] = [];
	const fetchImpl = async (input: URL | RequestInfo) => {
		calls.push(new URL(String(input)));
		return new Response(body, {
			status: 200,
			headers: {
				"content-encoding": "gzip",
				"content-length": "999",
				"electric-handle": "h-1",
			},
		});
	};
	return { calls, fetchImpl };
}

const config = { electricUrl: "http://electric:3000", secret: "s3cret" };

describe("proxyShape", () => {
	it("forwards only Electric protocol params; the server decides the shape", async () => {
		const { calls, fetchImpl } = fakeElectric();
		const request = new Request(
			"http://app.test/api/electric/agenda-item-seat-counts?offset=-1&handle=h&live=true&table=user&where=1%3D1&params=%5B%5D&columns=email",
		);

		await proxyShape(request, shapes.agendaItemSeatCounts, { ...config, fetchImpl });

		const upstream = calls[0];
		expect(upstream?.origin + upstream?.pathname).toBe("http://electric:3000/v1/shape");
		expect(upstream?.searchParams.get("offset")).toBe("-1");
		expect(upstream?.searchParams.get("handle")).toBe("h");
		expect(upstream?.searchParams.get("live")).toBe("true");
		expect(upstream?.searchParams.get("table")).toBe("agenda_item_seat_counts");
		expect(upstream?.searchParams.get("columns")).toBe(
			shapes.agendaItemSeatCounts.columns.join(","),
		);
		expect(upstream?.searchParams.get("where")).toBeNull();
		expect(upstream?.searchParams.get("params")).toBeNull();
		expect(upstream?.searchParams.get("secret")).toBe("s3cret");
	});

	it("omits the secret when none is configured", async () => {
		const { calls, fetchImpl } = fakeElectric();
		await proxyShape(
			new Request("http://app.test/x?offset=-1"),
			shapes.eventSeatCounts,
			{ electricUrl: config.electricUrl, fetchImpl },
		);
		expect(calls[0]?.searchParams.has("secret")).toBe(false);
	});

	it("strips encoding headers but keeps Electric headers", async () => {
		const { fetchImpl } = fakeElectric("[1]");
		const response = await proxyShape(
			new Request("http://app.test/x?offset=-1"),
			shapes.eventSeatCounts,
			{ ...config, fetchImpl },
		);
		expect(response.headers.get("content-encoding")).toBeNull();
		expect(response.headers.get("content-length")).toBeNull();
		expect(response.headers.get("electric-handle")).toBe("h-1");
		expect(await response.text()).toBe("[1]");
	});
});
