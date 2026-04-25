import { Turnstile } from "@marsidev/react-turnstile";
import { enabledSocialProviders } from "@repo/api/auth/social-providers";
import { env } from "@repo/env/client";
import {
	auth_button_password_login,
	auth_error_login_failed,
	auth_error_try_again,
	auth_field_email,
	auth_field_invalid_value,
	auth_field_password,
	auth_status_success_title,
	auth_submit_magic_link,
	auth_submit_sending_magic_link,
	auth_success_logged_in_message,
	auth_success_logged_in_title,
	auth_title_login,
	auth_toggle_hide_password_login,
	auth_toggle_show_password_login,
	auth_validator_email_invalid,
	auth_validator_email_password_required,
	error_title,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { createAuthClient } from "better-auth/client";
import { magicLinkClient } from "better-auth/client/plugins";
import * as React from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "../components/alert";
import { Button } from "../components/button";
import { FormMessage } from "../components/form-message";
import { Input } from "../components/input";
import { Label } from "../components/label";
import { type AuthSocialProvider, authSocialButtonLabel } from "./auth-social";

const fieldErrorSchema = z.object({
	message: z.string(),
});

const authClient = createAuthClient({
	plugins: [magicLinkClient()],
});

function formatFieldError(error: unknown): string {
	if (typeof error === "string") return error;
	const parsed = fieldErrorSchema.safeParse(error);
	if (parsed.success) return parsed.data.message;
	return auth_field_invalid_value();
}

type LoginStatus = {
	isRequestError: boolean;
	requestErrorMessage?: string;
	serverError?: { message?: string } | null;
	isLoading?: boolean;
};

type AuthClientErrorShape = {
	message?: string | null;
	code?: string | null;
	status?: number | null;
};

function resolvePasswordLoginErrorMessage(error: AuthClientErrorShape): string {
	if (error.code === "INVALID_EMAIL_OR_PASSWORD" || error.status === 401) {
		return auth_error_login_failed();
	}
	if (error.message && error.message.trim().length > 0) {
		return error.message;
	}
	return auth_error_login_failed();
}

function resolveLoginErrorMessage(status: LoginStatus): string | null {
	if (status.isRequestError) return status.requestErrorMessage ?? error_title();
	if (status.serverError?.message) return status.serverError.message;
	return null;
}

export interface LoginProps {
	redirectTo: string;
}

const loginFormSchema = z.object({
	email: z.email(auth_validator_email_invalid()),
	password: z.string(),
});

export function Login({ redirectTo }: LoginProps) {
	const [passwordPanelOpen, setPasswordPanelOpen] = React.useState(false);
	const [captchaToken, setCaptchaToken] = React.useState<string | null>(null);
	const captchaSiteKey = env.VITE_TURNSTILE_SITE_KEY;
	const captchaEnabled = Boolean(captchaSiteKey);
	const login = useLogin(redirectTo, captchaToken);

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		validators: {
			onSubmit: loginFormSchema,
		},
		onSubmit: ({ value }) => {
			if (passwordPanelOpen) {
				const password = value.password.trim();
				if (password.length === 0) {
					toast.error(error_title(), {
						description: auth_validator_email_password_required(),
					});
					return;
				}
				login.onPasswordLogin({
					email: value.email,
					password: value.password,
				});
				return;
			}
			login.onMagicLogin({ email: value.email });
		},
	});

	const errorMessage = resolveLoginErrorMessage(login.status);
	const isBusy = login.status.isLoading;
	const isCaptchaMissing = captchaEnabled && !captchaToken;

	const errorAlert = errorMessage
		? {
				variant: "destructive" as const,
				title: error_title(),
				description: errorMessage ?? auth_error_try_again(),
			}
		: null;

	return (
		<div className="mx-auto max-w-sm rounded-lg border p-6">
			<h2 className="mb-4 text-xl font-semibold">{auth_title_login()}</h2>
			<form
				className="space-y-4"
				onSubmit={(e) => {
					e.preventDefault();
					void form.handleSubmit();
				}}
			>
				<form.Field name="email">
					{(field) => (
						<div>
							<Label htmlFor={field.name}>{auth_field_email()}</Label>
							<Input
								id={field.name}
								name={field.name}
								type="email"
								required
								className="mt-1"
								disabled={isBusy}
								value={String(field.state.value ?? "")}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
							/>
							{field.state.meta.errors.length > 0 ? (
								<FormMessage>
									{formatFieldError(field.state.meta.errors[0])}
								</FormMessage>
							) : null}
						</div>
					)}
				</form.Field>

				<form.Field name="password">
					{(field) =>
						passwordPanelOpen ? (
							<div>
								<Label htmlFor={field.name}>{auth_field_password()}</Label>
								<Input
									id={field.name}
									name={field.name}
									type="password"
									containerClassName="mt-1"
									disabled={isBusy}
									value={String(field.state.value ?? "")}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
								{field.state.meta.errors.length > 0 ? (
									<FormMessage>
										{formatFieldError(field.state.meta.errors[0])}
									</FormMessage>
								) : null}
							</div>
						) : null
					}
				</form.Field>

				<form.Subscribe selector={(s) => s.isSubmitting}>
					{(isSubmitting) =>
						passwordPanelOpen ? (
							<Button
								type="submit"
								className="w-full"
								disabled={isBusy || isSubmitting || isCaptchaMissing}
							>
								{auth_button_password_login()}
							</Button>
						) : (
							<Button
								type="submit"
								className="w-full"
								disabled={isBusy || isSubmitting || isCaptchaMissing}
							>
								{isBusy || isSubmitting
									? auth_submit_sending_magic_link()
									: auth_submit_magic_link()}
							</Button>
						)
					}
				</form.Subscribe>

				{captchaEnabled ? (
					<div className="flex justify-center">
						<Turnstile
							siteKey={captchaSiteKey ?? ""}
							options={{ appearance: "always", size: "normal" }}
							onSuccess={(token) => setCaptchaToken(token)}
							onExpire={() => setCaptchaToken(null)}
							onError={() => setCaptchaToken(null)}
						/>
					</div>
				) : null}

				<Button
					type="button"
					variant="link"
					className="h-auto px-0 text-sm font-normal"
					onClick={() => setPasswordPanelOpen((open) => !open)}
				>
					{passwordPanelOpen
						? auth_toggle_hide_password_login()
						: auth_toggle_show_password_login()}
				</Button>

				{login.socialProviders.map((provider) => (
					<Button
						key={provider}
						type="button"
						variant="secondary"
						className="w-full"
						disabled={isBusy}
						onClick={() => login.onSocialLogin(provider)}
					>
						{authSocialButtonLabel[provider]()}
					</Button>
				))}

				{errorAlert ? (
					<Alert variant={errorAlert.variant}>
						<AlertTitle>{errorAlert.title}</AlertTitle>
						<AlertDescription>{errorAlert.description}</AlertDescription>
					</Alert>
				) : null}
			</form>
		</div>
	);
}

type PasswordLoginData = { email: string; password: string };

function useLogin(redirectTo: string, captchaToken: string | null) {
	const magicLinkMutation = useMutation({
		mutationFn: async (email: string) => {
			const { error } = await authClient.signIn.magicLink({
				email,
				callbackURL: redirectTo,
				newUserCallbackURL: redirectTo,
				errorCallbackURL: "/login",
				metadata: {
					locale: getLocale(),
				},
				fetchOptions: captchaToken
					? {
							headers: {
								"x-captcha-response": captchaToken,
							},
						}
					: undefined,
			});
			if (error) throw new Error(error.message ?? "Failed to send login link");
		},
		onSuccess: () => {
			toast.success(auth_status_success_title(), {
				description:
					"Email sent successfully. Check your inbox for the login link.",
			});
		},
	});

	const passwordMutation = useMutation({
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
					resolvePasswordLoginErrorMessage(error as AuthClientErrorShape),
				);
			}
		},
		onSuccess: () => {
			toast.success(auth_success_logged_in_title(), {
				description: auth_success_logged_in_message(),
			});
		},
	});

	const socialMutation = useMutation({
		mutationFn: async (provider: AuthSocialProvider) => {
			const { error } = await authClient.signIn.social({
				provider,
				callbackURL: redirectTo,
				errorCallbackURL: "/login",
				newUserCallbackURL: redirectTo,
			});
			if (error) throw new Error(error.message ?? "Social sign-in failed");
		},
	});

	return {
		socialProviders: enabledSocialProviders,
		onMagicLogin: (data: { email: string }) => {
			passwordMutation.reset();
			socialMutation.reset();
			magicLinkMutation.reset();
			magicLinkMutation.mutate(data.email);
		},
		onPasswordLogin: (data: PasswordLoginData) => {
			magicLinkMutation.reset();
			socialMutation.reset();
			passwordMutation.reset();
			passwordMutation.mutate(data);
		},
		onSocialLogin: (provider: AuthSocialProvider) => {
			magicLinkMutation.reset();
			passwordMutation.reset();
			socialMutation.reset();
			socialMutation.mutate(provider);
		},
		status: {
			isRequestError:
				magicLinkMutation.isError ||
				passwordMutation.isError ||
				socialMutation.isError,
			requestErrorMessage:
				magicLinkMutation.error?.message ??
				passwordMutation.error?.message ??
				socialMutation.error?.message,
			serverError: null,
			isLoading:
				magicLinkMutation.isPending ||
				passwordMutation.isPending ||
				socialMutation.isPending,
		},
	};
}
