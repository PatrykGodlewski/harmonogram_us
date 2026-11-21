import type { UniversitySignIn } from "@repo/api/auth/university";
import { env } from "@repo/env/client";
import {
	auth_button_password_login,
	auth_error_try_again,
	auth_field_email,
	auth_field_password,
	auth_login_link_failed,
	auth_magic_link_sent,
	auth_status_success_title,
	auth_submit_magic_link,
	auth_submit_sending_magic_link,
	auth_title_login,
	auth_toggle_hide_password_login,
	auth_toggle_show_password_login,
	auth_validator_email_invalid,
	auth_validator_email_password_required,
	error_title,
} from "@repo/i18n/paraglide/messages";
import { getLocale, localizeHref } from "@repo/i18n/paraglide/runtime";
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
import { Captcha } from "./auth/captcha";
import { formatFieldError, usePasswordLogin } from "./auth/password-login";
import {
	SignInFailed,
	UniversitySignInButton,
} from "./auth/university-sign-in";

const authClient = createAuthClient({
	plugins: [magicLinkClient()],
});

type LoginStatus = {
	isRequestError: boolean;
	requestErrorMessage?: string;
	serverError?: { message?: string } | null;
	isLoading?: boolean;
};

function resolveLoginErrorMessage(status: LoginStatus): string | null {
	if (status.isRequestError) return status.requestErrorMessage ?? error_title();
	if (status.serverError?.message) return status.serverError.message;
	return null;
}

export interface LoginProps {
	redirectTo: string;
	university: UniversitySignIn;
	/** A sign-in came back with an error (university refusal, expired link). */
	failed?: boolean;
}

const loginFormSchema = z.object({
	email: z.email(auth_validator_email_invalid()),
	password: z.string(),
});

export function Login({ redirectTo, university, failed }: LoginProps) {
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
			<h1 className="mb-4 text-xl font-semibold">{auth_title_login()}</h1>
			{failed ? (
				<div className="mb-4">
					<SignInFailed />
				</div>
			) : null}
			{university ? (
				<div className="mb-4">
					<UniversitySignInButton
						university={university}
						redirectTo={redirectTo}
					/>
				</div>
			) : null}
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

				{captchaSiteKey ? (
					<Captcha siteKey={captchaSiteKey} onToken={setCaptchaToken} />
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

function useLogin(redirectTo: string, captchaToken: string | null) {
	const passwordMutation = usePasswordLogin(redirectTo, captchaToken);

	const magicLinkMutation = useMutation({
		mutationFn: async (email: string) => {
			const { error } = await authClient.signIn.magicLink({
				email,
				callbackURL: redirectTo,
				newUserCallbackURL: redirectTo,
				errorCallbackURL: localizeHref("/login"),
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
			if (error) throw new Error(error.message ?? auth_login_link_failed());
		},
		onSuccess: () => {
			toast.success(auth_status_success_title(), {
				description: auth_magic_link_sent(),
			});
		},
	});

	return {
		onMagicLogin: (data: { email: string }) => {
			passwordMutation.reset();
			magicLinkMutation.reset();
			magicLinkMutation.mutate(data.email);
		},
		onPasswordLogin: (data: { email: string; password: string }) => {
			magicLinkMutation.reset();
			passwordMutation.reset();
			passwordMutation.mutate(data);
		},
		status: {
			isRequestError: magicLinkMutation.isError || passwordMutation.isError,
			requestErrorMessage:
				magicLinkMutation.error?.message ?? passwordMutation.error?.message,
			serverError: null,
			isLoading: magicLinkMutation.isPending || passwordMutation.isPending,
		},
	};
}
