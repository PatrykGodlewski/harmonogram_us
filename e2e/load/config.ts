/** Shared settings of the load tests (see e2e/load/README.md). */
export const LOAD = {
	webUrl: process.env.E2E_WEB_URL ?? "http://localhost:3100",
	composeProject: "harmonogram-e2e",
	/** Spike: this many people register for one event with `spikeSeats` places. */
	spikeUsers: 500,
	spikeSeats: 50,
	/** Steady: this many people browse and register/withdraw on `steadyEvents` events. */
	steadyUsers: 100,
	steadyEvents: 2,
	steadySeats: 10,
	/** Stress: users for the stepped ramp that looks for the breaking point (pnpm load:stress). */
	stressUsers: 400,
	/** Where the setup writes sessions, payloads and function ids for k6 (gitignored). */
	runDir: new URL("./.run/", import.meta.url),
	/** grafana/k6 v2.4.0, pinned like the other images. */
	k6Image:
		"grafana/k6@sha256:3d8e5c7f1d53ec59408c2ffbd9943602a0985ffcbd4a2430ec00f3ffca89796e",
} as const;

/** Server functions the load tests call, by export name. */
export const LOAD_FUNCTIONS = [
	"registerForEventServer",
	"unregisterFromEventServer",
] as const;

export type LoadFunction = (typeof LOAD_FUNCTIONS)[number];

export type LoadRun = {
	webUrl: string;
	functionIds: Record<LoadFunction, string>;
	spike: { eventId: string; users: { cookie: string; register: string }[] };
	stress?: LoadUsers;
	steady: LoadUsers;
};

/** Signed-in users with request bodies per event (same order as eventIds). */
export type LoadUsers = {
	eventIds: string[];
	users: {
		cookie: string;
		/** Payloads per steady event, same order as eventIds. */
		register: string[];
		unregister: string[];
	}[];
};
