import { cn } from "@repo/ui/utils";
import type * as React from "react";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
	return (
		<textarea
			data-slot="textarea"
			className={cn(
				"flex field-sizing-content min-h-16 w-full border border-input bg-white px-3 py-2 text-base transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-navy focus-visible:shadow-[3px_3px_0_0_var(--green)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-sm",
				className,
			)}
			{...props}
		/>
	);
}

export { Textarea };
