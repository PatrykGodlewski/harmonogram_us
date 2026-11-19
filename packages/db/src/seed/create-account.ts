import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { closeDb } from "../client";
import { type AccountRole, ensureAccount } from "../queries/accounts";

const USAGE = `Usage: pnpm db:account --email <address> [--role user|admin] [--name <name>] [--password <password> | --link-only]

Creates or updates a verified account. Without --password a random password is generated
and printed once; --link-only creates an account that signs in with e-mail links only.`;

function fail(message: string): never {
	console.error(`${message}\n\n${USAGE}`);
	process.exit(1);
}

const { values } = parseArgs({
	options: {
		email: { type: "string" },
		role: { type: "string", default: "user" },
		name: { type: "string" },
		password: { type: "string" },
		"link-only": { type: "boolean", default: false },
		help: { type: "boolean", default: false },
	},
});

if (values.help) {
	console.log(USAGE);
	process.exit(0);
}
if (!values.email?.includes("@")) {
	fail("--email is required");
}
if (values.role !== "user" && values.role !== "admin") {
	fail("--role must be user or admin");
}
if (values.password && values.password.length < 12) {
	fail("--password must have at least 12 characters");
}

const generated =
	!values.password && !values["link-only"]
		? randomBytes(12).toString("base64url")
		: undefined;
const password = values.password ?? generated;

const { created } = await ensureAccount({
	email: values.email,
	name: values.name ?? values.email.split("@")[0] ?? values.email,
	role: values.role as AccountRole,
	password,
});
await closeDb();

console.log(
	`${created ? "Created" : "Updated"} ${values.role} account ${values.email.toLowerCase()}.`,
);
if (generated) {
	console.log(`Generated password (shown once): ${generated}`);
} else if (values["link-only"]) {
	console.log("Signs in with an e-mail link (no password).");
}
