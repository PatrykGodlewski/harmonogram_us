import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { z } from "zod";
import { closeDb } from "../client";
import { ensureAccount, MIN_ACCOUNT_PASSWORD_LENGTH } from "./accounts";

const USAGE = `Usage: pnpm db:account --email <address> [--role user|organizer|admin] [--name <name>] [--password <password> | --link-only]

Creates or updates a verified account. Without --password a random password is generated
and printed once; --link-only creates an account that signs in with e-mail links only.`;

const argsSchema = z.object({
	email: z.email(),
	role: z.enum(["user", "organizer", "admin"]),
	name: z.string().min(1).optional(),
	password: z.string().min(MIN_ACCOUNT_PASSWORD_LENGTH).optional(),
	"link-only": z.boolean(),
});

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
const parsed = argsSchema.safeParse(values);
if (!parsed.success) {
	console.error(`${z.prettifyError(parsed.error)}\n\n${USAGE}`);
	process.exit(1);
}
const args = parsed.data;

const generated =
	!args.password && !args["link-only"]
		? randomBytes(12).toString("base64url")
		: undefined;

const { created } = await ensureAccount({
	email: args.email,
	name: args.name ?? args.email.split("@")[0] ?? args.email,
	role: args.role,
	password: args.password ?? generated,
});
await closeDb();

console.log(
	`${created ? "Created" : "Updated"} ${args.role} account ${args.email.toLowerCase()}.`,
);
if (generated) {
	console.log(`Generated password (shown once): ${generated}`);
} else if (args["link-only"]) {
	console.log("Signs in with an e-mail link (no password).");
}
