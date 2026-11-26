import { expect, test } from "@playwright/test";
import { open } from "../fixtures/navigation";

test("[F8] migające piksele animują widoczność, nie przezroczystość @uczestnik", async ({
	page,
}) => {
	await open(page, "/pl");

	// Squares inside the hidden checkerboard (desktop or phone) have no animation.
	const keyframeProperties = await page
		.locator("rect.animate-pixel-flip")
		.evaluateAll((squares) =>
			squares
				.filter((square) => square.getAnimations().length > 0)
				.map((square) =>
					square
						.getAnimations()
						.flatMap((animation) =>
							(animation.effect as KeyframeEffect)
								.getKeyframes()
								.flatMap((keyframe) => Object.keys(keyframe)),
						),
				),
		);

	expect(keyframeProperties.length).toBeGreaterThan(0);
	for (const properties of keyframeProperties) {
		expect(properties).toContain("visibility");
		expect(properties).not.toContain("opacity");
	}
});
