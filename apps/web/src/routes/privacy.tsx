import { privacyInfoQueryOptions } from "@repo/api/events/privacy";
import {
	privacy_back,
	privacy_retention,
	privacy_rights,
	privacy_title,
	privacy_what,
	privacy_who,
} from "@repo/i18n/paraglide/messages";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
	loader: ({ context: { queryClient } }) =>
		queryClient.ensureQueryData(privacyInfoQueryOptions),
	component: PrivacyPage,
});

function PrivacyPage() {
	const { data } = useSuspenseQuery(privacyInfoQueryOptions);
	return (
		<article className="mx-auto flex w-full max-w-prose flex-col gap-4 p-4 sm:p-8">
			<Link to="/" className="text-sm text-muted-foreground hover:underline">
				← {privacy_back()}
			</Link>
			<h1 className="text-2xl font-semibold tracking-tight">
				{privacy_title()}
			</h1>
			<p>{privacy_who()}</p>
			<p>{privacy_what()}</p>
			<p>{privacy_retention({ days: data.retentionDays })}</p>
			<p>{privacy_rights()}</p>
		</article>
	);
}
