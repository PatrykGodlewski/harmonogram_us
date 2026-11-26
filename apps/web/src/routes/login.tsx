import { universitySignInQueryOptions } from "@repo/api/auth/sign-in-options";
import { guestFormQueryOptions } from "@repo/api/events/guest-form";
import { auth_title_login } from "@repo/i18n/paraglide/messages";
import { localizeHref } from "@repo/i18n/paraglide/runtime";
import { studentsPageHead } from "@repo/router-utils/metadata/page-head";
import { Login } from "@repo/ui/composed/login";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { EventRegistrationChoice } from "~/components/auth/event-registration-choice";

/** Any fixed origin: a path is resolved against it to see where it leads. */
const SAME_SITE = "http://same.site";

/** Same-site paths only: browsers read "//host" and "/\host" as another site. */
function safePath(path: string | undefined): string | null {
	if (!path?.startsWith("/")) {
		return null;
	}
	try {
		// `new URL`, not `URL.parse`: Safari before 18 and Chrome before 126 lack the latter.
		const url = new URL(path, SAME_SITE);
		return url.origin === SAME_SITE
			? url.pathname + url.search + url.hash
			: null;
	} catch {
		return null;
	}
}

export const Route = createFileRoute("/login")({
	validateSearch: z.object({
		redirect: z.string().optional(),
		/** Set when a university sign-in or an e-mail link comes back failed. */
		error: z.string().optional(),
		/** Registering for this event: the page offers an account or an e-mail link (F17). */
		event: z.string().max(100).optional().catch(undefined),
		/** The invite-link secret of an invite-only event. */
		invite: z.string().max(128).optional().catch(undefined),
	}),
	beforeLoad: ({ context, search }) => {
		if (context.user) {
			throw redirect({
				href: localizeHref(safePath(search.redirect) ?? HOME_AFTER_SIGN_IN),
			});
		}
	},
	loaderDeps: ({ search }) => ({ event: search.event, invite: search.invite }),
	loader: ({ context: { queryClient }, deps }) =>
		Promise.all([
			queryClient.ensureQueryData(universitySignInQueryOptions),
			// An unknown or closed event just leaves the plain sign-in page.
			deps.event
				? queryClient
						.ensureQueryData(guestFormQueryOptions(deps.event, deps.invite))
						.catch(() => null)
				: null,
		]),
	head: () => studentsPageHead(auth_title_login()),
	component: LoginComp,
});

/** Without a destination, signing in leads to the person's own events. */
const HOME_AFTER_SIGN_IN = "/my-events";

function LoginComp() {
	const { redirect, error, event, invite } = Route.useSearch();
	const { data: university } = useSuspenseQuery(universitySignInQueryOptions);
	const { data: guestForm } = useQuery({
		...guestFormQueryOptions(event ?? "", invite),
		enabled: Boolean(event),
		retry: false,
	});
	const redirectPath = safePath(redirect) ?? HOME_AFTER_SIGN_IN;
	const redirectTo = localizeHref(redirectPath);

	return (
		<div className="flex min-h-[50vh] items-center justify-center p-4 sm:p-8">
			{event && guestForm ? (
				<EventRegistrationChoice
					form={guestForm}
					invite={invite}
					redirectTo={redirectTo}
					redirectPath={redirectPath}
					university={university}
					failed={Boolean(error)}
				/>
			) : (
				<Login
					redirectTo={redirectTo}
					university={university}
					failed={Boolean(error)}
				/>
			)}
		</div>
	);
}
