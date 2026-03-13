/// <reference types="node" />
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	dialect: 'postgresql',
	schema: './src/schema/*.ts',
	out: './src/migrations',
	dbCredentials: {
		url:
			process.env.DATABASE_URL ??
			'postgresql://postgres:postgres@localhost:5432/harmonogram_us',
	},
});
