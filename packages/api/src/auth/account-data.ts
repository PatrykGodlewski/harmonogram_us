import {
	deleteAccount,
	exportAccountData,
} from "@repo/db/queries/account-data";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { appError } from "../errors";
import { registrationEmailHooks } from "../notifications/registration-hooks";
import { protectedActionFn } from "../procedures";
import { getCurrentUser } from "./user";

/** The signed-in person's data as JSON (GDPR export). */
export const exportMyDataServer = createServerFn({ method: "GET" }).handler(
	async () => {
		const user = await getCurrentUser();
		if (!user) {
			throw appError("UNAUTHORIZED");
		}
		return exportAccountData(user.id);
	},
);

const deleteMyAccountSchema = z.object({
	/** The person types their e-mail to confirm; a slip of the finger can't delete an account. */
	confirmEmail: z.string().trim().max(320),
});

export const deleteMyAccountServer = protectedActionFn
	.inputValidator((input: unknown) => deleteMyAccountSchema.parse(input))
	.handler(async ({ data, context }) => {
		if (data.confirmEmail.toLowerCase() !== context.user.email.toLowerCase()) {
			throw appError("FORBIDDEN");
		}
		await deleteAccount(context.user.id, registrationEmailHooks);
		return { ok: true };
	});
