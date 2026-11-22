import { describe, expect, it } from "vitest";
import { createTeamsMeeting, type TeamsConfig } from "../src/teams/graph";

const CONFIG: TeamsConfig = {
	tenantId: "tenant-1",
	clientId: "client-1",
	clientSecret: "secret-1",
	organizerId: "organizer@uni.test",
	loginUrl: "https://login.example",
	graphUrl: "https://graph.example",
};

const MEETING = {
	subject: "Seminarium online",
	start: new Date("2026-12-01T09:00:00Z"),
	end: new Date("2026-12-01T11:00:00Z"),
};

type Call = { url: string; init?: RequestInit };

function graph(
	meetingBody: unknown = { id: "m-1", joinWebUrl: "https://teams.microsoft.com/l/meetup-join/abc" },
	{ tokenStatus = 200, meetingStatus = 201 } = {},
) {
	const calls: Call[] = [];
	const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
		calls.push({ url: String(url), init });
		if (String(url).includes("/oauth2/")) {
			return new Response(JSON.stringify({ access_token: "tok-1", token_type: "Bearer" }), {
				status: tokenStatus,
			});
		}
		return new Response(JSON.stringify(meetingBody), { status: meetingStatus });
	}) as typeof fetch;
	return { calls, fetchImpl };
}

describe("createTeamsMeeting", () => {
	it("gets an app token and creates the meeting for the organizer account", async () => {
		const { calls, fetchImpl } = graph();
		const url = await createTeamsMeeting(CONFIG, MEETING, fetchImpl);
		expect(url).toBe("https://teams.microsoft.com/l/meetup-join/abc");

		const [token, meeting] = calls;
		expect(token?.url).toBe("https://login.example/tenant-1/oauth2/v2.0/token");
		expect(token?.init?.method).toBe("POST");
		const form = new URLSearchParams(String(token?.init?.body));
		expect(Object.fromEntries(form)).toEqual({
			client_id: "client-1",
			client_secret: "secret-1",
			scope: "https://graph.microsoft.com/.default",
			grant_type: "client_credentials",
		});

		expect(meeting?.url).toBe("https://graph.example/v1.0/users/organizer%40uni.test/onlineMeetings");
		expect(meeting?.init?.method).toBe("POST");
		expect(new Headers(meeting?.init?.headers).get("authorization")).toBe("Bearer tok-1");
		expect(JSON.parse(String(meeting?.init?.body))).toEqual({
			subject: "Seminarium online",
			startDateTime: "2026-12-01T09:00:00.000Z",
			endDateTime: "2026-12-01T11:00:00.000Z",
		});
	});

	it("fails without leaking the secret when the token or the meeting is refused", async () => {
		for (const options of [{ tokenStatus: 401 }, { meetingStatus: 403 }]) {
			const { fetchImpl } = graph(undefined, options);
			const error = await createTeamsMeeting(CONFIG, MEETING, fetchImpl).catch((e: unknown) => e);
			expect(error).toBeInstanceOf(Error);
			expect(String(error)).not.toContain("secret-1");
			expect(String(error)).not.toContain("tok-1");
		}
	});

	it("refuses a meeting without a usable https join link", async () => {
		for (const body of [{ id: "m" }, { joinWebUrl: "http://teams.example/x" }, { joinWebUrl: "javascript:x" }]) {
			const { fetchImpl } = graph(body);
			await expect(createTeamsMeeting(CONFIG, MEETING, fetchImpl)).rejects.toThrow();
		}
	});
});
