import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { env } from "@repo/env/client";
import {
	error_captcha_cancelled,
	error_captcha_unavailable,
	human_check_body,
	human_check_cancel,
	human_check_title,
} from "@repo/i18n/paraglide/messages";
import {
	createContext,
	type KeyboardEvent,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useId,
	useRef,
	useState,
} from "react";
import { Button } from "../../components/button";
import { useIsMobile } from "../../hooks/use-mobile";
import { humanCheckError, runWithHumanCheck } from "../../human-check-run";
import { cn } from "../../utils";

/** Runs an action that needs proof of a human: `action` gets the Turnstile token. */
export type HumanCheck = <T>(
	action: (token: string | undefined) => Promise<T>,
) => Promise<T>;

/** How long a person may take on a visible challenge. */
const CHALLENGE_TIMEOUT_MS = 5 * 60_000;
/** How long to wait for the widget to load (a blocked script never does). */
const LOAD_TIMEOUT_MS = 15_000;

const HumanCheckContext = createContext<HumanCheck | null>(null);

const siteKey = env.VITE_TURNSTILE_SITE_KEY;

const unavailable = () =>
	humanCheckError("CAPTCHA_UNAVAILABLE", error_captcha_unavailable());

/**
 * One Turnstile widget for the app, run on demand: invisible for most people, shown as a
 * popup only while Cloudflare asks for interaction. The server verifies every token; when
 * it rejects one, the action runs once more with a fresh token (`runWithHumanCheck`).
 */
export function HumanCheckProvider({ children }: { children: ReactNode }) {
	const widget = useRef<TurnstileInstance>(null);
	const dialog = useRef<HTMLDivElement>(null);
	const returnFocus = useRef<HTMLElement | null>(null);
	const [interactive, setInteractive] = useState(false);
	const headingId = useId();
	const size = useIsMobile() ? "compact" : "normal";

	// Resolves once the widget has loaded: an action may start before the script arrives.
	const ready = useRef<{ promise: Promise<void>; resolve: () => void } | null>(
		null,
	);
	if (ready.current === null) {
		let resolve = () => {};
		const promise = new Promise<void>((done) => {
			resolve = done;
		});
		ready.current = { promise, resolve };
	}
	// Rejects the token request in flight (widget error, cancel).
	const pending = useRef<((error: Error) => void) | null>(null);

	const stop = useCallback((error: Error) => {
		pending.current?.(error);
		pending.current = null;
		widget.current?.reset();
		setInteractive(false);
	}, []);

	const freshToken = useCallback(async () => {
		await Promise.race([
			ready.current?.promise,
			new Promise((_, reject) =>
				setTimeout(() => reject(unavailable()), LOAD_TIMEOUT_MS),
			),
		]);
		const current = widget.current;
		if (!current) throw unavailable();
		current.reset();
		current.execute();
		return new Promise<string>((resolve, reject) => {
			pending.current = reject;
			current
				.getResponsePromise(CHALLENGE_TIMEOUT_MS)
				.then(resolve, reject)
				.finally(() => {
					pending.current = null;
					setInteractive(false);
				});
		});
	}, []);

	const run = useCallback<HumanCheck>(
		(action) =>
			siteKey ? runWithHumanCheck(freshToken, action) : action(undefined),
		[freshToken],
	);

	// The challenge takes the focus, gives it back when done.
	useEffect(() => {
		if (interactive) {
			returnFocus.current = document.activeElement as HTMLElement | null;
			dialog.current?.focus();
		} else {
			returnFocus.current?.focus();
			returnFocus.current = null;
		}
	}, [interactive]);

	const handleCancel = () =>
		stop(humanCheckError("CAPTCHA_CANCELLED", error_captcha_cancelled()));

	return (
		<HumanCheckContext.Provider value={run}>
			{/* While the challenge shows, the page behind it can't be reached. */}
			<div inert={interactive || undefined} className="contents">
				{children}
			</div>
			{siteKey ? (
				// Stays mounted (a moved widget restarts); only its frame changes when shown.
				<div
					{...(interactive
						? {
								role: "dialog",
								"aria-modal": true,
								"aria-labelledby": headingId,
								tabIndex: -1,
								onKeyDown: (event: KeyboardEvent) => {
									if (event.key === "Escape") handleCancel();
								},
							}
						: { inert: true })}
					ref={dialog}
					className={cn(
						interactive
							? "fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 outline-none"
							: "pointer-events-none fixed bottom-0 left-0 size-px overflow-hidden opacity-0",
					)}
				>
					<div
						className={cn(
							interactive &&
								"flex max-w-sm flex-col items-center gap-3 rounded-lg border bg-background p-6 text-center shadow-lg",
						)}
					>
						<h2
							id={headingId}
							hidden={!interactive}
							className="text-lg font-semibold"
						>
							{human_check_title()}
						</h2>
						<p hidden={!interactive} className="text-sm text-muted-foreground">
							{human_check_body()}
						</p>
						<Turnstile
							// The widget reads its size once: a new size needs a new widget.
							key={size}
							ref={widget}
							siteKey={siteKey}
							options={{
								execution: "execute",
								appearance: "interaction-only",
								size,
							}}
							onWidgetLoad={() => ready.current?.resolve()}
							onBeforeInteractive={() => setInteractive(true)}
							onAfterInteractive={() => setInteractive(false)}
							onError={() => stop(unavailable())}
							onUnsupported={() => stop(unavailable())}
							onTimeout={() => stop(unavailable())}
						/>
						<Button
							type="button"
							variant="outline"
							hidden={!interactive}
							onClick={handleCancel}
						>
							{human_check_cancel()}
						</Button>
					</div>
				</div>
			) : null}
		</HumanCheckContext.Provider>
	);
}

/** The app's human check; without a provider (or a site key) actions run without a token. */
export function useHumanCheck(): HumanCheck {
	return useContext(HumanCheckContext) ?? ((action) => action(undefined));
}
