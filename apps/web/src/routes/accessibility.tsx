import { privacyInfoQueryOptions } from "@repo/api/events/privacy";
import {
	a11y_complaint,
	a11y_contact,
	a11y_contact_generic,
	a11y_intro,
	a11y_known,
	a11y_prepared,
	a11y_status,
	a11y_title,
	privacy_back,
} from "@repo/i18n/paraglide/messages";
import { studentsPageHead } from "@repo/router-utils/metadata/page-head";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/accessibility")({
	loader: ({ context: { queryClient } }) =>
		queryClient.ensureQueryData(privacyInfoQueryOptions),
	head: () => studentsPageHead(a11y_title()),
	component: AccessibilityPage,
});

/** The accessibility statement the law requires (F8), in both languages. */
function AccessibilityPage() {
	const { data } = useSuspenseQuery(privacyInfoQueryOptions);
	return (
		<article className="mx-auto flex w-full max-w-prose flex-col gap-4 p-4 sm:p-8">
			<Link to="/" className="text-sm text-muted-foreground hover:underline">
				← {privacy_back()}
			</Link>
			<h1 className="text-2xl font-semibold tracking-tight">{a11y_title()}</h1>
			<p>{a11y_intro()}</p>
			<p>{a11y_status()}</p>
			<p>{a11y_known()}</p>
			<p>
				{data.contactEmail
					? a11y_contact({ email: data.contactEmail })
					: a11y_contact_generic()}
			</p>
			<p>{a11y_complaint()}</p>
			<p className="text-sm text-muted-foreground">{a11y_prepared()}</p>
		</article>
	);
}
