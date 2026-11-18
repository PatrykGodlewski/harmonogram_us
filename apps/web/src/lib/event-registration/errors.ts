import { appErrorMessage } from "@repo/ui/app-errors";
import { toast } from "sonner";

/** Toast for a failed registration action: the code's message, else the raw message, else `fallback`. */
export function showRegistrationErrorToast(
	error: unknown,
	fallbackMessage: () => string,
) {
	toast.error(
		appErrorMessage(error, () =>
			error instanceof Error && error.message
				? error.message
				: fallbackMessage(),
		),
	);
}
