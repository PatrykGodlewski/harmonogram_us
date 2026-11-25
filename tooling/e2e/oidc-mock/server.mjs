// A stand-in for the university's OpenID Connect server in the e2e stack.
// The tester types the e-mail and name the university would send; "Anuluj" refuses.
import {
	createHash,
	createSign,
	generateKeyPairSync,
	randomBytes,
} from "node:crypto";
import { createServer } from "node:http";

const PORT = Number(process.env.PORT ?? 18080);
const CLIENT_ID = process.env.CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.CLIENT_SECRET ?? "";

/** Signs ID tokens (RS256) like a real provider; the public key is served at /jwks. */
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
// A new key on every start: a new key id makes clients fetch /jwks again instead of
// checking new tokens against the key they cached from the previous run.
const KEY_ID = randomBytes(8).toString("hex");
const JWK = { ...publicKey.export({ format: "jwk" }), kid: KEY_ID, alg: "RS256", use: "sig" };

const base64url = (value) => Buffer.from(value).toString("base64url");

function signIdToken(claims) {
	const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT", kid: KEY_ID }));
	const payload = base64url(JSON.stringify(claims));
	const signature = createSign("RSA-SHA256")
		.update(`${header}.${payload}`)
		.sign(privateKey, "base64url");
	return `${header}.${payload}.${signature}`;
}

/** code → person, access token → person; codes are single-use. */
const codes = new Map();
const tokens = new Map();

const escape = (value) =>
	String(value).replace(
		/[&<>"]/g,
		(char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char],
	);

function issuerOf(request) {
	return `http://${request.headers.host}`;
}

async function readForm(request) {
	let body = "";
	for await (const chunk of request) body += chunk;
	return new URLSearchParams(body);
}

function send(response, status, body, type = "application/json") {
	response.writeHead(status, { "content-type": type });
	response.end(typeof body === "string" ? body : JSON.stringify(body));
}

function redirect(response, url) {
	response.writeHead(302, { location: url.toString() });
	response.end();
}

function clientAuthorized(request, form) {
	const basic = request.headers.authorization?.match(/^Basic (.+)$/)?.[1];
	const [id, secret] = basic
		? Buffer.from(basic, "base64").toString().split(":").map(decodeURIComponent)
		: [form.get("client_id"), form.get("client_secret")];
	return id === CLIENT_ID && secret === CLIENT_SECRET;
}

function loginPage(params) {
	const hidden = ["redirect_uri", "state", "client_id", "nonce"]
		.map(
			(name) =>
				`<input type="hidden" name="${name}" value="${escape(params.get(name) ?? "")}">`,
		)
		.join("");
	return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>Logowanie uczelni (test)</title></head>
<body><main><h1>Logowanie uczelni (test)</h1>
<form method="post" action="/authorize">${hidden}
<label>E-mail <input name="email" type="email"></label>
<label>Imię <input name="given_name"></label>
<label>Nazwisko <input name="family_name"></label>
<button name="action" value="login">Zaloguj</button>
<button name="action" value="cancel">Anuluj</button>
</form></main></body></html>`;
}

const server = createServer(async (request, response) => {
	const url = new URL(request.url ?? "/", issuerOf(request));
	const issuer = issuerOf(request);

	if (url.pathname === "/.well-known/openid-configuration") {
		return send(response, 200, {
			issuer,
			authorization_endpoint: `${issuer}/authorize`,
			token_endpoint: `${issuer}/token`,
			userinfo_endpoint: `${issuer}/userinfo`,
			jwks_uri: `${issuer}/jwks`,
			id_token_signing_alg_values_supported: ["RS256"],
			response_types_supported: ["code"],
			subject_types_supported: ["public"],
			scopes_supported: ["openid", "email", "profile"],
			token_endpoint_auth_methods_supported: [
				"client_secret_basic",
				"client_secret_post",
			],
		});
	}

	if (url.pathname === "/jwks") {
		return send(response, 200, { keys: [JWK] });
	}

	if (url.pathname === "/authorize" && request.method === "GET") {
		if (url.searchParams.get("client_id") !== CLIENT_ID) {
			return send(response, 400, { error: "unauthorized_client" });
		}
		return send(response, 200, loginPage(url.searchParams), "text/html");
	}

	if (url.pathname === "/authorize" && request.method === "POST") {
		const form = await readForm(request);
		const back = new URL(form.get("redirect_uri") ?? "");
		back.searchParams.set("state", form.get("state") ?? "");
		back.searchParams.set("iss", issuer);
		if (form.get("action") === "cancel") {
			back.searchParams.set("error", "access_denied");
			return redirect(response, back);
		}
		const email = (form.get("email") ?? "").trim().toLowerCase();
		const code = randomBytes(16).toString("hex");
		codes.set(code, {
			person: {
				sub: createHash("sha256").update(email).digest("hex").slice(0, 24),
				email,
				email_verified: true,
				given_name: form.get("given_name") || undefined,
				family_name: form.get("family_name") || undefined,
			},
			nonce: form.get("nonce") || undefined,
		});
		back.searchParams.set("code", code);
		return redirect(response, back);
	}

	if (url.pathname === "/token" && request.method === "POST") {
		const form = await readForm(request);
		if (!clientAuthorized(request, form)) {
			return send(response, 401, { error: "invalid_client" });
		}
		const grant = codes.get(form.get("code"));
		codes.delete(form.get("code"));
		if (!grant) return send(response, 400, { error: "invalid_grant" });
		const accessToken = randomBytes(24).toString("hex");
		tokens.set(accessToken, grant.person);
		const now = Math.floor(Date.now() / 1000);
		return send(response, 200, {
			access_token: accessToken,
			token_type: "Bearer",
			expires_in: 300,
			scope: "openid email profile",
			id_token: signIdToken({
				...grant.person,
				iss: issuer,
				aud: CLIENT_ID,
				iat: now,
				exp: now + 300,
				nonce: grant.nonce,
			}),
		});
	}

	if (url.pathname === "/userinfo") {
		const token = request.headers.authorization?.replace(/^Bearer /, "");
		const person = token ? tokens.get(token) : undefined;
		if (!person) return send(response, 401, { error: "invalid_token" });
		return send(response, 200, person);
	}

	send(response, 404, { error: "not_found" });
});

server.listen(PORT, () => {
	console.log(`oidc-mock on :${PORT}`);
});
