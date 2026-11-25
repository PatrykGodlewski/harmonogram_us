// Points git at the committed .git-hooks/ directory. Runs from `pnpm install`
// (prepare). Never overwrites an existing core.hooksPath.
import { execFileSync } from "node:child_process";

function git(args) {
	return execFileSync("git", args, {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "ignore"],
	}).trim();
}

function readHooksPath() {
	try {
		return git(["config", "--local", "core.hooksPath"]);
	} catch {
		return "";
	}
}

try {
	git(["rev-parse", "--git-dir"]);
} catch {
	process.exit(0);
}

const current = readHooksPath();
if (current) {
	console.log(
		`git hooks: core.hooksPath already set to ${current}, left as is`,
	);
} else {
	git(["config", "--local", "core.hooksPath", ".git-hooks"]);
	console.log("git hooks: core.hooksPath set to .git-hooks");
}
