import { checkInServer } from "@repo/api/admin/check-in";
import { ticketCodeFromQr } from "@repo/api/tickets/qr";
import {
	admin_error_generic,
	admin_scan_already,
	admin_scan_camera_denied,
	admin_scan_checked_in,
	admin_scan_hint,
	admin_scan_not_ticket,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import { appErrorMessage } from "@repo/ui/app-errors";
import { formatEventTime } from "@repo/ui/time";
import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";

/** What the ticket QR code holds (see the ticket page). */
/** How often a camera frame is decoded. */
const SCAN_INTERVAL_MS = 250;
/** The same code is not sent again within this time (it stays in front of the camera). */
const REPEAT_AFTER_MS = 3_000;

type ScanResult =
	| { kind: "ok"; message: string }
	| { kind: "warning"; message: string }
	| { kind: "error"; message: string };

const RESULT_STYLES: Record<ScanResult["kind"], string> = {
	ok: "border-green-600 bg-green-50 text-green-900",
	warning: "border-amber-500 bg-amber-50 text-amber-900",
	error: "border-destructive bg-destructive/10 text-destructive",
};

/** Reads ticket QR codes with the phone camera and checks people in. */
export function TicketScanner({ eventId }: { eventId: string }) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const [cameraDenied, setCameraDenied] = useState(false);
	const [result, setResult] = useState<ScanResult | null>(null);

	useEffect(() => {
		let stream: MediaStream | null = null;
		let timer: ReturnType<typeof setInterval> | undefined;
		let busy = false;
		// The page may be left before the camera starts: then stop it as soon as it does.
		let cancelled = false;
		const lastSeen = new Map<string, number>();
		const canvas = document.createElement("canvas");
		const context = canvas.getContext("2d", { willReadFrequently: true });

		const handleCode = async (text: string) => {
			const now = Date.now();
			if (now - (lastSeen.get(text) ?? 0) < REPEAT_AFTER_MS) {
				return;
			}
			lastSeen.set(text, now);
			const ticketCode = ticketCodeFromQr(text);
			if (!ticketCode) {
				setResult({ kind: "error", message: admin_scan_not_ticket() });
				return;
			}
			try {
				const checkIn = await checkInServer({
					data: { eventId, ticketCode },
				});
				const time = formatEventTime(checkIn.checkedInAt, getLocale());
				setResult(
					checkIn.status === "checked-in"
						? {
								kind: "ok",
								message: admin_scan_checked_in({ name: checkIn.name }),
							}
						: {
								kind: "warning",
								message: admin_scan_already({ time, name: checkIn.name }),
							},
				);
				navigator.vibrate?.(100);
			} catch (error) {
				setResult({
					kind: "error",
					message: appErrorMessage(error, admin_error_generic),
				});
			}
		};

		const scanFrame = async () => {
			const video = videoRef.current;
			if (busy || !video || !context || video.readyState < 2) {
				return;
			}
			canvas.width = video.videoWidth;
			canvas.height = video.videoHeight;
			context.drawImage(video, 0, 0);
			const image = context.getImageData(0, 0, canvas.width, canvas.height);
			const code = jsQR(image.data, image.width, image.height);
			if (code?.data) {
				busy = true;
				await handleCode(code.data);
				busy = false;
			}
		};

		if (!navigator.mediaDevices?.getUserMedia) {
			// No camera API (e.g. a plain-HTTP address that isn't localhost).
			setCameraDenied(true);
			return;
		}
		navigator.mediaDevices
			.getUserMedia({ video: { facingMode: "environment" } })
			.then(async (media) => {
				stream = media;
				const video = videoRef.current;
				if (cancelled || !video) {
					for (const track of media.getTracks()) {
						track.stop();
					}
					return;
				}
				video.srcObject = media;
				await video.play();
				timer = setInterval(() => void scanFrame(), SCAN_INTERVAL_MS);
			})
			.catch(() => setCameraDenied(true));

		return () => {
			cancelled = true;
			clearInterval(timer);
			for (const track of stream?.getTracks() ?? []) {
				track.stop();
			}
		};
	}, [eventId]);

	if (cameraDenied) {
		return <p className="text-destructive">{admin_scan_camera_denied()}</p>;
	}

	return (
		<div className="flex flex-col gap-4">
			<p className="text-muted-foreground">{admin_scan_hint()}</p>
			<video
				ref={videoRef}
				className="aspect-square w-full max-w-md rounded-lg bg-black object-cover"
				muted
				playsInline
			/>
			{result ? (
				<p
					role="status"
					className={`rounded-lg border-2 p-4 text-lg font-semibold ${RESULT_STYLES[result.kind]}`}
				>
					{result.message}
				</p>
			) : null}
		</div>
	);
}
