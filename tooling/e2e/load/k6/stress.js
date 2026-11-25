import { check, sleep } from "k6";
import { callServerFn, getPage, run } from "./common.js";

// Stepped ramp to find where the app stops keeping up: the same mix as the steady
// scenario, 50 → 100 → 200 → 400 users. It stops early once errors or latency get bad;
// the step it reached is the result (pnpm load:stress, informational).
export const options = {
	scenarios: {
		stress: {
			executor: "ramping-vus",
			startVUs: 0,
			stages: [
				{ duration: "30s", target: 50 },
				{ duration: "30s", target: 50 },
				{ duration: "30s", target: 100 },
				{ duration: "30s", target: 100 },
				{ duration: "30s", target: 200 },
				{ duration: "30s", target: 200 },
				{ duration: "30s", target: run.stress.users.length },
				{ duration: "1m", target: run.stress.users.length },
				{ duration: "15s", target: 0 },
			],
			gracefulRampDown: "15s",
		},
	},
	thresholds: {
		http_req_failed: [{ threshold: "rate<0.05", abortOnFail: true, delayAbortEval: "20s" }],
		http_req_duration: [{ threshold: "p(95)<2000", abortOnFail: true, delayAbortEval: "20s" }],
	},
};

export default function () {
	const user = run.stress.users[__VU - 1];
	const index = Math.floor(Math.random() * run.stress.eventIds.length);
	const eventId = run.stress.eventIds[index];

	check(getPage("/pl", user.cookie, "page list"), { "list 200": (r) => r.status === 200 });
	sleep(1);
	check(getPage(`/pl/events/${eventId}`, user.cookie, "page event"), {
		"event 200": (r) => r.status === 200,
	});
	check(callServerFn("registerForEventServer", user.register[index], user.cookie, "register"), {
		"register 200": (r) => r.status === 200,
	});
	sleep(2);
	check(callServerFn("unregisterFromEventServer", user.unregister[index], user.cookie, "unregister"), {
		"unregister 200": (r) => r.status === 200,
	});
	sleep(1);
}
