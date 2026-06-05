import {
	header_admin_subtitle,
	header_brand,
} from "@repo/i18n/paraglide/messages";
import { cn } from "@repo/ui/utils";
import { LogoMark, type LogoMarkSize } from "./logo-mark";

export interface AdminLogoProps {
	size?: LogoMarkSize;
	className?: string;
	badgeClassName?: string;
	textClassName?: string;
	showText?: boolean;
}

export function AdminLogo({
	size = "md",
	className,
	badgeClassName,
	textClassName,
	showText = true,
}: AdminLogoProps) {
	return (
		<div className={cn("flex items-center gap-3", className)}>
			<LogoMark size={size} className={badgeClassName} />
			{showText ? (
				<div className={cn("min-w-0 leading-tight", textClassName)}>
					<p className="truncate text-sm font-semibold tracking-wide text-foreground">
						{header_brand()}
					</p>
					<p className="truncate text-xs text-muted-foreground">
						{header_admin_subtitle()}
					</p>
				</div>
			) : null}
		</div>
	);
}
