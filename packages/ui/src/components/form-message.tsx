import type * as React from "react";
import { cn } from "../utils";

function FormMessage({ className, ...props }: React.ComponentProps<"p">) {
	return (
		<p
			role="alert"
			className={cn("text-destructive mt-1 text-xs", className)}
			{...props}
		/>
	);
}

export { FormMessage };
