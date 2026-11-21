import {
	type ImportedEvent,
	replaceIndicoEvents,
} from "@repo/db/queries/indico-events";
import { env } from "@repo/env";
import { fetchIndicoEvents, type IndicoConfig } from "./fetch";

export type IndicoSyncResult =
	| { status: "off" }
	| { status: "synced"; count: number }
	| { status: "failed"; error: string };

/** The configured Indico, or null when the import is off (address or categories missing). */
export function indicoConfig(): IndicoConfig | null {
	if (!env.INDICO_URL || !env.INDICO_CATEGORY_IDS) {
		return null;
	}
	return {
		baseUrl: env.INDICO_URL,
		categoryIds: env.INDICO_CATEGORY_IDS.split(","),
		token: env.INDICO_API_TOKEN,
	};
}

/** Copies Indico's events into the mirror; a failed read keeps the previous copy. */
export async function syncIndicoEvents(
	config: IndicoConfig | null,
	deps: {
		fetchEvents?: (config: IndicoConfig) => Promise<ImportedEvent[]>;
		replace?: (events: ImportedEvent[]) => Promise<void>;
	} = {},
): Promise<IndicoSyncResult> {
	if (!config) {
		return { status: "off" };
	}
	const { fetchEvents = fetchIndicoEvents, replace = replaceIndicoEvents } =
		deps;
	let events: ImportedEvent[];
	try {
		events = await fetchEvents(config);
	} catch (error) {
		return {
			status: "failed",
			error: error instanceof Error ? error.message : String(error),
		};
	}
	await replace(events);
	return { status: "synced", count: events.length };
}
