import type { ReactNode } from "react";
import { cn } from "../utils";

export type PageHeaderProps = {
	title: ReactNode;
	description?: ReactNode;
	className?: string;
};

export function PageHeader({ title, description, className }: PageHeaderProps) {
	return (
		<div className={cn("space-y-2 border-b border-navy pb-4", className)}>
			<h1 className="animate-pixel-reveal text-2xl sm:text-3xl">{title}</h1>
			{description ? (
				<p className="font-mono text-sm text-muted-foreground">{description}</p>
			) : null}
		</div>
	);
}
