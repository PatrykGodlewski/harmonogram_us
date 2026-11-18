import {
	groups_join_link,
	groups_join_link_copied,
	groups_join_link_copy,
	groups_join_link_disable,
	groups_join_link_enable,
	groups_join_link_regenerate,
} from "@repo/i18n/paraglide/messages";
import { localizeHref } from "@repo/i18n/paraglide/runtime";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type JoinLinkCardProps = {
	joinCode: string | null;
	disabled: boolean;
	onChange: (action: "enable" | "disable" | "regenerate") => void;
};

export function JoinLinkCard({
	joinCode,
	disabled,
	onChange,
}: JoinLinkCardProps) {
	const [url, setUrl] = useState<string | null>(null);
	const [qr, setQr] = useState<string | null>(null);

	// The full URL (origin + locale) is only known in the browser.
	useEffect(() => {
		if (!joinCode) {
			setUrl(null);
			setQr(null);
			return;
		}
		const absolute = new URL(
			localizeHref(`/join/${joinCode}`),
			window.location.origin,
		).toString();
		setUrl(absolute);
		void QRCode.toDataURL(absolute, { margin: 1, width: 240 }).then(setQr);
	}, [joinCode]);

	const handleCopy = async () => {
		if (!url) return;
		await navigator.clipboard.writeText(url);
		toast.success(groups_join_link_copied());
	};

	return (
		<section className="flex flex-col gap-3 rounded-lg border p-4">
			<h2 className="font-semibold">{groups_join_link()}</h2>
			{joinCode && url ? (
				<>
					<div className="flex flex-col gap-2 sm:flex-row">
						<Input readOnly value={url} aria-label={groups_join_link()} />
						<Button type="button" variant="outline" onClick={handleCopy}>
							{groups_join_link_copy()}
						</Button>
					</div>
					{qr ? (
						<img
							src={qr}
							alt=""
							width={160}
							height={160}
							className="self-start rounded border"
						/>
					) : null}
					<div className="flex flex-wrap gap-2">
						<Button
							type="button"
							size="sm"
							variant="outline"
							disabled={disabled}
							onClick={() => onChange("regenerate")}
						>
							{groups_join_link_regenerate()}
						</Button>
						<Button
							type="button"
							size="sm"
							variant="outline"
							disabled={disabled}
							onClick={() => onChange("disable")}
						>
							{groups_join_link_disable()}
						</Button>
					</div>
				</>
			) : (
				<Button
					type="button"
					size="sm"
					className="self-start"
					disabled={disabled}
					onClick={() => onChange("enable")}
				>
					{groups_join_link_enable()}
				</Button>
			)}
		</section>
	);
}
