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
		<div className={cn("flex items-center gap-3", className)}>
			<LogoMark size={size} className={badgeClassName} />
			{showText ? (
				<div className={cn("min-w-0 leading-tight", textClassName)}>
					<p className="truncate text-sm font-semibold tracking-wide text-foreground">
						{home_title()}
					</p>
					<p className="truncate text-xs text-muted-foreground">
						{header_client_subtitle()}
					</p>
				</div>
			) : null}
		</div>
	);
}
