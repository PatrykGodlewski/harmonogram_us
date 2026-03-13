/// <reference types="node" />
import { drizzle } from 'drizzle-orm/postgres-js';
import { events } from './schema/events';
import { users } from './schema/users';

const connectionString =
	process.env.DATABASE_URL ??
	'postgresql://postgres:postgres@localhost:5432/harmonogram_us';

export const db = drizzle(connectionString, { schema: { events, users } });
