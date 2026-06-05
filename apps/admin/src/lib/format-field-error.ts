import { auth_field_invalid_value } from "@repo/i18n/paraglide/messages";
import { z } from "zod";

const fieldErrorSchema = z.object({
	message: z.string(),
});

export function formatFieldError(error: unknown): string {
	if (typeof error === "string") return error;
	const parsed = fieldErrorSchema.safeParse(error);
	if (parsed.success) return parsed.data.message;
	return auth_field_invalid_value();
}
