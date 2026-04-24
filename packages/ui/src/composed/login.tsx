import { useState } from "react";
import { z } from "zod";
import { Auth, useAuthStatus } from "./auth";

const loginFormSchema = z.object({
	email: z.string().email("Please provide a valid email address"),
	password: z.string().min(1, "Password is required"),
});

export interface LoginProps {
	onLogin: (data: { email: string; password: string }) => void;
	status: {
		isRequestError: boolean;
		requestErrorMessage?: string;
		serverError?: { message?: string } | null;
		success?: boolean;
		isLoading?: boolean;
	};
}

export function Login({ onLogin, status }: LoginProps) {
	const [clientError, setClientError] = useState<string | null>(null);
	const { error } = useAuthStatus({
		clientError,
		isRequestError: status.isRequestError,
		requestErrorMessage: status.requestErrorMessage,
		serverError: status.serverError,
	});

	return (
		<Auth.Root
			title="Log in"
			isLoading={status.isLoading}
			onSubmit={(e) => {
				e.preventDefault();
				const form = e.target as HTMLFormElement;
				const formData = new FormData(form);
				const parsed = loginFormSchema.safeParse({
					email: formData.get("email"),
					password: formData.get("password"),
				});
				if (!parsed.success) {
					setClientError(
						parsed.error.issues[0]?.message ?? "Invalid form data",
					);
					return;
				}
				setClientError(null);
				onLogin({
					email: parsed.data.email,
					password: parsed.data.password,
				});
			}}
		>
			<Auth.Field name="email" label="Email" type="email" required />
			<Auth.Field name="password" label="Password" type="password" required />
			<Auth.Submit label="Log in" loadingLabel="Logging in..." />
			<Auth.Status
				error={error}
				success={status.success}
				successTitle="Logged in"
				successMessage="Logged in! Redirecting..."
			/>
		</Auth.Root>
	);
}
