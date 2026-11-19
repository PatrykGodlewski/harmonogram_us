// Must run first: points the database at the e2e stack, not the dev database.
import "../stack-env";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { userInfo } from "node:os";
import { fileURLToPath } from "node:url";
import { closeDb } from "@repo/db/client";
import { LOAD } from "./config";
import { setupLoadRun } from "./setup";
import { drainEmails, verifySpike, verifySteady } from "./verify";

const loadDir = fileURLToPath(new URL(".", import.meta.url));

const prometheusUrl =
	process.env.E2E_PROMETHEUS_URL ?? "http://localhost:19090";

/** Whether Prometheus is up (pnpm observability:up); then k6 also streams its results there. */
async function prometheusIsUp(): Promise<boolean> {
	try {
		return (await fetch(`${prometheusUrl}/-/ready`)).ok;
	} catch {
		return false;
	}
}

/**
 * Runs one k6 scenario in Docker against the e2e stack; true when its thresholds pass.
 * Every run leaves an HTML report (k6 web dashboard) and a JSON summary in load/.run/.
 */
function k6(script: string, toPrometheus: boolean): boolean {
	const name = script.replace(".js", "");
	const { uid, gid } = userInfo();
	const outputs = toPrometheus
		? [
				"--out",
				"experimental-prometheus-rw",
				"--tag",
				`testid=${name}-${Date.now()}`,
			]
		: [];
	try {
		execFileSync(
			"docker",
			[
				"run",
				"--rm",
				"--network",
				"host",
				"-u",
				`${uid}:${gid}`,
				"-v",
				`${loadDir}:/load`,
				"-w",
				"/load/k6",
				"-e",
				"K6_WEB_DASHBOARD=true",
				"-e",
				"K6_WEB_DASHBOARD_OPEN=false",
				"-e",
				`K6_WEB_DASHBOARD_EXPORT=/load/.run/${name}-report.html`,
				"-e",
				`K6_PROMETHEUS_RW_SERVER_URL=${prometheusUrl}/api/v1/write`,
				"-e",
				"K6_PROMETHEUS_RW_TREND_STATS=p(95),p(99),avg,max",
				LOAD.k6Image,
				"run",
				"--quiet",
				...outputs,
				"--summary-export",
				`/load/.run/${name}-summary.json`,
				script,
			],
			{ stdio: "inherit" },
		);
		return true;
	} catch {
		return false;
	}
}

type Summary = {
	metrics: Record<string, Record<string, number> | undefined>;
};

function report(name: string) {
	const summary = JSON.parse(
		readFileSync(new URL(`${name}-summary.json`, LOAD.runDir), "utf8"),
	) as Summary;
	const duration = summary.metrics.http_req_duration ?? {};
	const reqs = summary.metrics.http_reqs ?? {};
	const failed = summary.metrics.http_req_failed ?? {};
	const waitlisted = summary.metrics.registrations_waitlisted;
	const ms = (value: number | undefined) => `${Math.round(value ?? 0)} ms`;
	console.log(
		`${name}: ${reqs.count ?? 0} requests (${(reqs.rate ?? 0).toFixed(1)}/s), ` +
			`median ${ms(duration.med)}, p90 ${ms(duration["p(90)"])}, p95 ${ms(duration["p(95)"])}, ` +
			`max ${ms(duration.max)}, failed ${((failed.value ?? 0) * 100).toFixed(2)}%` +
			(waitlisted
				? `, waitlisted ${((waitlisted.value ?? 0) * 100).toFixed(0)}% of registrations`
				: ""),
	);
}

const stress = process.argv.includes("--stress");
const toPrometheus = await prometheusIsUp();
const run = await setupLoadRun({ stress });
console.log(
	`setup: spike ${run.spike.users.length} users → 1 event; steady ${run.steady.users.length} users → ${run.steady.eventIds.length} events` +
		(run.stress ? `; stress up to ${run.stress.users.length} users` : "") +
		(toPrometheus ? `; streaming to Prometheus ${prometheusUrl}` : ""),
);

const problems: string[] = [];
if (stress) {
	// Informational: how far the ramp got before latency or errors crossed the limits.
	const stressOk = k6("stress.js", toPrometheus);
	report("stress");
	if (run.stress) problems.push(...(await verifySteady(run.stress)));
	console.log(
		stressOk
			? "stress: every step stayed within the limits"
			: "stress: stopped at the step where limits were crossed (see the report)",
	);
} else {
	const spikeOk = k6("spike.js", toPrometheus);
	report("spike");
	problems.push(...(await verifySpike(run)));
	// Every spike registration queued an e-mail; people expect it within a minute.
	const emails = await drainEmails(60);
	console.log(
		`spike: all ${run.spike.users.length} confirmation e-mails sent ${emails.seconds.toFixed(0)} s after the rush`,
	);
	problems.push(...emails.problems);
	const steadyOk = k6("steady.js", toPrometheus);
	report("steady");
	problems.push(...(await verifySteady(run.steady)));
	if (!spikeOk) problems.push("spike: k6 thresholds failed");
	if (!steadyOk) problems.push("steady: k6 thresholds failed");
}
await closeDb();

console.log(`Reports: ${fileURLToPath(LOAD.runDir)}*-report.html`);
if (problems.length > 0) {
	console.error(`\nLoad test FAILED:\n- ${problems.join("\n- ")}`);
	process.exit(1);
}
console.log("\nLoad test passed: thresholds met and database invariants hold.");
