import { z } from "zod";

const emailSchema = z.email();

/**
 * Addresses typed or pasted into one field (one per line, or separated by
 * commas, semicolons or spaces): lower-cased, without repeats, and what is
 * not an address.
 */
export function parseEmailList(input: string): {
	valid: string[];
	invalid: string[];
} {
	const parts = input
		.split(/[\s,;]+/)
		.map((part) => part.trim().toLowerCase())
		.filter(Boolean);
	const unique = [...new Set(parts)];
	return {
		valid: unique.filter((part) => emailSchema.safeParse(part).success),
		invalid: unique.filter((part) => !emailSchema.safeParse(part).success),
	};
}
