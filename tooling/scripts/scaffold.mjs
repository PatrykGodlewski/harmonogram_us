#!/usr/bin/env node
// pnpm scaffold <slug> [F<n>]: spec stub, plan stub, red-by-design [F<n>] e2e
// file and i18n placeholders for a new feature. Validates everything before
// writing, so a conflict leaves the tree untouched.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PRODUCT_SPEC = "docs/superpowers/specs/2026-11-19-produkt-design.md";
const SPECS_DIR = "docs/superpowers/specs";
const PLANS_DIR = "docs/superpowers/plans";
const E2E_DIR = "tooling/e2e/tests";
const MESSAGES = {
	"packages/i18n/messages/pl.json": "TODO: tekst po polsku",
	"packages/i18n/messages/en.json": "TODO: English text",
};
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function fail(message) {
	console.error(`scaffold: ${message}`);
	process.exit(1);
}

function read(path) {
	return readFileSync(join(ROOT, path), "utf8");
}

function list(dir) {
	return readdirSync(join(ROOT, dir));
}

// Feature numbers in use, from the filesystem (untracked work included, so a
// parallel session's new feature is never handed out twice).
function usedFeatureNumbers() {
	const used = new Set();
	for (const name of list(E2E_DIR)) {
		const match = name.match(/^f(\d+)-.*\.spec\.ts$/);
		if (match) used.add(Number(match[1]));
	}
	for (const line of read(PRODUCT_SPEC).split("\n")) {
		const match = line.match(/^\|\s*F(\d+)\s*\|/);
		if (match) used.add(Number(match[1]));
	}
	for (const name of list(PLANS_DIR).filter((n) => n.endsWith(".md"))) {
		const first = read(join(PLANS_DIR, name)).split("\n", 1)[0];
		const match = first.match(/^# .*\(F(\d+)\)/);
		if (match) used.add(Number(match[1]));
	}
	return used;
}

function localDate() {
	const now = new Date();
	const pad = (n) => String(n).padStart(2, "0");
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function specStub(slug, date) {
	return `# ${slug} — design

Date: ${date}. Status: draft.

## Intent and why

## Acceptance

- Gotowe, gdy test e2e pokazuje, że…

## Out of scope

## Decisions
`;
}

function planStub(slug, n, specPath, e2ePath) {
	return `# ${slug} (F${n}) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline; repo workflow: one ledger, inline execution, final fresh-context review). Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** TODO

**Architecture:** TODO

**Tech Stack:** TODO

**Spec:** \`${specPath}\`

## Global Constraints

- The feature requires a passing Playwright test named \`[F${n}] …\` (\`${e2ePath}\`), written first with observed failure.
- UI text goes into both \`packages/i18n/messages/{pl,en}.json\`, then \`pnpm messages:compile\`; replace the \`scaffold_f${n}_placeholder\` keys.
- Conventional Commits, concise imperative description; path-scoped \`git add\` only.

## Review Focus

1. TODO

---

### Task 1: TODO user-visible deliverable

Requirements: F${n} — TODO acceptance criteria from the spec.
Acceptance: TODO observable success, rejection/boundary cases and invariants.
Files/interfaces: TODO
Tests: \`${e2ePath}\` (\`[F${n}] …\`, projects TODO) plus required lower-level tests.
Verification: TODO exact commands and expected outcomes.

- [ ] Write the acceptance/regression test and observe the expected failure.
- [ ] Implement the smallest complete solution.
- [ ] Run checks, review/simplify, rerun affected checks.
- [ ] Verify the deliverable and update plan/spec evidence.
`;
}

// Red by design (docs/testing.md: observe the failure first). Playwright has no
// expect.unreachable; the custom expect message carries the reason instead.
function e2eStub(n) {
	return `import { expect, test } from "@playwright/test";

test("[F${n}] TODO: acceptance test @uczestnik", () => {
	expect(false, "implement the [F${n}] acceptance test").toBe(true);
});
`;
}

// Appends the key as the last entry by text, so the rest of the file stays
// byte-identical (no reformatting of existing messages).
function withMessage(text, key, value) {
	const end = text.lastIndexOf("}");
	const body = text.slice(0, end).trimEnd();
	return `${body},\n\t${JSON.stringify(key)}: ${JSON.stringify(value)}\n}\n`;
}

const [slug, featureArg, ...extra] = process.argv.slice(2);
if (!slug || extra.length > 0) fail("usage: pnpm scaffold <slug> [F<n>]");
if (!SLUG.test(slug)) fail(`slug "${slug}" must match ${SLUG}`);
if (featureArg !== undefined && !/^F[1-9]\d*$/.test(featureArg)) {
	fail(`feature number "${featureArg}" must look like F37`);
}

const used = usedFeatureNumbers();
const n = featureArg ? Number(featureArg.slice(1)) : Math.max(0, ...used) + 1;
const key = `scaffold_f${n}_placeholder`;
const date = localDate();
const specPath = `${SPECS_DIR}/${date}-${slug}-design.md`;
const planPath = `${PLANS_DIR}/${date}-${slug}.md`;
const e2ePath = `${E2E_DIR}/f${n}-${slug}.spec.ts`;

const conflicts = [];
if (used.has(n)) conflicts.push(`F${n} is already taken`);
for (const path of [specPath, planPath, e2ePath]) {
	if (existsSync(join(ROOT, path))) conflicts.push(`${path} already exists`);
}
for (const path of Object.keys(MESSAGES)) {
	if (Object.hasOwn(JSON.parse(read(path)), key)) {
		conflicts.push(`${path} already has "${key}"`);
	}
}
if (conflicts.length > 0) fail(`nothing written:\n  ${conflicts.join("\n  ")}`);

writeFileSync(join(ROOT, specPath), specStub(slug, date));
writeFileSync(join(ROOT, planPath), planStub(slug, n, specPath, e2ePath));
writeFileSync(join(ROOT, e2ePath), e2eStub(n));
for (const [path, value] of Object.entries(MESSAGES)) {
	writeFileSync(join(ROOT, path), withMessage(read(path), key, value));
}
execFileSync("pnpm", ["messages:compile"], { cwd: ROOT, stdio: "inherit" });

console.log(`
Scaffolded F${n}:
  ${specPath}
  ${planPath}
  ${e2ePath}
  ${key} in ${Object.keys(MESSAGES).join(", ")}

Next steps:
  1. Write and get approval for the spec (${specPath}).
  2. Fill the plan (${planPath}); replace the placeholder i18n keys.
  3. Implement test-first: ${e2ePath} fails by design until the real [F${n}] test replaces it.
  If the feature belongs in the consolidated product spec, add its F${n} row to ${PRODUCT_SPEC}.`);
