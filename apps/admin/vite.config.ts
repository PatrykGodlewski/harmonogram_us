import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tsConfigPaths from 'vite-tsconfig-paths';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	// Load .env from monorepo root so server functions have access
	envDir: resolve(__dirname, '../..'),
	// biome-ignore lint/suspicious/noExplicitAny: TanStack Start resolves Vite 8 types while app uses Vite 7
	plugins: [tsConfigPaths(), tanstackStart(), viteReact(), tailwindcss()] as any,
	server: {
		port: 3001,
		strictPort: true,
	},
});
