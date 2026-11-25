#!/usr/bin/env node
// Generates docs/status.json: per-feature (F<N>) status from the product spec,
// plans and e2e files. `--check` compares against the committed file instead.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SPEC = "docs/superpowers/specs/2026-11-19-produkt-design.md";
const PLANS_DIR = "docs/superpowers/plans";
const E2E_DIR = "e2e/tests";
const OUT = "docs/status.json";
// Derived from git history: differs between the generating commit and the
// commit that lands the file, and in CI's shallow clone. Informational only.
const HISTORY_FIELDS = new Set(["revision", "lastTouched"]);

function git(args) {
	try {
		return execFileSync("git", args, {
			cwd: ROOT,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
	} catch {
		return null;
	}
}

const inRepo = git(["rev-parse", "--git-dir"]) !== null;

// Tracked (or staged) files only, so untracked work never leaks into the
// committed status; off-repo falls back to the filesystem.
function listFiles(dir) {
	if (inRepo) {
		const out = git(["ls-files", "--cached", "--", dir]);
		return out ? out.split("\n").filter((p) => dirname(p) === dir) : [];
	}
	const abs = join(ROOT, dir);
	if (!existsSync(abs)) return [];
	return readdirSync(abs).map((name) => relative(ROOT, join(abs, name)));
}

function read(path) {
	return readFileSync(join(ROOT, path), "utf8");
}

function feature(features, n) {
	const key = `F${n}`;
	features[key] ??= {
		status: null,
		spec: null,
		plans: [],
		openTasks: 0,
		totalTasks: 0,
		e2e: [],
		lastTouched: null,
	};
	return features[key];
}

function collectFeatures() {
	const features = {};

	for (const line of read(SPEC).split("\n")) {
		const match = line.match(/^\|\s*F(\d+)\s*\|/);
		if (!match) continue;
		const cells = line.split("|").slice(1, -1);
		const entry = feature(features, Number(match[1]));
		entry.status = cells.at(-1).trim();
		entry.spec = SPEC;
	}

	for (const path of listFiles(PLANS_DIR).filter((p) => p.endsWith(".md"))) {
		const text = read(path);
		const match = text.split("\n", 1)[0].match(/^# .*\(F(\d+)\)/);
		if (!match) continue;
		const entry = feature(features, Number(match[1]));
		entry.plans.push(path);
		entry.openTasks += (text.match(/^- \[ \]/gm) ?? []).length;
		entry.totalTasks += (text.match(/^- \[[ x]\]/gm) ?? []).length;
	}

	for (const path of listFiles(E2E_DIR)) {
		const match = path.match(/\/f(\d+)-[^/]*\.spec\.ts$/);
		if (match) feature(features, Number(match[1])).e2e.push(path);
	}

	for (const entry of Object.values(features)) {
		entry.plans.sort();
		entry.e2e.sort();
		const files = [...entry.plans, ...entry.e2e];
		if (inRepo && files.length > 0) {
			entry.lastTouched =
				git(["log", "-1", "--format=%h", "--", ...files]) || null;
		}
	}

	return features;
}

// Alphabetical, except feature keys in numeric order (F2 before F10).
function byFeatureNumber(a, b) {
	return /^F\d+$/.test(a) && /^F\d+$/.test(b)
		? Number(a.slice(1)) - Number(b.slice(1))
		: a.localeCompare(b);
}

function sortKeys(value) {
	if (Array.isArray(value)) return value.map(sortKeys);
	if (value === null || typeof value !== "object") return value;
	return Object.fromEntries(
		Object.keys(value)
			.sort(byFeatureNumber)
			.map((key) => [key, sortKeys(value[key])]),
	);
}

function serialize(status) {
	return `${JSON.stringify(sortKeys(status), null, 2)}\n`;
}

function withoutHistory(features) {
	return JSON.parse(JSON.stringify(features ?? {}), (key, value) =>
		HISTORY_FIELDS.has(key) ? undefined : value,
	);
}

// Per-feature diff: one block per changed feature, readable in CI logs.
function featureDiff(committed, regenerated) {
	const keys = new Set([
		...Object.keys(committed),
		...Object.keys(regenerated),
	]);
	const blocks = [];
	for (const key of [...keys].sort(byFeatureNumber)) {
		const before = committed[key] && JSON.stringify(sortKeys(committed[key]));
		const after =
			regenerated[key] && JSON.stringify(sortKeys(regenerated[key]));
		if (before === after) continue;
		blocks.push(`${key}:\n- ${before ?? "(absent)"}\n+ ${after ?? "(absent)"}`);
	}
	return blocks.join("\n");
}

function check(status) {
	const path = join(ROOT, OUT);
	if (!existsSync(path)) {
		console.error(`${OUT} is missing: run node scripts/generate-status.mjs`);
		return 1;
	}
	const committed = JSON.parse(readFileSync(path, "utf8"));
	console.log(
		`${OUT}: committed revision ${committed.revision}, HEAD ${status.revision}`,
	);
	const diff = featureDiff(
		withoutHistory(committed.features),
		withoutHistory(status.features),
	);
	if (diff === "") {
		console.log(`${OUT} is current (ignoring revision and lastTouched)`);
		return 0;
	}
	console.error(
		`${OUT} is stale (- committed, + regenerated; revision/lastTouched ignored):`,
	);
	console.error(diff);
	console.error("Fix: node scripts/generate-status.mjs, then commit the file.");
	return 1;
}

const status = {
	revision: inRepo ? git(["rev-parse", "--short", "HEAD"]) : null,
	features: collectFeatures(),
};

if (process.argv.includes("--check")) {
	process.exit(check(status));
}
writeFileSync(join(ROOT, OUT), serialize(status));
console.log(`wrote ${OUT} (${Object.keys(status.features).length} features)`);
