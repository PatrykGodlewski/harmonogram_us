import {
	addEventOrganizerServer,
	eventOrganizersQueryOptions,
	removeEventOrganizerServer,
} from "@repo/api/admin/organizers";
import {
	admin_action_delete,
	admin_error_generic,
	admin_organizers_add,
	admin_organizers_added,
	admin_organizers_email,
	admin_organizers_remove,
	admin_organizers_title,
} from "@repo/i18n/paraglide/messages";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";
import { formatMutationError } from "~/lib/format-mutation-error";

export function OrganizersCard({ eventId }: { eventId: string }) {
	const headingId = useId();
	const inputId = useId();
	const queryClient = useQueryClient();
	const [email, setEmail] = useState("");
	const options = eventOrganizersQueryOptions(eventId);
	const { data: organizers = [] } = useQuery(options);

	const handleSettled = () =>
		queryClient.invalidateQueries({ queryKey: options.queryKey });
	const handleError = (error: unknown) =>
		toast.error(formatMutationError(error, admin_error_generic));

	const addMutation = useMutation({
		mutationFn: (value: string) =>
			addEventOrganizerServer({ data: { eventId, email: value } }),
		onSuccess: async () => {
			setEmail("");
			toast.success(admin_organizers_added());
			await handleSettled();
		},
		onError: handleError,
	});

	const removeMutation = useMutation({
		mutationFn: (userId: string) =>
			removeEventOrganizerServer({ data: { eventId, userId } }),
		onSuccess: handleSettled,
		onError: handleError,
	});

	const handleSubmit = (event: FormEvent) => {
		event.preventDefault();
		if (email.trim()) {
			addMutation.mutate(email.trim());
		}
	};

	return (
		<section aria-labelledby={headingId} className="flex flex-col gap-3">
			<h2 id={headingId} className="text-lg font-semibold">
				{admin_organizers_title()}
			</h2>
			<ul className="divide-y rounded-lg border">
				{organizers.map((organizer) => (
					<li
						key={organizer.userId}
						className="flex items-center justify-between gap-2 p-3"
					>
						<div className="min-w-0">
							<p className="font-medium break-all">{organizer.email}</p>
							<p className="text-sm text-muted-foreground">{organizer.name}</p>
						</div>
						<Button
							variant="outline"
							size="sm"
							aria-label={admin_organizers_remove({ email: organizer.email })}
							disabled={removeMutation.isPending || organizers.length <= 1}
							onClick={() => removeMutation.mutate(organizer.userId)}
						>
							{admin_action_delete()}
						</Button>
					</li>
				))}
			</ul>
			<form onSubmit={handleSubmit} className="flex flex-col gap-2">
				<Label htmlFor={inputId}>{admin_organizers_email()}</Label>
				<div className="flex gap-2">
					<Input
						id={inputId}
						type="email"
						autoComplete="off"
						value={email}
						onChange={(event) => setEmail(event.target.value)}
						disabled={addMutation.isPending}
					/>
					<Button type="submit" disabled={addMutation.isPending}>
						{admin_organizers_add()}
					</Button>
				</div>
			</form>
		</section>
	);
}
