/** Server-only: shared building blocks for the app's PDFs (Noto Sans, Polish letters). */
import fontkit from "@pdf-lib/fontkit";
import { env } from "@repo/env/client";
import { PDFDocument, type PDFFont, type PDFPage, rgb } from "pdf-lib";
import boldFont from "./assets/NotoSans-Bold.ttf?inline";
import regularFont from "./assets/NotoSans-Regular.ttf?inline";
import type { MeasureText } from "./layout";

export const NAVY = rgb(0.06, 0.16, 0.34);
export const GREY = rgb(0.35, 0.38, 0.42);

function fontBytes(dataUrl: string): Uint8Array {
	return Uint8Array.from(
		Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64"),
	);
}

/** Decoded once per process, not per download. */
const FONTS = { regular: fontBytes(regularFont), bold: fontBytes(boldFont) };

/** A new document with the app's fonts embedded (subset to the letters used). */
export async function createPdf(title: string): Promise<{
	pdf: PDFDocument;
	regular: PDFFont;
	bold: PDFFont;
}> {
	const pdf = await PDFDocument.create();
	pdf.registerFontkit(fontkit);
	pdf.setTitle(title);
	const regular = await pdf.embedFont(FONTS.regular, { subset: true });
	const bold = await pdf.embedFont(FONTS.bold, { subset: true });
	return { pdf, regular, bold };
}

export const measure =
	(font: PDFFont): MeasureText =>
	(text, size) =>
		font.widthOfTextAtSize(text, size);

/** Draws one line centred across the page. */
export function drawCentered(
	page: PDFPage,
	text: string,
	y: number,
	font: PDFFont,
	size: number,
	color = NAVY,
): void {
	const x = (page.getWidth() - font.widthOfTextAtSize(text, size)) / 2;
	page.drawText(text, { x, y, size, font, color });
}

/** "1 grudnia 2026" / "1 December 2026" in the installation time zone. */
export function formatLongDate(date: Date, locale: "pl" | "en"): string {
	return new Intl.DateTimeFormat(locale === "pl" ? "pl-PL" : "en-GB", {
		dateStyle: "long",
		timeZone: env.VITE_APP_TIME_ZONE,
	}).format(date);
}

/** "1 grudnia 2026, 18:00" in the installation time zone. */
export function formatLongDateTime(date: Date, locale: "pl" | "en"): string {
	return new Intl.DateTimeFormat(locale === "pl" ? "pl-PL" : "en-GB", {
		dateStyle: "long",
		timeStyle: "short",
		timeZone: env.VITE_APP_TIME_ZONE,
	}).format(date);
}
