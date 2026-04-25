import { Turnstile } from "@marsidev/react-turnstile";
import { enabledSocialProviders } from "@repo/api/auth/social-providers";
import { env } from "@repo/env/client";
import {
	auth_field_confirm_password,
	auth_field_email,
	auth_field_invalid_value,
	auth_field_password,
	auth_submit_signing_up,
	auth_submit_signup,
	auth_success_account_created_message,
	auth_success_account_created_title,
	auth_title_signup,
	auth_validator_confirm_password_required,
	auth_validator_email_invalid,
	auth_validator_password_required,
	auth_validator_password_too_short,
	auth_validator_passwords_no_match,
	error_title,
} from "@repo/i18n/paraglide/messages";
import { localizeHref } from "@repo/i18n/paraglide/runtime";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { createAuthClient } from "better-auth/client";
import * as React from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "../components/alert";
import { Button } from "../components/button";
import { FormMessage } from "../components/form-message";
import { Input } from "../components/input";
import { Label } from "../components/label";
import { type AuthSocialProvider, authSocialButtonLabel } from "./auth-social";

const authClient = createAuthClient();
const PASSWORD_MIN_LENGTH = 8;

const errorWithMessageSchema = z.object({ message: z.string().min(1) });

function getErrorMessage(error: unknown, fallback: string): string {
	if (typeof error === "string" && error.length > 0) return error;
	const parsedError = errorWithMessageSchema.safeParse(error);
	return parsedError.success ? parsedError.data.message : fallback;
}

function getFieldErrorMessage(error: unknown): string {
	return getErrorMessage(error, auth_field_invalid_value());
}

type SignupStatus = {
	isRequestError: boolean;
	requestErrorMessage?: string;
	serverError?: { message?: string } | null;
	isLoading?: boolean;
};

function resolveSignupErrorMessage(status: SignupStatus): string | null {
	if (status.isRequestError) {
		return status.requestErrorMessage ?? error_title();
	}
	if (status.serverError?.message) {
		return status.serverError.message;
	}
	return null;
}

const signupFormSchema = z
	.object({
		email: z.email(auth_validator_email_invalid()),
		password: z
			.string()
			.min(1, auth_validator_password_required())
			.min(PASSWORD_MIN_LENGTH, auth_validator_password_too_short()),
		confirmPassword: z
			.string()
			.min(1, auth_validator_confirm_password_required()),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: auth_validator_passwords_no_match(),
		path: ["confirmPassword"],
	});

const signupFields = [
	{ name: "email", label: auth_field_email, type: "email" },
	{ name: "password", label: auth_field_password, type: "password" },
	{
		name: "confirmPassword",
		label: auth_field_confirm_password,
		type: "password",
	},
] as const;

type SignupData = {
	email: string;
	password: string;
	confirmPassword: string;
};

export interface SignupProps {
	redirectTo?: string;
}

function getRequestErrorMessage(error: unknown, fallback: string): string {
	return getErrorMessage(error, fallback);
}

export function Signup({ redirectTo = "/account" }: SignupProps) {
	const [captchaToken, setCaptchaToken] = React.useState<string | null>(null);
	const captchaSiteKey = env.VITE_TURNSTILE_SITE_KEY;
	const captchaEnabled = Boolean(captchaSiteKey);
	const signup = useSignup(localizeHref(redirectTo), captchaToken);

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
			confirmPassword: "",
		},
		validators: {
			onSubmit: signupFormSchema,
		},
		onSubmit: async ({ value }) => {
			await signup.onSignup({
				email: value.email,
				password: value.password,
				confirmPassword: value.confirmPassword,
			});
		},
		onSubmitInvalid: () => {
			signup.clearFeedback();
		},
	});

	const errorMessage = resolveSignupErrorMessage(signup.status);
	const isBusy = signup.status.isLoading;
	const isCaptchaMissing = captchaEnabled && !captchaToken;
	const errorAlert = errorMessage
		? {
				variant: "destructive" as const,
				title: error_title(),
				description: errorMessage,
			}
		: null;

	return (
		<div className="mx-auto max-w-sm rounded-lg border p-6">
			<h2 className="mb-4 text-xl font-semibold">{auth_title_signup()}</h2>
			<form
				className="space-y-4"
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					void form.handleSubmit();
				}}
			>
				{signupFields.map((fieldConfig) => (
					<form.Field key={fieldConfig.name} name={fieldConfig.name}>
						{(field) => (
							<div>
								<Label htmlFor={field.name}>{fieldConfig.label()}</Label>
								{fieldConfig.type === "password" ? (
									<Input
										id={field.name}
										name={field.name}
										type="password"
										required
										containerClassName="mt-1"
										disabled={isBusy}
										value={String(field.state.value ?? "")}
										onBlur={field.handleBlur}
										onChange={(e) => {
											field.handleChange(e.target.value);
										}}
									/>
								) : (
									<Input
										id={field.name}
										name={field.name}
										type={fieldConfig.type}
										required
										className="mt-1"
										disabled={isBusy}
										value={String(field.state.value ?? "")}
										onBlur={field.handleBlur}
										onChange={(e) => {
											field.handleChange(e.target.value);
										}}
									/>
								)}
								{field.state.meta.errors.length > 0 ? (
									<FormMessage>
										{getFieldErrorMessage(field.state.meta.errors[0])}
									</FormMessage>
								) : null}
							</div>
						)}
					</form.Field>
				))}

				<form.Subscribe selector={(s) => s.isSubmitting}>
					{(isSubmitting) => {
						const isSubmittingSignup = isBusy || isSubmitting;
						return (
							<Button
								type="submit"
								className="w-full"
								disabled={isSubmittingSignup || isCaptchaMissing}
							>
								{isSubmittingSignup
									? auth_submit_signing_up()
									: auth_submit_signup()}
							</Button>
						);
					}}
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

				{signup.socialProviders.map((provider) => (
					<Button
						key={provider}
						type="button"
						variant="secondary"
						className="w-full"
						disabled={isBusy}
						onClick={() => signup.onSocialSignup(provider)}
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

function useSignup(redirectTo: string, captchaToken: string | null) {
	const router = useRouter();

	const signupMutation = useMutation({
		mutationFn: async (data: SignupData) => {
			try {
				const { error } = await authClient.signUp.email({
					email: data.email,
					password: data.password,
					name: data.email,
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
					throw new Error(getRequestErrorMessage(error, "Failed to sign up"));
				}
			} catch (error) {
				throw new Error(getRequestErrorMessage(error, "Failed to sign up"));
			}
		},
		onSuccess: async () => {
			toast.success(auth_success_account_created_title(), {
				description: auth_success_account_created_message(),
			});
			await router.invalidate();
			await router.navigate({ to: redirectTo });
		},
	});

	const socialSignupMutation = useMutation({
		mutationFn: async (provider: AuthSocialProvider) => {
			const { error } = await authClient.signIn.social({
				provider,
				callbackURL: redirectTo,
				newUserCallbackURL: redirectTo,
				errorCallbackURL: "/signup",
			});
			if (error) throw new Error(error.message ?? "Social sign-up failed");
		},
	});

	return {
		socialProviders: enabledSocialProviders,
		onSignup: (data: SignupData) => signupMutation.mutateAsync(data),
		onSocialSignup: (provider: AuthSocialProvider) =>
			socialSignupMutation.mutate(provider),
		clearFeedback: () => {
			signupMutation.reset();
			socialSignupMutation.reset();
		},
		status: {
			isRequestError: signupMutation.isError || socialSignupMutation.isError,
			requestErrorMessage:
				signupMutation.error?.message ?? socialSignupMutation.error?.message,
			serverError: null,
			isLoading: signupMutation.isPending || socialSignupMutation.isPending,
		},
	};
}
