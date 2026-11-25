/** What may be uploaded as a programme item's image (F18); safe to import in the browser. */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** No SVG: images are shown inline, and an SVG can carry script. */
const IMAGE_TYPES: Record<string, string> = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	webp: "image/webp",
};

/** For the file picker (`accept`); the server checks again. */
export const ACCEPTED_IMAGE_EXTENSIONS = Object.keys(IMAGE_TYPES)
	.map((extension) => `.${extension}`)
	.join(",");

/** The content type for an allowed image name, else null. */
export function imageTypeFor(name: string): string | null {
	const extension = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
	return extension ? (IMAGE_TYPES[extension] ?? null) : null;
}
