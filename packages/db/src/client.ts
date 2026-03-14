/// <reference types="node" />
import { env } from '@repo/env';
import { drizzle } from 'drizzle-orm/postgres-js';
import { events } from './schema/events';
import { users } from './schema/users';

export const db = drizzle(env.DATABASE_URL, { schema: { events, users } });
