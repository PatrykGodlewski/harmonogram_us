import { db } from '@repo/db/client';
import { events } from '@repo/db/schema/events';
import { publicQueryFn } from '../procedures';

export const getEvents = publicQueryFn.handler(async () => {
	try {
		return await db.select().from(events);
	} catch {
		return [];
	}
});
