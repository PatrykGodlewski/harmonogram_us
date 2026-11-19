// Must run first: points the database at the e2e stack, not the dev database.
import "../stack-env";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { userInfo } from "node:os";
import { fileURLToPath } from "node:url";
import { closeDb } from "@repo/db/client";
import { LOAD } from "./config";
import { setupLoadRun } from "./setup";
import { verifySpike, verifySteady } from "./verify";

const loadDir = fileURLToPath(new URL(".", import.meta.url));

/** Runs one k6 scenario in Docker against the e2e stack; true when its thresholds pass. */
function k6(script: string): boolean {
	const name = script.replace(".js", "");
	const { uid, gid } = userInfo();
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
				LOAD.k6Image,
				"run",
				"--quiet",
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

const run = await setupLoadRun();
console.log(
	`setup: spike ${run.spike.users.length} users → 1 event; steady ${run.steady.users.length} users → ${run.steady.eventIds.length} events`,
);

const problems: string[] = [];
const spikeOk = k6("spike.js");
report("spike");
problems.push(...(await verifySpike(run)));
const steadyOk = k6("steady.js");
report("steady");
problems.push(...(await verifySteady(run)));
await closeDb();

if (!spikeOk) problems.push("spike: k6 thresholds failed");
if (!steadyOk) problems.push("steady: k6 thresholds failed");
if (problems.length > 0) {
	console.error(`\nLoad test FAILED:\n- ${problems.join("\n- ")}`);
	process.exit(1);
}
console.log("\nLoad test passed: thresholds met and database invariants hold.");
