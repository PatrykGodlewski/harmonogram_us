import { withdrawByLinkServer } from "@repo/api/registrations/withdraw-by-link";
import {
	title_withdraw,
	withdraw_body,
	withdraw_button,
	withdraw_done,
	withdraw_error_generic,
	withdraw_title,
} from "@repo/i18n/paraglide/messages";
import { studentsPageHead } from "@repo/router-utils/metadata/page-head";
import { appErrorMessage } from "@repo/ui/app-errors";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/registrations/$registrationId/withdraw")(
	{
		validateSearch: z.object({ token: z.string().max(200).catch("") }),
		head: () => ({
			meta: [
				...studentsPageHead(title_withdraw()).meta,
				{ name: "referrer", content: "no-referrer" },
			],
		}),
		component: WithdrawPage,
	},
);

/**
 * The withdraw link from a registration e-mail (F17). Withdrawing needs the button:
 * mail scanners open links, and a plain visit must not cancel anyone's place.
 */
function WithdrawPage() {
	const { registrationId } = Route.useParams();
	const { token } = Route.useSearch();
	const withdraw = useMutation({
		mutationFn: () => withdrawByLinkServer({ data: { registrationId, token } }),
	});

	return (
		<main className="mx-auto flex max-w-md flex-col gap-4 p-4 sm:p-8">
			<h1 className="text-2xl font-semibold">{withdraw_title()}</h1>
			{withdraw.isSuccess ? (
				<Alert role="status">
					<AlertDescription>{withdraw_done()}</AlertDescription>
				</Alert>
			) : (
				<>
					<p className="text-muted-foreground">{withdraw_body()}</p>
					{withdraw.isError ? (
						<Alert variant="destructive">
							<AlertDescription>
								{appErrorMessage(withdraw.error, withdraw_error_generic)}
							</AlertDescription>
						</Alert>
					) : null}
					<Button
						variant="destructive"
						onClick={() => withdraw.mutate()}
						disabled={withdraw.isPending}
					>
						{withdraw_button()}
					</Button>
				</>
			)}
		</main>
	);
}
