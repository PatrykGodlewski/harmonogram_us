import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/client";
import { getUserRole, isAdmin } from "../src/queries/roles";
import { authUsers } from "../src/schema/better-auth";
import { createUser, resetDb } from "./helpers";

beforeEach(resetDb);

describe("roles", () => {
	it("new users default to role user", async () => {
		const userId = await createUser();
		expect(await getUserRole(userId)).toBe("user");
		expect(await isAdmin(userId)).toBe(false);
	});

	it("admin role detected", async () => {
		const userId = await createUser();
		await db
			.update(authUsers)
			.set({ role: "admin" })
			.where(eq(authUsers.id, userId));
		expect(await getUserRole(userId)).toBe("admin");
		expect(await isAdmin(userId)).toBe(true);
	});

	it("unknown user has no role", async () => {
		expect(await getUserRole("missing")).toBeNull();
		expect(await isAdmin("missing")).toBe(false);
	});
});
