import { check, sleep } from "k6";
import exec from "k6/execution";
import http from "k6/http";
import { getPage, run } from "./common.js";

// Everyone downloads their ticket PDF within ~10 s while others browse: does rendering
// slow down the rest of the site? run.ts compares browse p95 with the saved baseline.
const { downloads, browsers, eventId } = run.documents;

export const options = {
	scenarios: {
		browse: {
			executor: "constant-vus",
			exec: "browse",
			vus: browsers.length,
			duration: "25s",
		},
		burst: {
			executor: "per-vu-iterations",
			exec: "download",
			vus: downloads.length,
			iterations: 1,
			startTime: "5s",
			maxDuration: "1m",
		},
	},
	thresholds: {
		"http_req_failed{name:ticket-pdf}": ["rate==0"],
		"checks{check:pdf}": ["rate==1"],
		// Loose limits: these exist so the summary reports both p95s for the comparison.
		"http_req_duration{name:ticket-pdf}": ["p(95)<10000"],
		"http_req_duration{name:browse}": ["p(95)<10000"],
	},
};

export function browse() {
	const user = browsers[(exec.vu.idInTest - 1) % browsers.length];
	getPage("/pl", user.cookie, "browse");
	sleep(0.5);
	getPage(`/pl/events/${eventId}`, user.cookie, "browse");
	sleep(0.5);
}

export function download() {
	const holder = downloads[exec.scenario.iterationInTest];
	sleep(Math.random() * 10);
	const response = http.get(`${run.webUrl}${holder.path}`, {
		headers: { cookie: holder.cookie },
		tags: { name: "ticket-pdf" },
		responseType: "binary",
	});
	check(
		response,
		{
			pdf: (r) =>
				r.status === 200 &&
				String.fromCharCode(...new Uint8Array(r.body.slice(0, 4))) === "%PDF",
		},
		{ check: "pdf" },
	);
}
