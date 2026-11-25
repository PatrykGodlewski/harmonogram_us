import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import { paraglideRouteStrategies } from "../../packages/i18n/paraglide-route-strategies.js";
import { paraglideUrlPatterns } from "../../packages/i18n/paraglide-url-patterns.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const i18nRoot = path.resolve(__dirname, "../../packages/i18n");
const workspaceRoot = path.resolve(__dirname, "../..");
/** @opentelemetry/api as the Prometheus client (in @repo/api) resolves it, but its ESM build. */
const requireFromApi = createRequire(
	path.join(workspaceRoot, "packages/api/package.json"),
);
const openTelemetryApiEsm = createRequire(
	requireFromApi.resolve("@prometheus-io/client"),
)
	.resolve("@opentelemetry/api")
	.replace(/index\.cjs$/, "index.mjs");

export default defineConfig({
	envDir: workspaceRoot,
	resolve: {
		tsconfigPaths: true,
		alias: {
			"~": path.join(__dirname, "src"),
			"#paraglide-runtime": path.join(i18nRoot, "src/paraglide/runtime.js"),
			/** Radix dialogs use react-remove-scroll → tslib; its CJS interop breaks in the production SSR bundle. */
			tslib: require.resolve("tslib/tslib.es6.mjs"),
			/** Its CJS build (required by the Prometheus client) breaks in the SSR bundle the same way. */
			"@opentelemetry/api": openTelemetryApiEsm,
		},
	},
	plugins: [
		devtools(),
		paraglideVitePlugin({
			project: path.join(i18nRoot, "project.inlang"),
			outdir: path.join(i18nRoot, "src/paraglide"),
			strategy: ["url", "baseLocale"],
			urlPatterns: paraglideUrlPatterns,
			routeStrategies: paraglideRouteStrategies,
			// web and admin dev servers compile into the same outdir at the same time: cleaning it
			// races (one deletes while the other writes) and leaves the messages empty.
			cleanOutdir: false,
		}),
		// Entries are found by name in src/: server.ts (Paraglide-wrapped handler) and start.ts (global middleware).
		tanstackStart(),
		viteReact(),
		babel({ presets: [reactCompilerPreset()] }),
		tailwindcss(),
		nitro({ rollupConfig: { external: [/^@sentry\//] } }),
	],
	server: {
		port: 3001,
		strictPort: true,
		fs: {
			allow: [workspaceRoot],
		},
	},
});
