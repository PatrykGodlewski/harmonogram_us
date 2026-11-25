// Environment doctor: `pnpm run doctor` (see docs/development.md). Read-only checks, Node stdlib only.
// Prints one line per check (✓ pass, ✗ fail, ⚠ warn, – skip); exits 1 iff any check fails.
// Never prints .env values: only key names are read and compared.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readlinkSync } from "node:fs";
import { connect } from "node:net";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEV = "harmonogram_us";
const E2E = "harmonogram-e2e";
const HEALTHCHECKED = ["db", "documents", "storage", "mailpit"];
const PORTS = [
	[5432, DEV],
	[3000, DEV],
	[3001, DEV],
	[15432, E2E],
];
const SYMBOLS = { pass: "✓", fail: "✗", warn: "⚠", skip: "–" };
const results = [];

function report(status, name, detail, hint) {
	results.push(status);
	const tail = hint && status !== "pass" ? ` → ${hint}` : "";
	console.log(`${SYMBOLS[status]} ${name}: ${detail}${tail}`);
}

function run(command, args) {
	try {
		const env = { ...process.env, COMPOSE_FILE: "docker-compose.yml" };
		return execFileSync(command, args, {
			cwd: root,
			env,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
	} catch {
		return null;
	}
}

function versionAtLeast(actual, minimum) {
	const a = actual.split(".").map(Number);
	const m = minimum.split(".").map(Number);
	for (let i = 0; i < 3; i++) {
		if ((a[i] ?? 0) !== (m[i] ?? 0)) return (a[i] ?? 0) > (m[i] ?? 0);
	}
	return true;
}

function envKeys(file) {
	const keys = new Set();
	for (const line of readFileSync(file, "utf8").split("\n")) {
		const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=/.exec(line);
		if (match) keys.add(match[1]);
	}
	return keys;
}

function services(project) {
	const output = run("docker", [
		"compose",
		"-p",
		project,
		"ps",
		"--format",
		"json",
	]);
	if (!output) return [];
	return output.split("\n").map((line) => JSON.parse(line));
}

function httpStatus(port) {
	return fetch(`http://localhost:${port}/`, {
		redirect: "manual",
		signal: AbortSignal.timeout(5000),
	})
		.then((response) => response.status)
		.catch(() => null);
}

function portInUse(port) {
	const attempt = (host) =>
		new Promise((resolve) => {
			const socket = connect({ port, host, timeout: 1000 });
			const done = (inUse) => {
				socket.destroy();
				resolve(inUse);
			};
			socket.once("connect", () => done(true));
			socket.once("error", () => done(false));
			socket.once("timeout", () => done(false));
		});
	return Promise.all([attempt("127.0.0.1"), attempt("::1")]).then((hits) =>
		hits.some(Boolean),
	);
}

// Linux only (ss + /proc): the listening process and its working directory, if readable.
function portOwner(port) {
	const line = run("ss", ["-ltnpH", `sport = :${port}`]);
	const match = line && /\("([^"]+)",pid=(\d+)/.exec(line);
	if (!match) return null;
	let cwd = null;
	try {
		cwd = readlinkSync(`/proc/${match[2]}/cwd`);
	} catch {}
	return { name: match[1], pid: match[2], cwd };
}

function checkVersions() {
	const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
	const minNode = pkg.engines.node.replace(/^>=\s*/, "");
	const node = process.versions.node;
	versionAtLeast(node, minNode)
		? report("pass", "node", `${node} (needs ≥ ${minNode})`)
		: report(
				"fail",
				"node",
				`${node} (needs ≥ ${minNode})`,
				`install Node ${minNode} or newer`,
			);

	const wanted = pkg.packageManager.replace(/^pnpm@/, "");
	const pnpm = run("pnpm", ["--version"]);
	if (!pnpm)
		return report(
			"fail",
			"pnpm",
			"not found",
			`corepack enable && corepack prepare pnpm@${wanted}`,
		);
	pnpm.split(".")[0] === wanted.split(".")[0]
		? report("pass", "pnpm", `${pnpm} (packageManager ${wanted})`)
		: report(
				"fail",
				"pnpm",
				`${pnpm} (packageManager ${wanted})`,
				`use pnpm ${wanted.split(".")[0]}.x (corepack enable)`,
			);
}

function checkDocker() {
	if (!run("docker", ["--version"])) {
		report(
			"fail",
			"docker",
			"CLI not found",
			"install Docker with the compose plugin",
		);
		return false;
	}
	const server = run("docker", ["version", "--format", "{{.Server.Version}}"]);
	if (!server) {
		report(
			"fail",
			"docker",
			"daemon not reachable",
			"start the Docker daemon (systemctl start docker)",
		);
		return false;
	}
	report("pass", "docker", `daemon ${server}`);
	return true;
}

function checkEnv() {
	if (!existsSync(join(root, ".env")))
		return report("fail", ".env", "missing", "cp .env.example .env");
	const present = envKeys(join(root, ".env"));
	const missing = [...envKeys(join(root, ".env.example"))].filter(
		(key) => !present.has(key),
	);
	missing.length === 0
		? report("pass", ".env", "every key from .env.example is present")
		: report(
				"fail",
				".env",
				`missing keys: ${missing.join(", ")}`,
				"copy them from .env.example",
			);
}

function checkHealth(label, list, names) {
	for (const name of names) {
		const service = list.find((s) => s.Service === name);
		const state = service
			? `${service.State}${service.Health ? ` (${service.Health})` : ""}`
			: "not running";
		service?.State === "running" && service.Health === "healthy"
			? report("pass", `${label} ${name}`, state)
			: report(
					"fail",
					`${label} ${name}`,
					state,
					`docker compose -p ${label === "dev" ? DEV : E2E} logs ${name}`,
				);
	}
}

async function checkHttp(label, port, hint) {
	const status = await httpStatus(port);
	status && status < 500
		? report("pass", `${label} :${port}`, `HTTP ${status}`)
		: report(
				"fail",
				`${label} :${port}`,
				status ? `HTTP ${status}` : "no response",
				hint,
			);
}

async function checkDevStack(running) {
	if (!running.has(DEV))
		return report(
			"skip",
			"dev stack",
			`project ${DEV} not running`,
			"docker compose up -d",
		);
	const list = services(DEV);
	checkHealth("dev", list, HEALTHCHECKED);
	const appUp = list.some(
		(s) => ["web", "admin"].includes(s.Service) && s.State === "running",
	);
	if (!appUp)
		return report(
			"skip",
			"dev app",
			"profile app not running (pnpm dev serves 3000/3001)",
			"docker compose --profile app up -d --build",
		);
	for (const port of [3000, 3001])
		await checkHttp(
			"dev",
			port,
			`check the pnpm dev output or docker compose -p ${DEV} logs web admin`,
		);
}

async function checkE2eStack(running) {
	if (!running.has(E2E))
		return report(
			"skip",
			"e2e stack",
			`project ${E2E} not running`,
			"scripts/e2e.sh ensure",
		);
	for (const port of [3100, 3101])
		await checkHttp("e2e", port, "scripts/e2e.sh logs");
	const list = services(E2E);
	checkHealth("e2e", list, ["db"]);
	// Credentials come from the container's own POSTGRES_* environment (set in docker-compose.yml).
	const psql = (sql) =>
		run("docker", [
			"compose",
			"-p",
			E2E,
			"exec",
			"-T",
			"db",
			"sh",
			"-c",
			`psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "${sql}"`,
		]);
	const journal = psql(
		"SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL",
	);
	if (journal === "t") {
		report(
			"pass",
			"e2e journal",
			`drizzle.__drizzle_migrations has ${psql("SELECT count(*) FROM drizzle.__drizzle_migrations")} rows`,
		);
	} else if (journal === "f") {
		report(
			"warn",
			"e2e journal",
			"seeded without the drizzle journal",
			"scripts/e2e.sh ensure will reset it (or pnpm e2e:down for a clean stack)",
		);
	} else {
		report("fail", "e2e journal", "query failed", "scripts/e2e.sh logs db");
	}
}

async function checkPorts(running) {
	const published = new Map();
	for (const project of running) {
		const ports = services(project).flatMap((s) =>
			(s.Publishers ?? []).map((p) => p.PublishedPort),
		);
		published.set(project, new Set(ports));
	}
	for (const [port, project] of PORTS) {
		if (!(await portInUse(port))) {
			report("pass", `port ${port}`, "free");
		} else if (published.get(project)?.has(port)) {
			report("pass", `port ${port}`, `published by ${project}`);
		} else {
			const owner = portOwner(port);
			if (
				owner?.cwd &&
				(owner.cwd === root || owner.cwd.startsWith(root + sep))
			) {
				report(
					"pass",
					`port ${port}`,
					`${owner.name} from this repo (pnpm dev)`,
				);
			} else {
				const who = owner
					? `${owner.name} (pid ${owner.pid})`
					: "a process outside the compose project";
				report(
					"fail",
					`port ${port}`,
					`held by ${who}, not ${project}`,
					`stop it (ss -ltnp 'sport = :${port}')`,
				);
			}
		}
	}
}

checkVersions();
const dockerOk = checkDocker();
checkEnv();
if (dockerOk) {
	const projects = JSON.parse(
		run("docker", ["compose", "ls", "--format", "json"]) ?? "[]",
	);
	const running = new Set(
		projects.filter((p) => p.Status.startsWith("running")).map((p) => p.Name),
	);
	await checkDevStack(running);
	await checkE2eStack(running);
	await checkPorts(running);
} else {
	report("skip", "stacks and ports", "docker unavailable", "fix docker first");
}

const count = (status) => results.filter((s) => s === status).length;
console.log(
	`\n${count("pass")} passed, ${count("fail")} failed, ${count("warn")} warnings, ${count("skip")} skipped`,
);
process.exitCode = count("fail") > 0 ? 1 : 0;
