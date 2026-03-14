import { db } from '@repo/db/client';
import { events } from '@repo/db/schema/events';
import { publicQueryFn } from '../procedures';

export const getEvents = publicQueryFn.handler(async () => db.select().from(events));
