import { error_title } from "@repo/i18n/paraglide/messages";
import { Alert, AlertDescription } from "../../components/alert";

export function EventErrorAlert({ error }: { error: unknown }) {
	return (
		<Alert variant="destructive">
			<AlertDescription>
				{error instanceof Error ? error.message : error_title()}
			</AlertDescription>
		</Alert>
	);
}
