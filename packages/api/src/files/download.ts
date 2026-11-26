/** Server-only: the download of an event file, as a redirect to a short-lived signed link. */
import { getEventFile } from "@repo/db/queries/event-files";
import { canManageEvent } from "@repo/db/queries/event-organizers";
import { getCurrentSession, getCurrentUser } from "../auth/user";
import { canViewEvent, eventViewAccess } from "../events/access";
import {
	presignDownload,
	type StorageConfig,
	storageConfig,
} from "../storage/s3";

export type FileDownloadDeps = {
	config: StorageConfig | null;
	getFile: (
		id: string,
	) => Promise<{ eventId: string; storageKey: string; name: string } | null>;
	presign: typeof presignDownload;
};

const defaultDeps = (): FileDownloadDeps => ({
	config: storageConfig(),
	getFile: getEventFile,
	presign: presignDownload,
});

const NOT_FOUND = () =>
	new Response("Not found", {
		status: 404,
		headers: { "cache-control": "private, no-store" },
	});

function redirectTo(location: string): Response {
	return new Response(null, {
		status: 302,
		headers: { location, "cache-control": "private, no-store" },
	});
}

/**
 * 302 to the bucket when `canSee` allows the file's event; 302 to the sign-in
 * page and back to the file for `"sign-in"`; 404 otherwise, the same as an
 * unknown file, so ids reveal nothing.
 */
export async function fileDownloadResponse(
	fileId: string,
	canSee: (eventId: string) => Promise<boolean | "sign-in">,
	deps: FileDownloadDeps = defaultDeps(),
): Promise<Response> {
	if (!deps.config) {
		return NOT_FOUND();
	}
	const file = await deps.getFile(fileId);
	const access = file ? await canSee(file.eventId) : false;
	if (access === "sign-in") {
		return redirectTo(
			`/login?${new URLSearchParams({ redirect: `/api/files/${fileId}` })}`,
		);
	}
	if (!file || !access) {
		return NOT_FOUND();
	}
	return redirectTo(
		await deps.presign(deps.config, file.storageKey, file.name),
	);
}

type CanSee = (eventId: string) => Promise<boolean>;

/** The public site: whoever can open the event page (`invite` for invite-only events). */
export async function visitorCanSee(
	invite: string | undefined,
): Promise<CanSee> {
	const session = await getCurrentSession();
	return (eventId) => canViewEvent(eventId, session?.user.id ?? null, invite);
}

/** The panel: the event's managers, drafts included. */
export async function managerCanSee(): Promise<CanSee> {
	const user = await getCurrentUser();
	return async (eventId) => (user ? canManageEvent(user, eventId) : false);
}

export async function publicFileResponse(
	fileId: string,
	invite: string | undefined,
): Promise<Response> {
	const userId = (await getCurrentSession())?.user.id ?? null;
	return fileDownloadResponse(fileId, async (eventId) => {
		const access = await eventViewAccess(eventId, userId, invite);
		return access === "sign-in" ? access : access === "allowed";
	});
}

export async function panelFileResponse(fileId: string): Promise<Response> {
	return fileDownloadResponse(fileId, await managerCanSee());
}
