import { cn } from "@repo/ui/utils";
import type * as React from "react";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
	return (
		<input
			type={type}
			data-slot="input"
			className={cn(
				"h-9 w-full min-w-0 border border-input bg-white px-3 py-1 text-base transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
				"focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-navy focus-visible:shadow-[3px_3px_0_0_var(--green)]",
				"aria-invalid:border-destructive",
				className,
			)}
			{...props}
		/>
	);
}

export { Input };
