import { describe, expect, it } from "vitest";
import { universityProfileToUser } from "../src/auth/university";

describe("universityProfileToUser", () => {
	it("keeps the name the university sends", () => {
		expect(
			universityProfileToUser({ name: " Ala Nowak ", given_name: "A" }),
		).toEqual({ name: "Ala Nowak", emailVerified: true });
	});

	it("joins given and family name when there is no name", () => {
		expect(
			universityProfileToUser({ given_name: "Ala", family_name: "Nowak" })
				.name,
		).toBe("Ala Nowak");
		expect(universityProfileToUser({ family_name: "Nowak" }).name).toBe(
			"Nowak",
		);
	});

	it("trusts the address unless the university says it is unverified", () => {
		expect(universityProfileToUser({ name: "A" }).emailVerified).toBe(true);
		expect(
			universityProfileToUser({ name: "A", email_verified: false })
				.emailVerified,
		).toBe(false);
	});

	it("falls back to the e-mail", () => {
		expect(
			universityProfileToUser({ email: "ala@uni.example", name: "  " }).name,
		).toBe("ala@uni.example");
	});
});
