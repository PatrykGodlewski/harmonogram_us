import { parseEmailList } from "@repo/api/groups/parse-email-list";
import {
	groups_emails_count,
	groups_emails_invalid,
	groups_field_emails_hint,
} from "@repo/i18n/paraglide/messages";
import { Label } from "@repo/ui/components/label";
import { Textarea } from "@repo/ui/components/textarea";

type EmailListFieldProps = {
	id: string;
	label: string;
	value: string;
	onChange: (value: string) => void;
	disabled?: boolean;
};

/** Paste-friendly email list with live validation feedback. */
export function EmailListField({
	id,
	label,
	value,
	onChange,
	disabled,
}: EmailListFieldProps) {
	const { valid, invalid } = parseEmailList(value);
	return (
		<div className="flex flex-col gap-1">
			<Label htmlFor={id}>{label}</Label>
			<Textarea
				id={id}
				rows={5}
				value={value}
				disabled={disabled}
				placeholder="ania@example.com, jan@example.com"
				onChange={(event) => onChange(event.target.value)}
			/>
			<p className="text-sm text-muted-foreground">
				{groups_field_emails_hint()}
			</p>
			{value.trim() ? (
				<p className="text-sm">
					{groups_emails_count({ count: valid.length })}
					{invalid.length > 0 ? (
						<span className="text-destructive">
							{" · "}
							{groups_emails_invalid({ list: invalid.join(", ") })}
						</span>
					) : null}
				</p>
			) : null}
		</div>
	);
}
