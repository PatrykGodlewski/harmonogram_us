/** What may be uploaded as event material (F14, F19). */

/** 25 MB: slides with images fit; video does not belong here (link it instead). */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

const MAX_NAME_LENGTH = 200;

/** By extension; the server sets the type so the client cannot pick one that renders. */
const TYPES: Record<string, string> = {
	pdf: "application/pdf",
	doc: "application/msword",
	docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	ppt: "application/vnd.ms-powerpoint",
	pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
	xls: "application/vnd.ms-excel",
	xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	odt: "application/vnd.oasis.opendocument.text",
	odp: "application/vnd.oasis.opendocument.presentation",
	ods: "application/vnd.oasis.opendocument.spreadsheet",
	txt: "text/plain",
	csv: "text/csv",
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	webp: "image/webp",
	zip: "application/zip",
};

/** The content type for an allowed file name, else null. */
export function fileTypeFor(name: string): string | null {
	const match = /^.+\.([a-z0-9]+)$/i.exec(name);
	return match?.[1] ? (TYPES[match[1].toLowerCase()] ?? null) : null;
}

/** The base name, without control or direction characters, at most 200 characters. */
export function cleanFileName(name: string): string {
	const base = (name.split(/[/\\]/).pop() ?? "")
		.replace(/[\p{Cc}\p{Cf}]/gu, "")
		.trim();
	if (base.length <= MAX_NAME_LENGTH) {
		return base;
	}
	const dot = base.lastIndexOf(".");
	const extension = dot > 0 && base.length - dot <= 10 ? base.slice(dot) : "";
	return base.slice(0, MAX_NAME_LENGTH - extension.length) + extension;
}
