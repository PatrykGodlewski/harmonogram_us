import type { ReactNode } from "react";
import { cn } from "../utils";

export type PageHeaderProps = {
	title: ReactNode;
	description?: ReactNode;
	className?: string;
};

export function PageHeader({ title, description, className }: PageHeaderProps) {
	return (
		<div className={cn("space-y-1", className)}>
			<h1 className="text-2xl font-bold tracking-tight">{title}</h1>
			{description ? (
				<p className="text-muted-foreground">{description}</p>
			) : null}
		</div>
	);
}
