import { z } from "zod";

export const optionalIdSchema = z.preprocess((value) => {
	if (typeof value !== "string" || value.trim() === "") {
		return undefined;
	}
	return value.trim();
}, z.string().min(1).max(100).optional());

/** Form fields use "" for unset; trim and omit on submit before optionalIdSchema. */
export const formOptionalIdSchema = z.string().max(100);
