import { eventDetailsQueryOptions } from "@repo/api/events/queries";
import { createGroupServer } from "@repo/api/groups/mutations";
import { parseEmailList } from "@repo/api/groups/parse-email-list";
import {
	event_details_back,
	events_register_full,
	groups_create_submit,
	groups_create_success,
	groups_field_emails,
	groups_field_items,
	groups_field_items_hint,
	groups_field_join_link,
	groups_field_join_link_hint,
	groups_field_name,
	groups_field_name_placeholder,
	groups_field_places,
	groups_new_description,
	groups_new_title,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import { requireAuthenticatedUser } from "@repo/router-utils/require-auth";
import { appErrorMessage } from "@repo/ui/app-errors";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { formatWarsawTime } from "@repo/ui/time";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { EmailListField } from "~/components/groups/email-list-field";

export const Route = createFileRoute("/events/$eventId_/groups/new")({
	beforeLoad: ({ context, location }) => {
		requireAuthenticatedUser(context, { loginRedirect: location.href });
	},
	loader: ({ context: { queryClient }, params }) =>
		queryClient.ensureQueryData(eventDetailsQueryOptions(params.eventId)),
	component: NewGroupPage,
});

function NewGroupPage() {
	const { eventId } = Route.useParams();
	const navigate = useNavigate();
	const { data: event } = useSuspenseQuery(eventDetailsQueryOptions(eventId));
	const registrable = event.agenda.filter((item) => item.requiresRegistration);
	const locale = getLocale();

	const [places, setPlaces] = useState(10);
	const [name, setName] = useState("");
	const [itemIds, setItemIds] = useState<string[]>(
		registrable.map((item) => item.id),
	);
	const [emails, setEmails] = useState("");
	const [joinLinkEnabled, setJoinLinkEnabled] = useState(true);
	const parsed = parseEmailList(emails);

	const create = useMutation({
		mutationFn: () =>
			createGroupServer({
				data: {
					eventId,
					places,
					itemIds,
					name: name.trim() || null,
					emails: parsed.valid,
					joinLinkEnabled,
				},
			}),
		onSuccess: ({ groupId }) => {
			toast.success(groups_create_success());
			void navigate({ to: "/groups/$groupId", params: { groupId } });
		},
		onError: (error) =>
			toast.error(appErrorMessage(error, events_register_full)),
	});

	const handleToggleItem = (id: string, checked: boolean) =>
		setItemIds((current) =>
			checked ? [...current, id] : current.filter((itemId) => itemId !== id),
		);

	const invalid =
		places < 1 || parsed.invalid.length > 0 || parsed.valid.length > places;

	return (
		<div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 sm:p-8">
			<Link
				to="/events/$eventId"
				params={{ eventId }}
				className="text-sm text-muted-foreground hover:underline"
			>
				← {event_details_back()}
			</Link>
			<div className="flex flex-col gap-1">
				<h1 className="text-2xl font-semibold">{groups_new_title()}</h1>
				<p className="text-muted-foreground">{event.title}</p>
				<p className="text-sm text-muted-foreground">
					{groups_new_description()}
				</p>
			</div>

			<form
				className="flex flex-col gap-5"
				onSubmit={(formEvent) => {
					formEvent.preventDefault();
					if (!invalid) create.mutate();
				}}
			>
				<div className="flex flex-col gap-1">
					<Label htmlFor="places">{groups_field_places()}</Label>
					<Input
						id="places"
						type="number"
						inputMode="numeric"
						min={1}
						max={500}
						value={places}
						onChange={(changeEvent) =>
							setPlaces(Number(changeEvent.target.value))
						}
					/>
				</div>

				<div className="flex flex-col gap-1">
					<Label htmlFor="name">{groups_field_name()}</Label>
					<Input
						id="name"
						value={name}
						placeholder={groups_field_name_placeholder()}
						onChange={(changeEvent) => setName(changeEvent.target.value)}
					/>
				</div>

				{registrable.length > 0 ? (
					<fieldset className="flex flex-col gap-2">
						<legend className="text-sm font-medium">
							{groups_field_items()}
						</legend>
						<p className="text-sm text-muted-foreground">
							{groups_field_items_hint()}
						</p>
						{registrable.map((item) => (
							<label
								key={item.id}
								className="flex items-center gap-3 rounded-md border p-3"
							>
								<input
									type="checkbox"
									className="size-4"
									checked={itemIds.includes(item.id)}
									onChange={(changeEvent) =>
										handleToggleItem(item.id, changeEvent.target.checked)
									}
								/>
								<span className="flex flex-col">
									<span>{item.title}</span>
									<span className="text-sm text-muted-foreground tabular-nums">
										{formatWarsawTime(item.startsAt, locale)}–
										{formatWarsawTime(item.endsAt, locale)}
									</span>
								</span>
							</label>
						))}
					</fieldset>
				) : null}

				<EmailListField
					id="emails"
					label={groups_field_emails()}
					value={emails}
					onChange={setEmails}
				/>

				<label className="flex items-start gap-3">
					<input
						type="checkbox"
						className="mt-1 size-4"
						checked={joinLinkEnabled}
						onChange={(changeEvent) =>
							setJoinLinkEnabled(changeEvent.target.checked)
						}
					/>
					<span className="flex flex-col">
						<span>{groups_field_join_link()}</span>
						<span className="text-sm text-muted-foreground">
							{groups_field_join_link_hint()}
						</span>
					</span>
				</label>

				<Button
					type="submit"
					className="w-full sm:w-auto"
					disabled={invalid || create.isPending}
				>
					{groups_create_submit()}
				</Button>
			</form>
		</div>
	);
}
