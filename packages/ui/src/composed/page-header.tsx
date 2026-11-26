import type { ReactNode } from "react";
import { cn } from "../utils";
import { PixelHeading } from "./brand/pixel-heading";

export type PageHeaderProps = {
	title: ReactNode;
	description?: ReactNode;
	className?: string;
};

export function PageHeader({ title, description, className }: PageHeaderProps) {
	return (
		<div className={cn("space-y-2 border-b border-navy pb-4", className)}>
			<PixelHeading level={1} className="text-2xl sm:text-3xl">
				{title}
			</PixelHeading>
			{description ? (
				<p className="font-mono text-sm text-muted-foreground">{description}</p>
			) : null}
		</div>
	);
}
