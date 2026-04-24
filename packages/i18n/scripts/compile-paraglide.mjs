import { compile } from "@inlang/paraglide-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { paraglideUrlPatterns } from "../paraglide-url-patterns.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, "..");

await compile({
	project: path.join(pkgRoot, "project.inlang"),
	outdir: path.join(pkgRoot, "src/paraglide"),
	strategy: ["url", "baseLocale"],
	urlPatterns: paraglideUrlPatterns,
});

/**
 * Vite’s SSR dev runner resolves `./runtime.js` from the *app* entry, not
 * `paraglide/server.js`, so the generated relative import fails. Use a package
 * `imports` subpath (see `package.json#imports` → `#paraglide-runtime`) instead.
 */
const serverFile = path.join(pkgRoot, "src/paraglide/server.js");
let serverSrc = fs.readFileSync(serverFile, "utf8");
if (serverSrc.includes('from "./runtime.js"')) {
	serverSrc = serverSrc.replace(
		'import * as runtime from "./runtime.js";',
		'import * as runtime from "#paraglide-runtime";',
	);
	fs.writeFileSync(serverFile, serverSrc);
}
