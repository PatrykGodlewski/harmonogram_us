import { z } from 'zod';

export const authCredentialsSchema = z.object({
	email: z.email('Invalid email address'),
	password: z.coerce.string().min(8, 'Password must be at least 8 characters').max(255),
});

const credentialsLike = z.union([z.object({ data: authCredentialsSchema }), authCredentialsSchema]);

export const signupInputSchema = credentialsLike.transform(
	(val): { data: z.infer<typeof authCredentialsSchema> } =>
		'data' in val && val.data != null ? val : { data: val },
);

export const loginInputSchema = signupInputSchema;

export type AuthCredentials = z.infer<typeof authCredentialsSchema>;
