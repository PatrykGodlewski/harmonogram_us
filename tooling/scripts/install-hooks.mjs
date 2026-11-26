// Installs the git hooks from lefthook.yml. Runs from `pnpm install` (prepare).
// Hook scripts go to the common .git/hooks, shared by all worktrees of a clone.
import { execFileSync } from "node:child_process";

const LEGACY_HOOKS_PATH = ".git-hooks";

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
	git(["rev-parse", "--is-inside-work-tree"]);
} catch {
	process.exit(0);
}

const current = readHooksPath();
if (current && current !== LEGACY_HOOKS_PATH) {
	console.log(
		`git hooks: lefthook hooks not installed, custom core.hooksPath is set (${current})`,
	);
	process.exit(0);
}
if (current) git(["config", "--local", "--unset", "core.hooksPath"]);

try {
	execFileSync("pnpm", ["exec", "lefthook", "install"], { stdio: "inherit" });
} catch {
	process.exit(1);
}
