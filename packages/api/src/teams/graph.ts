/** Server-only: Teams meetings through Microsoft Graph with an app-only token (F23). */
import { env } from "@repo/env";
import { z } from "zod";

export type TeamsConfig = {
	tenantId: string;
	clientId: string;
	clientSecret: string;
	/** Entra object id or UPN of the account the meetings belong to. */
	organizerId: string;
	loginUrl: string;
	graphUrl: string;
};

/** The configuration, or null when Teams is not set up (the feature is off). */
export function teamsConfig(): TeamsConfig | null {
	const {
		TEAMS_TENANT_ID,
		TEAMS_CLIENT_ID,
		TEAMS_CLIENT_SECRET,
		TEAMS_ORGANIZER_ID,
	} = env;
	if (
		!TEAMS_TENANT_ID ||
		!TEAMS_CLIENT_ID ||
		!TEAMS_CLIENT_SECRET ||
		!TEAMS_ORGANIZER_ID
	) {
		return null;
	}
	return {
		tenantId: TEAMS_TENANT_ID,
		clientId: TEAMS_CLIENT_ID,
		clientSecret: TEAMS_CLIENT_SECRET,
		organizerId: TEAMS_ORGANIZER_ID,
		loginUrl: env.TEAMS_LOGIN_URL,
		graphUrl: env.TEAMS_GRAPH_URL,
	};
}

const tokenSchema = z.object({ access_token: z.string().min(1) });
const meetingSchema = z.object({
	joinWebUrl: z.url({ protocol: /^https$/ }),
});

const TIMEOUT_MS = 10_000;

async function appToken(
	config: TeamsConfig,
	fetchImpl: typeof fetch,
): Promise<string> {
	const response = await fetchImpl(
		`${config.loginUrl}/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`,
		{
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				client_id: config.clientId,
				client_secret: config.clientSecret,
				scope: "https://graph.microsoft.com/.default",
				grant_type: "client_credentials",
			}).toString(),
			signal: AbortSignal.timeout(TIMEOUT_MS),
		},
	);
	if (!response.ok) {
		throw new Error(`Teams token request failed: HTTP ${response.status}`);
	}
	return tokenSchema.parse(await response.json()).access_token;
}

/**
 * Creates an online meeting for the organizer account and returns its join
 * link. Errors carry only the HTTP status, never the secret or the token.
 */
export async function createTeamsMeeting(
	config: TeamsConfig,
	meeting: { subject: string; start: Date; end: Date },
	fetchImpl: typeof fetch = fetch,
): Promise<string> {
	const token = await appToken(config, fetchImpl);
	const response = await fetchImpl(
		`${config.graphUrl}/v1.0/users/${encodeURIComponent(config.organizerId)}/onlineMeetings`,
		{
			method: "POST",
			headers: {
				authorization: `Bearer ${token}`,
				"content-type": "application/json",
			},
			body: JSON.stringify({
				subject: meeting.subject,
				startDateTime: meeting.start.toISOString(),
				endDateTime: meeting.end.toISOString(),
			}),
			signal: AbortSignal.timeout(TIMEOUT_MS),
		},
	);
	if (!response.ok) {
		throw new Error(`Teams meeting request failed: HTTP ${response.status}`);
	}
	const parsed = meetingSchema.safeParse(await response.json());
	if (!parsed.success) {
		throw new Error("Teams meeting has no https join link");
	}
	return parsed.data.joinWebUrl;
}
