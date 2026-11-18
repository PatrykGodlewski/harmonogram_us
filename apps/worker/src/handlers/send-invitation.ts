import {
	renderGroupInvitationEmail,
	sendTransactionalEmail,
} from "@repo/api/notifications/email";
import {
	getInvitation,
	reissueInvitationToken,
} from "@repo/db/queries/group-members";
import { env } from "@repo/env";
import {
	group_email_intro,
	group_email_preview,
} from "@repo/i18n/paraglide/messages";
import type { GroupInvitationEmailPayload } from "@repo/jobs/queues";
import { formatWarsawDateTime } from "@repo/ui/time";

export type SendInvitationDeps = {
	send: typeof sendTransactionalEmail;
	issueToken: typeof reissueInvitationToken;
	getView: typeof getInvitation;
	render: typeof renderGroupInvitationEmail;
	baseUrl: string;
};

export const defaultSendInvitationDeps: SendInvitationDeps = {
	send: sendTransactionalEmail,
	issueToken: reissueInvitationToken,
	getView: getInvitation,
	render: renderGroupInvitationEmail,
	baseUrl: env.BETTER_AUTH_URL,
};

/**
 * Sends one invitation. Only token hashes are stored, so a fresh token is issued
 * at send time (the previous one stops working). Skips members that are no
 * longer invited or groups that are no longer open.
 */
export async function sendInvitationEmail(
	payload: GroupInvitationEmailPayload,
	deps: SendInvitationDeps = defaultSendInvitationDeps,
): Promise<"sent" | "skipped"> {
	const token = await deps.issueToken(payload.memberId);
	if (!token) {
		return "skipped";
	}
	const view = await deps.getView(token);
	if (!view) {
		return "skipped";
	}

	const { locale } = payload;
	const url = new URL(`/${locale}/invite/${token}`, deps.baseUrl).toString();
	const eventDate = formatWarsawDateTime(view.group.eventDate, locale);
	const teacherName = view.group.ownerName ?? "";

	await deps.send({
		to: view.email,
		subject: group_email_preview({ event: view.group.eventTitle }, { locale }),
		text: `${group_email_intro(
			{ teacher: teacherName, event: view.group.eventTitle, date: eventDate },
			{ locale },
		)}\n\n${url}`,
		html: await deps.render({
			url,
			locale,
			eventTitle: view.group.eventTitle,
			eventDate,
			deadline: formatWarsawDateTime(view.group.deadline, locale),
			teacherName,
			groupName: view.group.name,
			itemTitles: view.itemTitles,
		}),
	});
	return "sent";
}
