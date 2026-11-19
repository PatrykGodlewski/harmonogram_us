import { Turnstile } from "@marsidev/react-turnstile";
import { joinGroupServer } from "@repo/api/groups/mutations";
import { joinGroupInfoQueryOptions } from "@repo/api/groups/queries";
import { env } from "@repo/env/client";
import {
	error_group_not_found,
	events_register_full,
	join_closed,
	join_description,
	join_email,
	join_places_left,
	join_sent,
	join_submit,
	join_title,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import { appErrorMessage } from "@repo/ui/app-errors";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { formatEventDateTime } from "@repo/ui/time";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { z } from "zod";
import { LandingShell } from "~/components/groups/landing-shell";

export const Route = createFileRoute("/join/$code")({
	loader: ({ context: { queryClient }, params }) =>
		queryClient
			.ensureQueryData(joinGroupInfoQueryOptions(params.code))
			.catch(() => null),
	component: JoinGroupPage,
});

function JoinGroupPage() {
	const { code } = Route.useParams();
	const locale = getLocale();
	const info = useQuery(joinGroupInfoQueryOptions(code));
	const [email, setEmail] = useState("");
	const [captchaToken, setCaptchaToken] = useState<string | undefined>();
	const captchaSiteKey = env.VITE_TURNSTILE_SITE_KEY;
	const validEmail = z.email().safeParse(email.trim()).success;

	const join = useMutation({
		mutationFn: () =>
			joinGroupServer({
				data: { code, email: email.trim(), turnstileToken: captchaToken },
			}),
	});

	const shell = (children: ReactNode) => (
		<LandingShell>{children}</LandingShell>
	);

	if (info.isError) {
		return shell(
			<p className="text-muted-foreground">{error_group_not_found()}</p>,
		);
	}
	const group = info.data;
	if (!group) {
		return null;
	}
	const accepting =
		group.status === "open" &&
		new Date(group.deadline).getTime() > Date.now() &&
		group.placesLeft > 0;

	if (join.isSuccess) {
		return shell(
			<p className="rounded-lg border p-4" role="status">
				{join_sent({ email: join.data.email })}
			</p>,
		);
	}

	return shell(
		<>
			<h1 className="text-2xl font-semibold">{group.name ?? join_title()}</h1>
			<p>
				{join_description({
					teacher: group.ownerName ?? "",
					event: group.eventTitle,
					date: formatEventDateTime(group.eventDate, locale),
				})}
			</p>
			{accepting ? (
				<form
					className="flex flex-col gap-3"
					onSubmit={(event) => {
						event.preventDefault();
						if (validEmail) join.mutate();
					}}
				>
					<p className="text-sm text-muted-foreground">
						{join_places_left({ count: group.placesLeft })}
					</p>
					<div className="flex flex-col gap-1">
						<Label htmlFor="email">{join_email()}</Label>
						<Input
							id="email"
							type="email"
							autoComplete="email"
							value={email}
							onChange={(event) => setEmail(event.target.value)}
						/>
					</div>
					{captchaSiteKey ? (
						<Turnstile siteKey={captchaSiteKey} onSuccess={setCaptchaToken} />
					) : null}
					{join.isError ? (
						<p className="text-sm text-destructive" role="alert">
							{appErrorMessage(join.error, events_register_full)}
						</p>
					) : null}
					<Button
						type="submit"
						disabled={
							!validEmail ||
							join.isPending ||
							(Boolean(captchaSiteKey) && !captchaToken)
						}
					>
						{join_submit()}
					</Button>
				</form>
			) : (
				<p className="text-muted-foreground">{join_closed()}</p>
			)}
		</>,
	);
}
