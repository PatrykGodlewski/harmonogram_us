import http from "k6/http";

/** Written by e2e/load/setup.ts: sessions, payloads and server function ids. */
export const run = JSON.parse(open("../.run/run.json"));

/** Calls a server function the way the browser does (same origin, seroval JSON body). */
export function callServerFn(name, body, cookie, tag) {
	return http.post(`${run.webUrl}/_serverFn/${run.functionIds[name]}`, body, {
		headers: {
			"content-type": "application/json",
			accept: "application/json",
			"x-tsr-serverFn": "true",
			origin: run.webUrl,
			"sec-fetch-site": "same-origin",
			cookie,
		},
		tags: { name: tag },
	});
}

/** Loads a server-rendered page as a signed-in user. */
export function getPage(path, cookie, tag) {
	return http.get(`${run.webUrl}${path}`, {
		headers: { cookie },
		tags: { name: tag },
	});
}
