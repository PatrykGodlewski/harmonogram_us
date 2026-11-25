import { cn } from "@repo/ui/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

const buttonVariants = cva(
	"inline-flex shrink-0 items-center justify-center gap-2 rounded-none font-mono text-sm font-bold text-center transition-[transform,box-shadow,background-color] duration-100 ease-out outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-navy disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
	{
		variants: {
			variant: {
				default:
					"border border-navy bg-lime text-navy shadow-[0_3px_0_0_var(--navy)] hover:-translate-y-px hover:shadow-[0_4px_0_0_var(--navy)] active:translate-y-[3px] active:shadow-none",
				destructive:
					"border border-navy bg-destructive text-white shadow-[0_3px_0_0_var(--navy)] active:translate-y-[3px] active:shadow-none",
				outline:
					"border border-navy bg-white text-navy hover:bg-purple active:translate-y-px",
				secondary:
					"border border-navy bg-cream text-navy hover:bg-purple active:translate-y-px",
				ghost: "hover:bg-purple hover:text-navy",
				link: "text-primary underline-offset-4 hover:underline",
			},
			size: {
				default: "min-h-9 px-4 py-1.5 has-[>svg]:px-3",
				xs: "min-h-6 gap-1 px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
				sm: "min-h-8 gap-1.5 py-1 px-3 has-[>svg]:px-2.5",
				lg: "min-h-10 px-6 py-2 has-[>svg]:px-4",
				icon: "size-9",
				"icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
				"icon-sm": "size-8",
				"icon-lg": "size-10",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

function Button({
	className,
	variant = "default",
	size = "default",
	asChild = false,
	...props
}: React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
	}) {
	const Comp = asChild ? Slot.Root : "button";

	return (
		<Comp
			data-slot="button"
			data-variant={variant}
			data-size={size}
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
}

export { Button, buttonVariants };
