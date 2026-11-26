import {
	createTeamsMeetingServer,
	teamsAvailableQueryOptions,
} from "@repo/api/admin/teams";
import {
	admin_error_generic,
	teams_create_meeting,
	teams_creating_meeting,
	teams_event_cancelled,
	teams_event_ended,
	teams_meeting_created,
} from "@repo/i18n/paraglide/messages";
import { getAppErrorCode } from "@repo/ui/app-errors";
import { Button } from "@repo/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatMutationError } from "~/lib/format-mutation-error";

// The generic messages for these codes talk about registration.
function createErrorMessage(error: unknown): string {
	switch (getAppErrorCode(error)) {
		case "EVENT_CANCELLED":
			return teams_event_cancelled();
		case "EVENT_ENDED":
			return teams_event_ended();
		default:
			return formatMutationError(error, admin_error_generic);
	}
}

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
		onError: (error) => toast.error(createErrorMessage(error)),
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
			aria-busy={create.isPending}
			onClick={() => create.mutate()}
		>
			{create.isPending ? teams_creating_meeting() : teams_create_meeting()}
		</Button>
	);
}
