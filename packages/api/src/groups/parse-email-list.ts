import { z } from "zod";

const emailSchema = z.email();

/** Parses a pasted list (commas, semicolons, spaces or newlines) into unique lowercased emails. */
export function parseEmailList(text: string): {
	valid: string[];
	invalid: string[];
} {
	const valid = new Set<string>();
	const invalid = new Set<string>();
	for (const raw of text.split(/[\s,;]+/)) {
		const entry = raw.trim().toLowerCase();
		if (!entry) {
			continue;
		}
		if (emailSchema.safeParse(entry).success) {
			valid.add(entry);
		} else {
			invalid.add(raw.trim());
		}
	}
	return { valid: [...valid], invalid: [...invalid] };
}
