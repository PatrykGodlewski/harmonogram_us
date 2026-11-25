import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import QRCode from "qrcode";

const WIDTH = 640;
const HEIGHT = 480;
const FRAMES = 30;

/** The ticket the fake camera shows (a fixed 64-character code, see f11-skaner.spec.ts). */
export const SCANNER_TICKET_CODE = `e2e-skaner-${"0".repeat(53)}`;

/** Where the fake camera video lives; Chromium reads it at launch. */
export const FAKE_CAMERA_FILE = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../.fake-camera/ticket.y4m",
);

/**
 * Writes a Y4M (YUV 4:2:0) video showing `text` as a QR code, centred on white,
 * for Chromium's --use-file-for-fake-video-capture.
 */
export async function writeQrY4m(text: string, path: string): Promise<void> {
	const png = PNG.sync.read(
		await QRCode.toBuffer(text, { margin: 2, width: 400 }),
	);
	const y = Buffer.alloc(WIDTH * HEIGHT, 235);
	const offsetX = Math.floor((WIDTH - png.width) / 2);
	const offsetY = Math.floor((HEIGHT - png.height) / 2);
	for (let row = 0; row < png.height; row++) {
		for (let col = 0; col < png.width; col++) {
			const i = (row * png.width + col) * 4;
			const luma =
				0.299 * (png.data[i] ?? 0) +
				0.587 * (png.data[i + 1] ?? 0) +
				0.114 * (png.data[i + 2] ?? 0);
			// BT.601 studio range: black 16, white 235.
			y[(row + offsetY) * WIDTH + col + offsetX] = Math.round(
				16 + (luma * 219) / 255,
			);
		}
	}
	const chroma = Buffer.alloc((WIDTH / 2) * (HEIGHT / 2) * 2, 128);
	const header = `YUV4MPEG2 W${WIDTH} H${HEIGHT} F30:1 Ip A1:1 C420jpeg\n`;
	const frame = Buffer.concat([Buffer.from("FRAME\n"), y, chroma]);
	await mkdir(dirname(path), { recursive: true });
	await writeFile(
		path,
		Buffer.concat([
			Buffer.from(header),
			...Array.from({ length: FRAMES }, () => frame),
		]),
	);
}
