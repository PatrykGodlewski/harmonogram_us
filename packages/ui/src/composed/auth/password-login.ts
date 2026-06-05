import {
	auth_error_login_failed,
	auth_field_invalid_value,
	auth_success_logged_in_message,
	auth_success_logged_in_title,
} from "@repo/i18n/paraglide/messages";
import { useMutation } from "@tanstack/react-query";
import { createAuthClient } from "better-auth/client";
import { toast } from "sonner";
import { z } from "zod";

const authClient = createAuthClient();

const fieldErrorSchema = z.object({
	message: z.string(),
});

export function formatFieldError(error: unknown): string {
	if (typeof error === "string") return error;
	const parsed = fieldErrorSchema.safeParse(error);
	if (parsed.success) return parsed.data.message;
	return auth_field_invalid_value();
}

const authClientErrorSchema = z.object({
	message: z.string().nullable().optional(),
	code: z.string().nullable().optional(),
	status: z.number().nullable().optional(),
});

type AuthClientErrorShape = {
	message?: string | null;
	code?: string | null;
	status?: number | null;
};

function parseAuthClientError(error: unknown): AuthClientErrorShape {
	const parsed = authClientErrorSchema.safeParse(error);
	return parsed.success ? parsed.data : {};
}

function resolvePasswordLoginErrorMessage(error: AuthClientErrorShape): string {
	if (error.code === "INVALID_EMAIL_OR_PASSWORD" || error.status === 401) {
		return auth_error_login_failed();
	}
	if (error.message && error.message.trim().length > 0) {
		return error.message;
	}
	return auth_error_login_failed();
}

export type PasswordLoginData = { email: string; password: string };

type UsePasswordLoginOptions = {
	onSuccess?: () => void;
	showSuccessToast?: boolean;
};

export function usePasswordLogin(
	redirectTo: string,
	captchaToken: string | null,
	options?: UsePasswordLoginOptions,
) {
	const showSuccessToast = options?.showSuccessToast ?? true;

	return useMutation({
		mutationFn: async (data: PasswordLoginData) => {
			const { error } = await authClient.signIn.email({
				email: data.email,
				password: data.password,
				callbackURL: redirectTo,
				fetchOptions: captchaToken
					? {
							headers: {
								"x-captcha-response": captchaToken,
							},
						}
					: undefined,
			});
			if (error) {
				throw new Error(
					resolvePasswordLoginErrorMessage(parseAuthClientError(error)),
				);
			}
		},
		onSuccess: () => {
			if (showSuccessToast) {
				toast.success(auth_success_logged_in_title(), {
					description: auth_success_logged_in_message(),
				});
			}
			options?.onSuccess?.();
		},
	});
}
