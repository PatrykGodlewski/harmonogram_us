/// <reference types="node" />
import { env } from "@repo/env";
import { drizzle } from "drizzle-orm/postgres-js";
import {
	authAccounts,
	authSessions,
	authUsers,
	authVerifications,
} from "./schema/better-auth";

export const db = drizzle(env.DATABASE_URL, {
	schema: {
		authUsers,
		authSessions,
		authAccounts,
		authVerifications,
	},
});
