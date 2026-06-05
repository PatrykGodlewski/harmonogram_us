import { cn } from "@repo/ui/utils";

export type LogoMarkSize = "sm" | "md";

const markSizeClasses: Record<LogoMarkSize, string> = {
	sm: "size-8 text-sm",
	md: "h-10 w-10",
};

export interface LogoMarkProps {
	size?: LogoMarkSize;
	className?: string;
}

export function LogoMark({ size = "md", className }: LogoMarkProps) {
	return (
		<span
			className={cn(
				"flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary",
				markSizeClasses[size],
				className,
			)}
		>
			H
		</span>
	);
}
