import { Turnstile } from "@marsidev/react-turnstile";
import { env } from "@repo/env/client";
import {
	auth_error_try_again,
	auth_feedback_admin_login,
	auth_field_email,
	auth_field_password,
	auth_submit_logging_in,
	auth_submit_login,
	auth_title_admin_login,
	auth_validator_email_invalid,
	auth_validator_password_required,
	error_title,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { Alert, AlertDescription, AlertTitle } from "../components/alert";
import { Button } from "../components/button";
import { FormMessage } from "../components/form-message";
import { Input } from "../components/input";
import { Label } from "../components/label";
import { formatFieldError, usePasswordLogin } from "./auth/password-login";

export interface AdminLoginProps {
	redirectTo: string;
}

export function AdminLogin({ redirectTo }: AdminLoginProps) {
	const router = useRouter();
	const [captchaToken, setCaptchaToken] = useState<string | null>(null);
	const captchaSiteKey = env.VITE_TURNSTILE_SITE_KEY;
	const captchaEnabled = Boolean(captchaSiteKey);
	const isCaptchaMissing = captchaEnabled && !captchaToken;
	const locale = getLocale();

	const adminLoginSchema = useMemo(() => {
		void locale;
		return z.object({
			email: z.string().email(auth_validator_email_invalid()),
			password: z.string().min(1, auth_validator_password_required()),
		});
	}, [locale]);

	const passwordLogin = usePasswordLogin(redirectTo, captchaToken, {
		onSuccess: () => {
			void router.navigate({ to: redirectTo });
		},
	});

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		validators: {
			onSubmit: adminLoginSchema,
		},
		onSubmit: ({ value }) => {
			passwordLogin.reset();
			passwordLogin.mutate({
				email: value.email,
				password: value.password,
			});
		},
	});

	const isBusy = passwordLogin.isPending;
	const errorMessage = passwordLogin.isError
		? (passwordLogin.error?.message ?? auth_error_try_again())
		: null;

	return (
		<div className="mx-auto max-w-sm rounded-lg border p-6">
			<h2 className="mb-4 text-xl font-semibold">{auth_title_admin_login()}</h2>
			<form
				className="space-y-4"
				onSubmit={(e) => {
					e.preventDefault();
					void form.handleSubmit();
				}}
			>
				<p className="text-muted-foreground text-sm">
					{auth_feedback_admin_login()}
				</p>

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
					{(field) => (
						<div>
							<Label htmlFor={field.name}>{auth_field_password()}</Label>
							<Input
								id={field.name}
								name={field.name}
								type="password"
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

				{captchaEnabled ? (
					<div className="flex justify-center">
						<Turnstile
							siteKey={captchaSiteKey ?? ""}
							options={{ appearance: "always", size: "normal" }}
							onSuccess={setCaptchaToken}
							onExpire={() => setCaptchaToken(null)}
							onError={() => setCaptchaToken(null)}
						/>
					</div>
				) : null}

				<form.Subscribe selector={(s) => s.isSubmitting}>
					{(isSubmitting) => (
						<Button
							type="submit"
							className="w-full"
							disabled={isBusy || isSubmitting || isCaptchaMissing}
						>
							{isBusy || isSubmitting
								? auth_submit_logging_in()
								: auth_submit_login()}
						</Button>
					)}
				</form.Subscribe>

				{errorMessage ? (
					<Alert variant="destructive">
						<AlertTitle>{error_title()}</AlertTitle>
						<AlertDescription>{errorMessage}</AlertDescription>
					</Alert>
				) : null}
			</form>
		</div>
	);
}
