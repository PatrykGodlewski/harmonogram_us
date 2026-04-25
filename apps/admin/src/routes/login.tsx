import { getCurrentUser } from "@repo/api/auth/user";
import {
	auth_error_login_failed,
	auth_error_try_again,
	auth_feedback_admin_login,
	auth_field_email,
	auth_field_invalid_value,
	auth_field_password,
	auth_submit_logging_in,
	auth_submit_login,
	auth_title_admin_login,
	auth_validator_email_invalid,
	auth_validator_password_required,
	error_title,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { z } from "zod";
import { authClient } from "../lib/auth-client";

const getCurrentUserFn = createServerFn({ method: "GET" }).handler(async () => {
	return getCurrentUser();
});

export const Route = createFileRoute("/login")({
	validateSearch: (search: Record<string, unknown>) => ({
		redirect: typeof search.redirect === "string" ? search.redirect : undefined,
	}),
	beforeLoad: async () => {
		const user = await getCurrentUserFn();
		if (user) {
			throw redirect({ to: "/" });
		}
	},
	component: AdminLoginPage,
});

function formatFieldError(error: unknown): string {
	if (typeof error === "string") return error;
	if (
		error &&
		typeof error === "object" &&
		"message" in error &&
		typeof (error as { message: unknown }).message === "string"
	) {
		return (error as { message: string }).message;
	}
	return auth_field_invalid_value();
}

function AdminLoginPage() {
	const router = useRouter();
	const { redirect } = Route.useSearch();
	const redirectTo = redirect?.startsWith("/") ? redirect : "/";
	const [clientError, setClientError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const locale = getLocale();

	const adminLoginSchema = useMemo(() => {
		void locale;
		return z.object({
			email: z.string().email(auth_validator_email_invalid()),
			password: z.string().min(1, auth_validator_password_required()),
		});
	}, [locale]);

	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		validators: {
			onSubmit: adminLoginSchema,
		},
		onSubmit: async ({ value }) => {
			setClientError(null);
			setIsLoading(true);
			try {
				const { error: authError } = await authClient.signIn.email({
					email: value.email,
					password: value.password,
					callbackURL: redirectTo,
				});
				if (authError) {
					setClientError(authError.message ?? auth_error_login_failed());
					return;
				}
				router.navigate({ to: redirectTo });
			} finally {
				setIsLoading(false);
			}
		},
	});

	const mergedError = useMemo(() => {
		void locale;
		if (clientError) return { message: clientError } as const;
		return null;
	}, [clientError, locale]);

	return (
		<div className="flex min-h-[50vh] items-center justify-center p-8">
			<div className="mx-auto max-w-sm rounded-lg border p-6">
				<h2 className="mb-4 text-xl font-semibold">
					{auth_title_admin_login()}
				</h2>
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
									disabled={isLoading}
									value={String(field.state.value ?? "")}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
								{field.state.meta.errors.length > 0 ? (
									<p className="text-destructive mt-1 text-xs">
										{formatFieldError(field.state.meta.errors[0])}
									</p>
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
									containerClassName="mt-1"
									disabled={isLoading}
									value={String(field.state.value ?? "")}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
								{field.state.meta.errors.length > 0 ? (
									<p className="text-destructive mt-1 text-xs">
										{formatFieldError(field.state.meta.errors[0])}
									</p>
								) : null}
							</div>
						)}
					</form.Field>

					<form.Subscribe selector={(s) => s.isSubmitting}>
						{(isSubmitting) => (
							<Button
								type="submit"
								className="w-full"
								disabled={isLoading || isSubmitting}
							>
								{isLoading || isSubmitting
									? auth_submit_logging_in()
									: auth_submit_login()}
							</Button>
						)}
					</form.Subscribe>

					{mergedError ? (
						<Alert variant="destructive">
							<AlertTitle>{error_title()}</AlertTitle>
							<AlertDescription>
								{mergedError.message ?? auth_error_try_again()}
							</AlertDescription>
						</Alert>
					) : null}
				</form>
			</div>
		</div>
	);
}
