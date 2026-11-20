import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/client";
import {
	getUserRole,
	isAdmin,
	searchUsers,
	setUserRole,
} from "../src/queries/roles";
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

	it("searches users by a fragment of the e-mail or name", async () => {
		await createUser("ala.nowak@uni.test");
		await createUser("bob@uni.test");
		const found = await searchUsers("NOWAK", 50);
		expect(found.map((u) => u.email)).toEqual(["ala.nowak@uni.test"]);
		expect(found[0]?.role).toBe("user");
		expect(await searchUsers("", 1)).toHaveLength(1);
	});

	it("sets a role", async () => {
		const userId = await createUser();
		const updated = await setUserRole(userId, "organizer");
		expect(updated?.role).toBe("organizer");
		expect(await getUserRole(userId)).toBe("organizer");
		expect(await setUserRole("missing", "admin")).toBeNull();
	});
});
