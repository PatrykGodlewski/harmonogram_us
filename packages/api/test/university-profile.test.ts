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

	it("falls back to the e-mail", () => {
		expect(
			universityProfileToUser({ email: "ala@uni.example", name: "  " }).name,
		).toBe("ala@uni.example");
	});
});
