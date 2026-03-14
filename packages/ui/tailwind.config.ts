import type { Config } from 'tailwindcss';

/**
 * Tailwind v4 uses CSS-first config. Theme (@theme) and content (@source) live in
 * the consuming app's app.css. This file exists for tooling (IDE, etc.) that may
 * need content paths.
 */
export default {
	content: ['./src/**/*.{ts,tsx}'],
} satisfies Config;
