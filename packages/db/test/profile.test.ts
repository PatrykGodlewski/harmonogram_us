import { beforeEach, describe, expect, it } from "vitest";
import {
	getRegistrationForEmail,
	registerForEvent,
} from "../src/queries/event-registrations";
import { getProfile, updateProfile } from "../src/queries/users";
import { createEvent, createUser, resetDb } from "./helpers";

beforeEach(resetDb);

describe("profile", () => {
	it("saves the name and language", async () => {
		const user = await createUser();
		await updateProfile(user, { name: "Ala Nowak", locale: "en" });
		expect(await getProfile(user)).toEqual({ name: "Ala Nowak", locale: "en" });
	});

	it("e-mails follow the profile language once it is set", async () => {
		const eventId = await createEvent();
		const user = await createUser();
		let registrationId = "";
		await registerForEvent(eventId, user, "pl", {
			onChanged: async (_tx, changes) => {
				registrationId = changes[0]?.registrationId ?? "";
			},
		});
		expect((await getRegistrationForEmail(registrationId))?.locale).toBe("pl");
		await updateProfile(user, { name: "Test User", locale: "en" });
		expect((await getRegistrationForEmail(registrationId))?.locale).toBe("en");
	});
});
