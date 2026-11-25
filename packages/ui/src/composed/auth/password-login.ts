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
import { useHumanCheck } from "./human-check";

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

/** Headers carrying the human-check token (Better Auth's captcha plugin reads them). */
export function captchaHeaders(token: string | undefined) {
	return token ? { headers: { "x-captcha-response": token } } : undefined;
}

/** Keeps the code next to the shown message, so a rejected human check can be retried. */
export function authClientError(error: unknown, message: string): Error {
	return Object.assign(new Error(message), {
		code: parseAuthClientError(error).code ?? undefined,
	});
}

export function usePasswordLogin(
	redirectTo: string,
	options?: UsePasswordLoginOptions,
) {
	const showSuccessToast = options?.showSuccessToast ?? true;
	const humanCheck = useHumanCheck();

	return useMutation({
		mutationFn: (data: PasswordLoginData) =>
			humanCheck(async (token) => {
				const { error } = await authClient.signIn.email({
					email: data.email,
					password: data.password,
					callbackURL: redirectTo,
					fetchOptions: captchaHeaders(token),
				});
				if (error) {
					throw authClientError(
						error,
						resolvePasswordLoginErrorMessage(parseAuthClientError(error)),
					);
				}
			}),
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
