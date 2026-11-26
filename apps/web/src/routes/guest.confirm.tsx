import {
	guest_confirm_body,
	guest_confirm_button,
	guest_confirm_title,
	guest_error_generic,
	title_guest_confirm,
} from "@repo/i18n/paraglide/messages";
import { localizeHref } from "@repo/i18n/paraglide/runtime";
import { studentsPageHead } from "@repo/router-utils/metadata/page-head";
import { appErrorMessage } from "@repo/ui/app-errors";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/guest/confirm")({
	validateSearch: z.object({ token: z.string().max(200).catch("") }),
	head: () => ({
		meta: [
			...studentsPageHead(title_guest_confirm()).meta,
			{ name: "referrer", content: "no-referrer" },
		],
	}),
	component: GuestConfirmPage,
});

/**
 * The link from a guest's e-mail (F17). Confirming needs the button: mail scanners open
 * links, and a plain visit must not register anyone or sign anyone in.
 */
function GuestConfirmPage() {
	const { token } = Route.useSearch();
	const confirm = useMutation({
		mutationFn: async () => {
			const response = await fetch("/api/auth/guest-registration/confirm", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ token }),
			});
			const body = await response.json().catch(() => ({}));
			if (!response.ok) throw body;
			return body as { redirectTo: string };
		},
		// A full load: the new session must reach the server-rendered page.
		onSuccess: ({ redirectTo }) =>
			window.location.assign(localizeHref(redirectTo)),
	});

	return (
		<main className="mx-auto flex max-w-md flex-col gap-4 p-4 sm:p-8">
			<h1 className="text-2xl font-semibold">{guest_confirm_title()}</h1>
			<p className="text-muted-foreground">{guest_confirm_body()}</p>
			{confirm.isError ? (
				<Alert variant="destructive">
					<AlertDescription>
						{appErrorMessage(confirm.error, guest_error_generic)}
					</AlertDescription>
				</Alert>
			) : null}
			<Button
				onClick={() => confirm.mutate()}
				disabled={!token || confirm.isPending || confirm.isSuccess}
			>
				{guest_confirm_button()}
			</Button>
		</main>
	);
}
