import { createCollection, localOnlyCollectionOptions } from "@tanstack/db";
import { z } from "zod";

/** Example local-only TanStack DB collection (offline-first client state). */
const NoteSchema = z.object({
	id: z.number(),
	text: z.string(),
	updatedAt: z.number(),
});

export type LocalNote = z.infer<typeof NoteSchema>;

export const localNotesCollection = createCollection(
	localOnlyCollectionOptions({
		getKey: (note) => note.id,
		schema: NoteSchema,
	}),
);
