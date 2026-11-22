import type { AgendaSession, FilterOption } from "@repo/api/admin/queries";
import { copyAgendaSessionServer } from "@repo/api/admin/sessions";
import {
	admin_error_generic,
	admin_field_date,
	admin_field_none,
	admin_field_room,
	admin_field_start_time,
	admin_field_time_required,
	admin_field_title,
	admin_session_copied,
	admin_session_copy,
	admin_session_copy_hint,
	admin_session_copy_title,
} from "@repo/i18n/paraglide/messages";
import { FormMessage } from "@repo/ui/components/form-message";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { AdminFormDialog } from "@repo/ui/composed/admin/admin-form-dialog";
import {
	fromEventWallTime,
	toEventDateInput,
	toEventTimeInput,
} from "@repo/ui/time";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { formatFieldError } from "../../lib/format-field-error";
import { formatMutationError } from "../../lib/format-mutation-error";

const NONE_VALUE = "__none__";

const copyFormSchema = z.object({
	title: z.string().trim().min(1).max(200),
	date: z.string().min(1),
	startTime: z.string().min(1, { error: () => admin_field_time_required() }),
	locationId: z.string(),
});

type CopyFormValues = z.infer<typeof copyFormSchema>;

function toFormValues(session: AgendaSession | null): CopyFormValues {
	const startsAt = session ? new Date(session.startsAt) : new Date();
	return {
		title: session?.title ?? "",
		date: toEventDateInput(startsAt),
		startTime: toEventTimeInput(startsAt),
		locationId: session?.locationId ?? NONE_VALUE,
	};
}

type SessionCopyDialogProps = {
	session: AgendaSession | null;
	onOpenChange: (open: boolean) => void;
	locations: FilterOption[];
	onCopied: () => Promise<unknown>;
};

/** Copies a session with its programme to a new start time and, optionally, place. */
export function SessionCopyDialog({
	session,
	onOpenChange,
	locations,
	onCopied,
}: SessionCopyDialogProps) {
	const open = session !== null;
	const copyMutation = useMutation({
		mutationFn: (values: CopyFormValues) =>
			copyAgendaSessionServer({
				data: {
					id: session?.id ?? "",
					title: values.title.trim(),
					startsAt: fromEventWallTime(values.date, values.startTime),
					locationId:
						values.locationId === NONE_VALUE ? null : values.locationId,
				},
			}),
		onSuccess: async () => {
			await onCopied();
			onOpenChange(false);
			toast.success(admin_session_copied());
		},
		onError: (error) => {
			toast.error(formatMutationError(error, admin_error_generic));
		},
	});

	const form = useForm({
		defaultValues: toFormValues(session),
		validators: { onSubmit: copyFormSchema },
		onSubmit: ({ value }) => {
			copyMutation.mutate(value);
		},
	});

	const wasOpen = useRef(false);
	useEffect(() => {
		if (open && !wasOpen.current) {
			form.reset(toFormValues(session));
		}
		wasOpen.current = open;
	}, [open, session, form]);

	const disabled = copyMutation.isPending;
	const fieldError = (errors: unknown[]) =>
		errors.length > 0 ? (
			<FormMessage>{formatFieldError(errors[0])}</FormMessage>
		) : null;

	return (
		<AdminFormDialog
			open={open}
			onOpenChange={onOpenChange}
			title={admin_session_copy_title()}
			description={admin_session_copy_hint()}
			submitLabel={admin_session_copy()}
			onSubmit={() => {
				void form.handleSubmit();
			}}
			isSubmitting={disabled}
		>
			<form.Field name="title">
				{(field) => (
					<div>
						<Label htmlFor={field.name}>{admin_field_title()}</Label>
						<Input
							id={field.name}
							className="mt-1"
							disabled={disabled}
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
						/>
						{fieldError(field.state.meta.errors)}
					</div>
				)}
			</form.Field>
			<div className="grid grid-cols-2 gap-3">
				<form.Field name="date">
					{(field) => (
						<div>
							<Label htmlFor={field.name}>{admin_field_date()}</Label>
							<Input
								id={field.name}
								type="date"
								className="mt-1"
								disabled={disabled}
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
							/>
							{fieldError(field.state.meta.errors)}
						</div>
					)}
				</form.Field>
				<form.Field name="startTime">
					{(field) => (
						<div>
							<Label htmlFor={field.name}>{admin_field_start_time()}</Label>
							<Input
								id={field.name}
								type="time"
								className="mt-1"
								disabled={disabled}
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
							/>
							{fieldError(field.state.meta.errors)}
						</div>
					)}
				</form.Field>
			</div>
			<form.Field name="locationId">
				{(field) => (
					<div>
						<Label htmlFor={field.name}>{admin_field_room()}</Label>
						<Select
							value={field.state.value}
							onValueChange={(value) => field.handleChange(value)}
							disabled={disabled}
						>
							<SelectTrigger id={field.name} className="mt-1 w-full">
								<SelectValue placeholder={admin_field_room()} />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE_VALUE}>{admin_field_none()}</SelectItem>
								{locations.map((option) => (
									<SelectItem key={option.id} value={option.id}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				)}
			</form.Field>
		</AdminFormDialog>
	);
}
