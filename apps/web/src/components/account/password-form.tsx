import { setPasswordForCurrentSession } from "@repo/api/auth/user";
import {
	account_password_current_label,
	account_password_error_invalid_current,
	account_password_error_required_current,
	account_password_new_label,
	account_password_submit_change,
	account_password_submit_set,
	account_password_success_change,
	account_password_success_set,
	account_password_title,
	auth_field_confirm_password,
	auth_validator_confirm_password_required,
	auth_validator_password_required,
	auth_validator_password_too_short,
	auth_validator_passwords_no_match,
	error_title,
} from "@repo/i18n/paraglide/messages";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { FormMessage } from "@repo/ui/components/form-message";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import * as React from "react";
import { toast } from "sonner";
import { z } from "zod";
import { authClient } from "~/lib/auth-client";

const PASSWORD_MIN_LENGTH = 8;
const fieldErrorSchema = z.object({
	message: z.string(),
});
const setPasswordInputSchema = z.object({
	newPassword: z.string(),
});

function formatFieldError(error: unknown): string {
	if (typeof error === "string") return error;
	const parsed = fieldErrorSchema.safeParse(error);
	if (parsed.success) return parsed.data.message;
	return error_title();
}

const setPasswordWithSessionFn = createServerFn({ method: "POST" })
	.validator((input: unknown) => setPasswordInputSchema.parse(input))
	.handler(async ({ data }) => {
		const headers = getRequestHeaders();
		await setPasswordForCurrentSession(headers, data.newPassword);
	});

/** Sets a first password, or changes the current one (the current one is asked for). */
export function PasswordForm({
	initialHasPassword,
}: {
	initialHasPassword: boolean;
}) {
	const [hasPassword, setHasPassword] = React.useState(initialHasPassword);
	const updatePassword = usePasswordMutation(hasPassword);

	const form = useForm({
		defaultValues: {
			currentPassword: "",
			newPassword: "",
			confirmPassword: "",
		},
		validators: {
			onSubmit: z
				.object({
					currentPassword: hasPassword
						? z.string().min(1, account_password_error_required_current())
						: z.string(),
					newPassword: z
						.string()
						.min(1, auth_validator_password_required())
						.min(PASSWORD_MIN_LENGTH, auth_validator_password_too_short()),
					confirmPassword: z
						.string()
						.min(1, auth_validator_confirm_password_required()),
				})
				.refine((value) => value.newPassword === value.confirmPassword, {
					message: auth_validator_passwords_no_match(),
					path: ["confirmPassword"],
				}),
		},
		onSubmit: async ({ value }) => {
			const changingExistingPassword = hasPassword;
			await updatePassword.mutateAsync({
				currentPassword: value.currentPassword,
				newPassword: value.newPassword,
			});
			if (!hasPassword) {
				setHasPassword(true);
			}
			form.reset();
			toast.success(
				changingExistingPassword
					? account_password_success_change()
					: account_password_success_set(),
			);
		},
		onSubmitInvalid: () => {
			updatePassword.reset();
		},
	});
	const serverErrorMessage = updatePassword.error?.message ?? null;
	const currentPasswordServerError = serverErrorMessage?.includes(
		"Invalid password",
	)
		? account_password_error_invalid_current()
		: serverErrorMessage?.includes("currentPassword")
			? serverErrorMessage
			: null;
	const newPasswordServerError = serverErrorMessage?.includes("newPassword")
		? serverErrorMessage
		: null;
	const generalServerErrorMessage =
		serverErrorMessage && !currentPasswordServerError && !newPasswordServerError
			? serverErrorMessage
			: null;

	return (
		<section className="max-w-md">
			<h2 className="mb-4 text-xl">{account_password_title()}</h2>
			<form
				className="space-y-4"
				onSubmit={(event) => {
					event.preventDefault();
					void form.handleSubmit();
				}}
			>
				{hasPassword ? (
					<form.Field name="currentPassword">
						{(field) => (
							<div>
								<Label htmlFor={field.name}>
									{account_password_current_label()}
								</Label>
								<Input
									id={field.name}
									name={field.name}
									type="password"
									className="mt-1"
									disabled={updatePassword.isPending}
									value={String(field.state.value ?? "")}
									onBlur={field.handleBlur}
									onChange={(e) => {
										updatePassword.reset();
										field.handleChange(e.target.value);
									}}
								/>
								{field.state.meta.errors.length > 0 ? (
									<FormMessage>
										{formatFieldError(field.state.meta.errors[0])}
									</FormMessage>
								) : currentPasswordServerError ? (
									<FormMessage>{currentPasswordServerError}</FormMessage>
								) : null}
							</div>
						)}
					</form.Field>
				) : null}
				<form.Field name="newPassword">
					{(field) => (
						<div>
							<Label htmlFor={field.name}>{account_password_new_label()}</Label>
							<Input
								id={field.name}
								name={field.name}
								type="password"
								className="mt-1"
								disabled={updatePassword.isPending}
								value={String(field.state.value ?? "")}
								onBlur={field.handleBlur}
								onChange={(e) => {
									updatePassword.reset();
									field.handleChange(e.target.value);
								}}
							/>
							{field.state.meta.errors.length > 0 ? (
								<FormMessage>
									{formatFieldError(field.state.meta.errors[0])}
								</FormMessage>
							) : newPasswordServerError ? (
								<FormMessage>{newPasswordServerError}</FormMessage>
							) : null}
						</div>
					)}
				</form.Field>
				<form.Field name="confirmPassword">
					{(field) => (
						<div>
							<Label htmlFor={field.name}>
								{auth_field_confirm_password()}
							</Label>
							<Input
								id={field.name}
								name={field.name}
								type="password"
								className="mt-1"
								disabled={updatePassword.isPending}
								value={String(field.state.value ?? "")}
								onBlur={field.handleBlur}
								onChange={(e) => {
									updatePassword.reset();
									field.handleChange(e.target.value);
								}}
							/>
							{field.state.meta.errors.length > 0 ? (
								<FormMessage>
									{formatFieldError(field.state.meta.errors[0])}
								</FormMessage>
							) : null}
						</div>
					)}
				</form.Field>
				<Button type="submit" disabled={updatePassword.isPending}>
					{hasPassword
						? account_password_submit_change()
						: account_password_submit_set()}
				</Button>
				{generalServerErrorMessage ? (
					<Alert variant="destructive">
						<AlertTitle>{error_title()}</AlertTitle>
						<AlertDescription>{generalServerErrorMessage}</AlertDescription>
					</Alert>
				) : null}
			</form>
		</section>
	);
}

type PasswordPayload = {
	currentPassword?: string;
	newPassword: string;
};

function usePasswordMutation(hasPassword: boolean) {
	return useMutation({
		mutationFn: async (payload: PasswordPayload) => {
			if (!hasPassword) {
				try {
					await setPasswordWithSessionFn({
						data: { newPassword: payload.newPassword },
					});
				} catch (error) {
					throw new Error(
						error instanceof Error && error.message
							? error.message
							: error_title(),
					);
				}
				return;
			}

			const result = await authClient.changePassword({
				newPassword: payload.newPassword,
				currentPassword: payload.currentPassword ?? "",
			});

			if (result.error) {
				throw new Error(result.error.message ?? error_title());
			}
		},
	});
}
