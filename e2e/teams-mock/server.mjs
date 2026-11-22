// A stand-in for Microsoft Graph in the e2e stack: the client-credentials token
// endpoint and POST /v1.0/users/{id}/onlineMeetings. Meetings it created are
// listed at GET /__meetings so tests can check what the app asked for.
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.PORT ?? 18082);
const TENANT = process.env.TENANT ?? "";
const CLIENT_ID = process.env.CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.CLIENT_SECRET ?? "";
const TOKEN = randomUUID();
const meetings = [];

function send(res, status, body) {
	res.writeHead(status, { "content-type": "application/json" });
	res.end(JSON.stringify(body));
}

async function readBody(req) {
	let body = "";
	for await (const chunk of req) body += chunk;
	return body;
}

createServer(async (req, res) => {
	const url = new URL(req.url ?? "/", "http://localhost");
	if (req.method === "POST" && url.pathname === `/${TENANT}/oauth2/v2.0/token`) {
		const form = new URLSearchParams(await readBody(req));
		const valid =
			form.get("grant_type") === "client_credentials" &&
			form.get("client_id") === CLIENT_ID &&
			form.get("client_secret") === CLIENT_SECRET &&
			form.get("scope") === "https://graph.microsoft.com/.default";
		return valid
			? send(res, 200, { access_token: TOKEN, token_type: "Bearer", expires_in: 3599 })
			: send(res, 401, { error: "invalid_client" });
	}
	const meetingPath = url.pathname.match(/^\/v1\.0\/users\/([^/]+)\/onlineMeetings$/);
	if (req.method === "POST" && meetingPath) {
		if (req.headers.authorization !== `Bearer ${TOKEN}`) {
			return send(res, 401, { error: { code: "InvalidAuthenticationToken" } });
		}
		const body = JSON.parse(await readBody(req));
		const meeting = {
			id: randomUUID(),
			organizer: decodeURIComponent(meetingPath[1] ?? ""),
			subject: body.subject,
			startDateTime: body.startDateTime,
			endDateTime: body.endDateTime,
			joinWebUrl: `https://teams.microsoft.com/l/meetup-join/${randomUUID()}`,
		};
		meetings.push(meeting);
		return send(res, 201, meeting);
	}
	if (req.method === "GET" && url.pathname === "/__meetings") {
		return send(res, 200, meetings);
	}
	send(res, 404, { error: "not found" });
}).listen(PORT, () => console.log(`teams mock on ${PORT}`));
