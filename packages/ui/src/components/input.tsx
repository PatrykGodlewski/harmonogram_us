import { Eye, EyeOff } from "lucide-react";
import * as React from "react";
import { cn } from "../utils";
import { Button } from "./button";

type InputProps = React.ComponentProps<"input"> & {
	containerClassName?: string;
};

function Input({ className, containerClassName, type, ...props }: InputProps) {
	const [showPassword, setShowPassword] = React.useState(false);
	const isPasswordField = type === "password";
	if (!isPasswordField) {
		return (
			<input
				type={type}
				data-slot="input"
				className={cn(
					"flex h-10 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
					className,
				)}
				{...props}
			/>
		);
	}

	return (
		<div className={cn("relative", containerClassName)}>
			<input
				type={showPassword ? "text" : "password"}
				data-slot="input"
				className={cn(
					"flex h-10 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-2 pr-10 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
					className,
				)}
				{...props}
			/>
			<Button
				type="button"
				variant="inputIcon"
				size="icon"
				className="absolute top-1/2 right-1 h-8 w-8 -translate-y-1/2"
				disabled={props.disabled}
				onClick={() => setShowPassword((visible) => !visible)}
				aria-label={showPassword ? "Hide password" : "Show password"}
			>
				{showPassword ? <EyeOff /> : <Eye />}
			</Button>
		</div>
	);
}

export { Input };
