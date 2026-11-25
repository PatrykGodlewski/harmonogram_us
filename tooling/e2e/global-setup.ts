import {
	FAKE_CAMERA_FILE,
	SCANNER_TICKET_CODE,
	writeQrY4m,
} from "./fixtures/fake-camera";

/** Prepares the fake camera video for the "skaner" project. */
export default async function globalSetup(): Promise<void> {
	await writeQrY4m(
		`harmonogram-ticket:${SCANNER_TICKET_CODE}`,
		FAKE_CAMERA_FILE,
	);
}
