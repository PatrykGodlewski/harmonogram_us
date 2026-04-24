import { useState } from "react";
import { z } from "zod";
import { Auth, useAuthStatus } from "./auth";

const signupFormSchema = z.object({
	email: z.string().email("Please provide a valid email address"),
	password: z.string().min(1, "Password is required"),
	confirmPassword: z.string().min(1, "Confirm password is required"),
});

export interface SignupProps {
	onSignup: (data: {
		email: string;
		password: string;
		confirmPassword: string;
	}) => void;
	status: {
		isRequestError: boolean;
		requestErrorMessage?: string;
		serverError?: { message?: string } | null;
		success?: boolean;
		isLoading?: boolean;
	};
}

export function Signup({ onSignup, status }: SignupProps) {
	const [clientError, setClientError] = useState<string | null>(null);
	const { error } = useAuthStatus({
		clientError,
		isRequestError: status.isRequestError,
		requestErrorMessage: status.requestErrorMessage,
		serverError: status.serverError,
	});

	return (
		<Auth.Root
			title="Sign up"
			isLoading={status.isLoading}
			onSubmit={(e) => {
				e.preventDefault();
				const form = e.target as HTMLFormElement;
				const formData = new FormData(form);
				const parsed = signupFormSchema.safeParse({
					email: formData.get("email"),
					password: formData.get("password"),
					confirmPassword: formData.get("confirmPassword"),
				});
				if (!parsed.success) {
					setClientError(
						parsed.error.issues[0]?.message ?? "Invalid form data",
					);
					return;
				}

				const { email, password, confirmPassword } = parsed.data;

				if (password !== confirmPassword) {
					setClientError("Passwords do not match");
					return;
				}
				setClientError(null);
				onSignup({ email, password, confirmPassword });
			}}
		>
			<Auth.Field name="email" label="Email" type="email" required />
			<Auth.Field name="password" label="Password" type="password" required />
			<Auth.Field
				name="confirmPassword"
				label="Confirm password"
				type="password"
				required
			/>
			<Auth.Submit label="Sign up" loadingLabel="Signing up..." />
			<Auth.Status
				error={error}
				success={status.success}
				successTitle="Account created"
				successMessage="Account created! Redirecting..."
			/>
		</Auth.Root>
	);
}
