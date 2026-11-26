/**
 * Runs five sample events through the real prompt LLM and image provider (no database) and
 * writes the images plus prompts.txt to data/sample-event-images/ at the repo root.
 * Usage: pnpm sample:event-images
 */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { env } from "@repo/env";
import { buildImagePrompt, imageStyle } from "../src/event-images/prompt";
import { generateImage, randomSeed } from "../src/event-images/providers";

const SAMPLE_TITLES = [
	"Jazz night in a Kazimierz basement bar, Friday 20:00, live quartet",
	"Wieczór planszówek w kawiarni – przynieś ulubioną grę!",
	"Sunrise 10k charity run along the Vistula, medals for all finishers",
	"Intro to Rust workshop for backend developers, laptops required",
	"Summer rooftop techno party, DJs until 4am",
];

const OUTPUT_DIR = fileURLToPath(
	new URL("../../../data/sample-event-images/", import.meta.url),
);

const EXTENSIONS: Record<string, string> = {
	"image/png": "png",
	"image/jpeg": "jpg",
	"image/webp": "webp",
};

type Result = {
	title: string;
	prompt: string;
	seed: number;
	status: "ok" | "failed";
	file?: string;
	error?: string;
};

function missingKeys(): string[] {
	const required =
		env.IMAGE_PROVIDER === "cloudflare"
			? ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"]
			: ["FAL_KEY"];
	return ["ANTHROPIC_API_KEY", ...required].filter(
		(name) => !env[name as keyof typeof env],
	);
}

function slugify(title: string): string {
	return title
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/ł/g, "l")
		.replace(/Ł/g, "L")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

async function generateSample(title: string): Promise<Result> {
	const prompt = await buildImagePrompt(title, null);
	const seed = randomSeed();
	try {
		const image = await generateImage(prompt, {
			seed,
			width: 1024,
			height: 576,
		});
		const file = `${slugify(title)}.${EXTENSIONS[image.mimeType] ?? "bin"}`;
		await writeFile(`${OUTPUT_DIR}${file}`, new Uint8Array(image.bytes));
		return { title, prompt, seed, status: "ok", file };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { title, prompt, seed, status: "failed", error: message };
	}
}

function describe(result: Result): string {
	return [
		`title: ${result.title}`,
		`prompt: ${result.prompt}`,
		// buildImagePrompt never throws: a failed LLM call shows up as the title fallback.
		`prompt source: ${result.prompt.startsWith("atmospheric scene for ") ? "fallback (LLM failed)" : "llm"}`,
		`seed: ${result.seed}`,
		`provider: ${env.IMAGE_PROVIDER}`,
		`status: ${result.status}`,
		`file: ${result.file ?? "-"}`,
		`error: ${result.error ?? "-"}`,
	].join("\n");
}

const missing = missingKeys();
if (missing.length > 0) {
	console.error(
		`Missing environment variable(s) for IMAGE_PROVIDER=${env.IMAGE_PROVIDER}: ${missing.join(", ")}. Set them in the repo .env.`,
	);
	process.exit(1);
}

await mkdir(OUTPUT_DIR, { recursive: true });
console.log(`Style: ${imageStyle()}`);

const results: Result[] = [];
for (const title of SAMPLE_TITLES) {
	const result = await generateSample(title);
	results.push(result);
	console.log(`${result.status === "ok" ? "ok    " : "FAILED"} ${title}`);
}

await writeFile(
	`${OUTPUT_DIR}prompts.txt`,
	`${results.map(describe).join("\n\n")}\n`,
);

const failed = results.filter((result) => result.status === "failed");
console.log(
	`${results.length - failed.length}/${results.length} images ok, written to ${OUTPUT_DIR}`,
);
for (const result of failed) {
	console.error(`failed: ${result.title}: ${result.error}`);
}
process.exit(failed.length > 0 ? 1 : 0);
