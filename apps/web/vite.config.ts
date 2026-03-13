import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tsConfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
	// Cast needed: TanStack Start resolves Vite 8 types while app uses Vite 7
	plugins: [
		tsConfigPaths(),
		tanstackStart(),
		viteReact(),
		tailwindcss(),
	] as any,
	server: {
		port: 3000,
		strictPort: true,
	},
});
