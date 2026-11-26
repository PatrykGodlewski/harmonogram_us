import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "../utils";

const alertVariants = cva(
	"relative w-full border border-navy bg-background px-4 py-3 text-sm text-foreground [&>svg~*]:pl-7 [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4",
	{
		variants: {
			variant: {
				default: "",
				destructive: "border-destructive text-destructive",
				success: "bg-green",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

function Alert({
	className,
	variant,
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
	return (
		<div
			role="alert"
			className={cn(alertVariants({ variant }), className)}
			{...props}
		/>
	);
}

function AlertTitle({ className, ...props }: React.ComponentProps<"h5">) {
	return (
		<h5
			className={cn("mb-1 font-mono font-bold leading-none", className)}
			{...props}
		/>
	);
}

function AlertDescription({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			className={cn("text-sm [&_p]:leading-relaxed", className)}
			{...props}
		/>
	);
}

export { Alert, AlertDescription, AlertTitle };
