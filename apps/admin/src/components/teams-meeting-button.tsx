import {
	createTeamsMeetingServer,
	teamsAvailableQueryOptions,
} from "@repo/api/admin/teams";
import {
	admin_error_generic,
	teams_create_meeting,
	teams_meeting_created,
} from "@repo/i18n/paraglide/messages";
import { Button } from "@repo/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatMutationError } from "~/lib/format-mutation-error";

/**
 * Creates the event's Teams meeting and saves its join link as the meeting
 * link (F23). Shown only where Teams is set up.
 */
export function TeamsMeetingButton({
	eventId,
	onCreated,
}: {
	eventId: string;
	onCreated: (onlineUrl: string) => Promise<unknown> | undefined;
}) {
	const { data: available } = useQuery(teamsAvailableQueryOptions);
	const create = useMutation({
		mutationFn: () => createTeamsMeetingServer({ data: { eventId } }),
		onSuccess: async ({ onlineUrl }) => {
			toast.success(teams_meeting_created());
			await onCreated(onlineUrl);
		},
		onError: (error) =>
			toast.error(formatMutationError(error, admin_error_generic)),
	});
	if (!available) {
		return null;
	}
	return (
		<Button
			type="button"
			size="sm"
			variant="outline"
			className="self-start"
			disabled={create.isPending}
			onClick={() => create.mutate()}
		>
			{teams_create_meeting()}
		</Button>
	);
}
