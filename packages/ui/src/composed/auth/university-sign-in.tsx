import type { UniversitySignIn } from "@repo/api/auth/university";
import { UNIVERSITY_PROVIDER_ID } from "@repo/api/auth/university-provider";
import {
	auth_or_email,
	auth_sign_in_failed_body,
	auth_sign_in_failed_title,
	auth_university_button,
	auth_university_button_generic,
} from "@repo/i18n/paraglide/messages";
import { localizeHref } from "@repo/i18n/paraglide/runtime";
import { useMutation } from "@tanstack/react-query";
import { createAuthClient } from "better-auth/client";
import { Alert, AlertDescription, AlertTitle } from "../../components/alert";
import { Button } from "../../components/button";

const authClient = createAuthClient();

/** The university's button above the e-mail form; nothing when it is not configured. */
export function UniversitySignInButton({
	university,
	redirectTo,
}: {
	university: NonNullable<UniversitySignIn>;
	redirectTo: string;
}) {
	const signIn = useMutation({
		mutationFn: async () => {
			const { error } = await authClient.signIn.social({
				provider: UNIVERSITY_PROVIDER_ID,
				callbackURL: redirectTo,
				newUserCallbackURL: redirectTo,
				errorCallbackURL: localizeHref("/login"),
			});
			if (error) throw new Error(error.message);
		},
	});
	const failed = signIn.isError;

	return (
		<div className="flex flex-col gap-3">
			<Button
				type="button"
				variant="outline"
				// A long university name wraps instead of widening the page.
				className="h-auto min-h-9 w-full whitespace-normal py-2"
				disabled={signIn.isPending || signIn.isSuccess}
				onClick={() => signIn.mutate()}
			>
				{university.name
					? auth_university_button({ name: university.name })
					: auth_university_button_generic()}
			</Button>
			{failed ? <SignInFailed /> : null}
			<p className="flex items-center gap-3 text-sm text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
				{auth_or_email()}
			</p>
		</div>
	);
}

/** A sign-in that came back with an error (university refusal, expired link). */
export function SignInFailed() {
	return (
		<Alert variant="destructive">
			<AlertTitle>{auth_sign_in_failed_title()}</AlertTitle>
			<AlertDescription>{auth_sign_in_failed_body()}</AlertDescription>
		</Alert>
	);
}
