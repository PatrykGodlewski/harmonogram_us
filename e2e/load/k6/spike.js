import { check, sleep } from "k6";
import { callServerFn, run } from "./common.js";

// Every spike user registers once for the same event, all within ~10 s.
export const options = {
	scenarios: {
		rush: {
			executor: "per-vu-iterations",
			vus: run.spike.users.length,
			iterations: 1,
			maxDuration: "2m",
		},
	},
	thresholds: {
		"http_req_failed{name:register}": ["rate==0"],
		"checks{check:registered or waitlisted}": ["rate==1"],
		"http_req_duration{name:register}": ["p(95)<2000"],
	},
};

export default function () {
	const user = run.spike.users[__VU - 1];
	sleep(Math.random() * 10);
	const response = callServerFn("registerForEventServer", user.register, user.cookie, "register");
	check(
		response,
		{
			"registered or waitlisted": (r) =>
				r.status === 200 && /"(registered|waitlisted)"/.test(r.body),
		},
		{ check: "registered or waitlisted" },
	);
}
