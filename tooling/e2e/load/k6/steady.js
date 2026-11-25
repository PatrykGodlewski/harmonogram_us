import { check, sleep } from "k6";
import { Rate } from "k6/metrics";
import { callServerFn, getPage, run } from "./common.js";

// Signed-in users browse and register/withdraw on a few events that fill up, so
// withdrawals keep promoting people from the waitlist under load.
/** Share of registrations that landed on the waitlist (the events are meant to fill up). */
const waitlisted = new Rate("registrations_waitlisted");

export const options = {
	scenarios: {
		steady: {
			executor: "constant-vus",
			vus: run.steady.users.length,
			duration: "2m",
			gracefulStop: "30s",
		},
	},
	thresholds: {
		http_req_failed: ["rate<0.01"],
		http_req_duration: ["p(95)<500"],
		checks: ["rate>0.99"],
		// The scenario only tests promotion if the events really fill up.
		registrations_waitlisted: ["rate>0.2"],
	},
};

export default function () {
	const user = run.steady.users[__VU - 1];
	const index = Math.floor(Math.random() * run.steady.eventIds.length);
	const eventId = run.steady.eventIds[index];

	check(getPage("/pl", user.cookie, "page list"), { "list 200": (r) => r.status === 200 });
	sleep(1);
	check(getPage(`/pl/events/${eventId}`, user.cookie, "page event"), {
		"event 200": (r) => r.status === 200,
	});
	const registered = callServerFn("registerForEventServer", user.register[index], user.cookie, "register");
	check(registered, {
		"register 200": (r) => r.status === 200,
	});
	waitlisted.add(/"waitlisted"/.test(registered.body));
	sleep(2);
	check(getPage("/pl/account", user.cookie, "page account"), {
		"account 200": (r) => r.status === 200,
	});
	check(callServerFn("unregisterFromEventServer", user.unregister[index], user.cookie, "unregister"), {
		"unregister 200": (r) => r.status === 200,
	});
	sleep(1);
}
