import {
	header_client_subtitle,
	home_title,
} from "@repo/i18n/paraglide/messages";
import { cn } from "@repo/ui/utils";
import { LogoMark, type LogoMarkSize } from "./logo-mark";

export interface ClientLogoProps {
	size?: LogoMarkSize;
	className?: string;
	badgeClassName?: string;
	textClassName?: string;
	showText?: boolean;
}

export function ClientLogo({
	size = "md",
	className,
	badgeClassName,
	textClassName,
	showText = true,
}: ClientLogoProps) {
	return (
		<div className={cn("flex min-w-0 items-center gap-3", className)}>
			<LogoMark size={size} className={badgeClassName} />
			{showText ? (
				<div className={cn("min-w-0 leading-tight", textClassName)}>
					<p className="truncate font-pixel text-base leading-none">
						{home_title()}
					</p>
					<p className="truncate font-mono text-[11px] tracking-widest uppercase opacity-80">
						{header_client_subtitle()}
					</p>
				</div>
			) : null}
		</div>
	);
}
