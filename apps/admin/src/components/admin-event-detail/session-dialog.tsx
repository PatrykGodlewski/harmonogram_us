import type { AgendaSession, FilterOption } from "@repo/api/admin/queries";
import {
	createAgendaSessionServer,
	updateAgendaSessionServer,
} from "@repo/api/admin/sessions";
import {
	admin_dialog_add_title,
	admin_dialog_edit_title,
	admin_error_end_before_start,
	admin_error_generic,
	admin_field_date,
	admin_field_description,
	admin_field_end_time,
	admin_field_none,
	admin_field_room,
	admin_field_start_time,
	admin_field_time_required,
	admin_field_title,
	admin_save_success,
	admin_session_color,
	admin_session_color_amber,
	admin_session_color_blue,
	admin_session_color_green,
	admin_session_color_rose,
	admin_session_color_slate,
	admin_session_color_violet,
	admin_session_entity,
	admin_session_hint,
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
import { Textarea } from "@repo/ui/components/textarea";
import { AdminFormDialog } from "@repo/ui/composed/admin/admin-form-dialog";
import { SESSION_COLORS, sessionColorClasses } from "@repo/ui/session-colors";
import {
	fromEventWallTime,
	toEventDateInput,
	toEventTimeInput,
} from "@repo/ui/time";
import { cn } from "@repo/ui/utils";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { formatFieldError } from "../../lib/format-field-error";
import { formatMutationError } from "../../lib/format-mutation-error";

const NONE_VALUE = "__none__";

type AgendaSessionColor = AgendaSession["color"];

export const sessionColorLabel: Record<AgendaSessionColor, () => string> = {
	slate: admin_session_color_slate,
	blue: admin_session_color_blue,
	green: admin_session_color_green,
	amber: admin_session_color_amber,
	rose: admin_session_color_rose,
	violet: admin_session_color_violet,
};

const sessionFormSchema = z
	.object({
		title: z.string().trim().min(1).max(200),
		description: z.string().max(2000),
		color: z.enum(SESSION_COLORS),
		date: z.string().min(1),
		startTime: z.string().min(1, { error: () => admin_field_time_required() }),
		endTime: z.string().min(1, { error: () => admin_field_time_required() }),
		locationId: z.string(),
	})
	.refine(
		(value) =>
			!value.date ||
			!value.startTime ||
			!value.endTime ||
			fromEventWallTime(value.date, value.endTime) >
				fromEventWallTime(value.date, value.startTime),
		{ path: ["endTime"], message: admin_error_end_before_start() },
	);

type SessionFormValues = z.infer<typeof sessionFormSchema>;

function toFormValues(
	session: AgendaSession | null,
	eventDate: Date,
): SessionFormValues {
	if (!session) {
		return {
			title: "",
			description: "",
			color: "blue",
			date: toEventDateInput(eventDate),
			startTime: "",
			endTime: "",
			locationId: NONE_VALUE,
		};
	}
	const startsAt = new Date(session.startsAt);
	return {
		title: session.title,
		description: session.description ?? "",
		color: session.color,
		date: toEventDateInput(startsAt),
		startTime: toEventTimeInput(startsAt),
		endTime: toEventTimeInput(new Date(session.endsAt)),
		locationId: session.locationId ?? NONE_VALUE,
	};
}

type SessionDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	eventId: string;
	eventDate: Date;
	session: AgendaSession | null;
	locations: FilterOption[];
	onSaved: () => Promise<unknown>;
};

/** Adds or edits a session of the programme (F33). */
export function SessionDialog({
	open,
	onOpenChange,
	eventId,
	eventDate,
	session,
	locations,
	onSaved,
}: SessionDialogProps) {
	const saveMutation = useMutation({
		mutationFn: (values: SessionFormValues) => {
			const payload = {
				title: values.title.trim(),
				description: values.description.trim() || null,
				color: values.color,
				startsAt: fromEventWallTime(values.date, values.startTime),
				endsAt: fromEventWallTime(values.date, values.endTime),
				locationId: values.locationId === NONE_VALUE ? null : values.locationId,
			};
			return session
				? updateAgendaSessionServer({ data: { id: session.id, ...payload } })
				: createAgendaSessionServer({ data: { eventId, ...payload } });
		},
		onSuccess: async () => {
			await onSaved();
			onOpenChange(false);
			toast.success(admin_save_success());
		},
		onError: (error) => {
			toast.error(formatMutationError(error, admin_error_generic));
		},
	});

	const form = useForm({
		defaultValues: toFormValues(session, eventDate),
		validators: { onSubmit: sessionFormSchema },
		onSubmit: ({ value }) => {
			saveMutation.mutate(value);
		},
	});

	// Start from the session only when the dialog opens, not on background refetches.
	const wasOpen = useRef(false);
	useEffect(() => {
		if (open && !wasOpen.current) {
			form.reset(toFormValues(session, eventDate));
		}
		wasOpen.current = open;
	}, [open, session, eventDate, form]);

	const disabled = saveMutation.isPending;
	const fieldError = (errors: unknown[]) =>
		errors.length > 0 ? (
			<FormMessage>{formatFieldError(errors[0])}</FormMessage>
		) : null;

	return (
		<AdminFormDialog
			open={open}
			onOpenChange={onOpenChange}
			title={
				session
					? admin_dialog_edit_title({ entity: admin_session_entity() })
					: admin_dialog_add_title({ entity: admin_session_entity() })
			}
			description={admin_session_hint()}
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

			<form.Field name="description">
				{(field) => (
					<div>
						<Label htmlFor={field.name}>{admin_field_description()}</Label>
						<Textarea
							id={field.name}
							className="mt-1"
							rows={2}
							disabled={disabled}
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
						/>
						{fieldError(field.state.meta.errors)}
					</div>
				)}
			</form.Field>

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

			<div className="grid grid-cols-2 gap-3">
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
				<form.Field name="endTime">
					{(field) => (
						<div>
							<Label htmlFor={field.name}>{admin_field_end_time()}</Label>
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

			<form.Field name="color">
				{(field) => (
					<div>
						<Label htmlFor={field.name}>{admin_session_color()}</Label>
						<Select
							value={field.state.value}
							onValueChange={(value) =>
								field.handleChange(value as AgendaSessionColor)
							}
							disabled={disabled}
						>
							<SelectTrigger id={field.name} className="mt-1 w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{SESSION_COLORS.map((color) => (
									<SelectItem key={color} value={color}>
										<span
											aria-hidden
											className={cn(
												"inline-block size-3 rounded-full",
												sessionColorClasses[color].bar,
											)}
										/>
										{sessionColorLabel[color]()}
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
