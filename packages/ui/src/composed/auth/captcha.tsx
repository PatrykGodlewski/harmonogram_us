import { Turnstile } from "@marsidev/react-turnstile";
import { useIsMobile } from "../../hooks/use-mobile";

/**
 * Cloudflare Turnstile. Phones get the compact widget: the normal one is 300 px wide
 * and would make the page scroll sideways at 320 px (WCAG 1.4.10).
 */
export function Captcha({
	siteKey,
	onToken,
}: {
	siteKey: string;
	onToken: (token: string | null) => void;
}) {
	const size = useIsMobile() ? "compact" : "normal";
	return (
		<div className="flex justify-center">
			<Turnstile
				// The widget reads its size once: a new size needs a new widget.
				key={size}
				siteKey={siteKey}
				options={{ appearance: "always", size }}
				onSuccess={onToken}
				onExpire={() => onToken(null)}
				onError={() => onToken(null)}
			/>
		</div>
	);
}
