import { z } from "zod";

export const loginInputSchema = z.object({
	email: z.email("Invalid email address"),
	password: z
		.string()
		.min(8, "Password must be at least 8 characters")
		.max(255),
});

export const signupInputSchema = z
	.object({
		email: z.email("Invalid email address"),
		password: z
			.string()
			.min(8, "Password must be at least 8 characters")
			.max(255),
		confirmPassword: z
			.string()
			.min(8, "Password must be at least 8 characters")
			.max(255),
	})
	.refine(({ password, confirmPassword }) => password === confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	});

export type LoginInput = z.infer<typeof loginInputSchema>;
export type SignupInput = z.infer<typeof signupInputSchema>;
