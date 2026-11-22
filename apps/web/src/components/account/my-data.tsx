import {
	deleteMyAccountServer,
	exportMyDataServer,
} from "@repo/api/auth/account-data";
import {
	account_data_body,
	account_data_delete,
	account_data_delete_body,
	account_data_delete_confirm_label,
	account_data_delete_submit,
	account_data_delete_title,
	account_data_deleted,
	account_data_export,
	account_data_title,
	error_title,
	groups_cancel,
} from "@repo/i18n/paraglide/messages";
import { appErrorMessage } from "@repo/ui/app-errors";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@repo/ui/components/alert-dialog";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useId, useState } from "react";
import { toast } from "sonner";

/** Download everything we keep about you, or delete the account (GDPR). */
export function MyData({ email }: { email: string }) {
	const headingId = useId();
	const confirmId = useId();
	const [confirmEmail, setConfirmEmail] = useState("");
	const navigate = useNavigate();
	const router = useRouter();
	const queryClient = useQueryClient();

	const exportMutation = useMutation({
		mutationFn: () => exportMyDataServer(),
		onSuccess: (data) => {
			const url = URL.createObjectURL(
				new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
			);
			const link = document.createElement("a");
			link.href = url;
			link.download = "moje-dane.json";
			link.click();
			setTimeout(() => URL.revokeObjectURL(url), 0);
		},
		onError: (error) => toast.error(appErrorMessage(error, error_title)),
	});

	const deleteMutation = useMutation({
		mutationFn: () => deleteMyAccountServer({ data: { confirmEmail } }),
		onSuccess: async () => {
			toast.success(account_data_deleted());
			queryClient.clear();
			await router.invalidate();
			await navigate({ to: "/" });
		},
		onError: (error) => toast.error(appErrorMessage(error, error_title)),
	});

	const matches = confirmEmail.trim().toLowerCase() === email.toLowerCase();

	return (
		<section aria-labelledby={headingId} className="mt-6 rounded-lg border p-4">
			<h2 id={headingId} className="mb-2 text-lg font-semibold">
				{account_data_title()}
			</h2>
			<p className="mb-4 text-sm text-muted-foreground">
				{account_data_body()}
			</p>
			<div className="flex flex-col gap-2 sm:flex-row">
				<Button
					variant="outline"
					onClick={() => exportMutation.mutate()}
					disabled={exportMutation.isPending}
				>
					{account_data_export()}
				</Button>
				<AlertDialog onOpenChange={(open) => !open && setConfirmEmail("")}>
					<AlertDialogTrigger asChild>
						<Button variant="destructive">{account_data_delete()}</Button>
					</AlertDialogTrigger>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>{account_data_delete_title()}</AlertDialogTitle>
							<AlertDialogDescription>
								{account_data_delete_body()}
							</AlertDialogDescription>
						</AlertDialogHeader>
						<div className="flex flex-col gap-2">
							<Label htmlFor={confirmId}>
								{account_data_delete_confirm_label()}
							</Label>
							<Input
								id={confirmId}
								type="email"
								autoComplete="off"
								placeholder={email}
								value={confirmEmail}
								onChange={(event) => setConfirmEmail(event.target.value)}
							/>
						</div>
						<AlertDialogFooter>
							<AlertDialogCancel>{groups_cancel()}</AlertDialogCancel>
							<Button
								variant="destructive"
								disabled={!matches || deleteMutation.isPending}
								onClick={() => deleteMutation.mutate()}
							>
								{account_data_delete_submit()}
							</Button>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</div>
		</section>
	);
}
