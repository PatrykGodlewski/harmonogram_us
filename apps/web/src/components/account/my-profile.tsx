import {
	profileQueryOptions,
	updateProfileServer,
} from "@repo/api/auth/profile";
import {
	error_title,
	profile_language,
	profile_language_hint,
	profile_name,
	profile_save,
	profile_saved,
	profile_title,
} from "@repo/i18n/paraglide/messages";
import { getLocale, setLocale } from "@repo/i18n/paraglide/runtime";
import { appErrorMessage } from "@repo/ui/app-errors";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import {
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";

type Locale = "pl" | "en";

/** Language names in their own language, so anyone finds theirs. */
const LANGUAGE_NAMES: Record<Locale, string> = { pl: "Polski", en: "English" };

/** Name and language; saving switches the site to the chosen language. */
export function MyProfile() {
	const headingId = useId();
	const nameId = useId();
	const languageId = useId();
	const hintId = useId();
	const queryClient = useQueryClient();
	const { data: profile } = useSuspenseQuery(profileQueryOptions);
	const [name, setName] = useState(profile?.name ?? "");
	const [locale, setLocaleChoice] = useState<Locale>(
		profile?.locale ?? (getLocale() as Locale),
	);

	const saveMutation = useMutation({
		mutationFn: () =>
			updateProfileServer({ data: { name: name.trim(), locale } }),
		onSuccess: async () => {
			toast.success(profile_saved({}, { locale }));
			await queryClient.invalidateQueries(profileQueryOptions);
			if (locale !== getLocale()) {
				await setLocale(locale);
			}
		},
		onError: (error) => toast.error(appErrorMessage(error, error_title)),
	});

	const handleSubmit = (event: FormEvent) => {
		event.preventDefault();
		if (name.trim()) {
			saveMutation.mutate();
		}
	};

	return (
		<section aria-labelledby={headingId} className="mt-6 rounded-lg border p-4">
			<h2 id={headingId} className="mb-4 text-lg font-semibold">
				{profile_title()}
			</h2>
			<form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:max-w-md">
				<div className="flex flex-col gap-2">
					<Label htmlFor={nameId}>{profile_name()}</Label>
					<Input
						id={nameId}
						required
						maxLength={120}
						autoComplete="name"
						value={name}
						onChange={(event) => setName(event.target.value)}
					/>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor={languageId}>{profile_language()}</Label>
					<Select
						value={locale}
						onValueChange={(value) => setLocaleChoice(value as Locale)}
					>
						<SelectTrigger
							id={languageId}
							className="w-full"
							aria-describedby={hintId}
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{(Object.keys(LANGUAGE_NAMES) as Locale[]).map((key) => (
								<SelectItem key={key} value={key} lang={key}>
									{LANGUAGE_NAMES[key]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<p id={hintId} className="text-xs text-muted-foreground">
						{profile_language_hint()}
					</p>
				</div>
				<Button
					type="submit"
					className="self-start"
					disabled={saveMutation.isPending}
				>
					{profile_save()}
				</Button>
			</form>
		</section>
	);
}
