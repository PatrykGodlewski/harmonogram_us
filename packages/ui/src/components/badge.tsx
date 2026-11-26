import { cn } from "@repo/ui/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

const badgeVariants = cva(
	"inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden border border-navy px-2 py-0.5 font-mono text-xs font-bold whitespace-nowrap transition-[color,box-shadow] outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-navy aria-invalid:border-destructive [&>svg]:pointer-events-none [&>svg]:size-3",
	{
		variants: {
			variant: {
				default: "bg-navy text-manela",
				secondary: "bg-cream text-navy",
				destructive: "bg-destructive text-white [a&]:hover:bg-destructive/90",
				outline: "bg-white text-navy [a&]:hover:bg-purple",
				ghost: "border-transparent [a&]:hover:bg-purple",
				link: "text-primary underline-offset-4 [a&]:hover:underline",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

function Badge({
	className,
	variant = "default",
	asChild = false,
	...props
}: React.ComponentProps<"span"> &
	VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
	const Comp = asChild ? Slot.Root : "span";

	return (
		<Comp
			data-slot="badge"
			data-variant={variant}
			className={cn(badgeVariants({ variant }), className)}
			{...props}
		/>
	);
}

export { Badge, badgeVariants };
