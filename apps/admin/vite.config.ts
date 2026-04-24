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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const i18nRoot = path.resolve(__dirname, "../../packages/i18n");

export default defineConfig({
	resolve: { tsconfigPaths: true },
	plugins: [
		devtools(),
		paraglideVitePlugin({
			project: path.join(i18nRoot, "project.inlang"),
			outdir: path.join(i18nRoot, "src/paraglide"),
			strategy: ["url", "baseLocale"],
		}),
		nitro({ rollupConfig: { external: [/^@sentry\//] } }),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
		babel({ presets: [reactCompilerPreset()] }),
	],
	server: {
		port: 3001,
		strictPort: true,
	},
});
