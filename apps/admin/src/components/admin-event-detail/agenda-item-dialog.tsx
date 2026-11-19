import {
	createAdminAgendaItemServer,
	updateAdminAgendaItemServer,
} from "@repo/api/admin/mutations";
import type { AgendaItem, FilterOption } from "@repo/api/admin/queries";
import {
	admin_dialog_add_title,
	admin_dialog_edit_title,
	admin_error_end_before_start,
	admin_error_generic,
	admin_event_agenda_item,
	admin_field_date,
	admin_field_description,
	admin_field_end_time,
	admin_field_none,
	admin_field_requires_registration,
	admin_field_room,
	admin_field_seat_limit,
	admin_field_seat_limit_hint,
	admin_field_start_time,
	admin_field_title,
	admin_save_success,
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
import {
	fromEventWallTime,
	toEventDateInput,
	toEventTimeInput,
} from "@repo/ui/time";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { formatFieldError } from "../../lib/format-field-error";
import { formatMutationError } from "../../lib/format-mutation-error";

const NONE_VALUE = "__none__";

const agendaItemFormSchema = z
	.object({
		title: z.string().min(1).max(500),
		description: z.string().max(5000),
		date: z.string().min(1),
		startTime: z.string().min(1),
		endTime: z.string().min(1),
		locationId: z.string(),
		maxSeats: z.string().regex(/^\d*$/),
		requiresRegistration: z.boolean(),
	})
	.refine(
		(value) =>
			fromEventWallTime(value.date, value.endTime) >
			fromEventWallTime(value.date, value.startTime),
		{ path: ["endTime"], message: admin_error_end_before_start() },
	);

type AgendaItemFormValues = z.infer<typeof agendaItemFormSchema>;

function toFormValues(
	item: AgendaItem | null,
	eventDate: Date,
): AgendaItemFormValues {
	if (!item) {
		return {
			title: "",
			description: "",
			date: toEventDateInput(eventDate),
			startTime: "",
			endTime: "",
			locationId: NONE_VALUE,
			maxSeats: "",
			requiresRegistration: true,
		};
	}
	const startsAt = new Date(item.startsAt);
	return {
		title: item.title,
		description: item.description ?? "",
		date: toEventDateInput(startsAt),
		startTime: toEventTimeInput(startsAt),
		endTime: toEventTimeInput(new Date(item.endsAt)),
		locationId: item.locationId ?? NONE_VALUE,
		maxSeats: item.maxSeats === null ? "" : String(item.maxSeats),
		requiresRegistration: item.requiresRegistration,
	};
}

type AgendaItemDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	eventId: string;
	eventDate: Date;
	item: AgendaItem | null;
	locations: FilterOption[];
	onSaved: () => Promise<unknown>;
};

export function AgendaItemDialog({
	open,
	onOpenChange,
	eventId,
	eventDate,
	item,
	locations,
	onSaved,
}: AgendaItemDialogProps) {
	const saveMutation = useMutation({
		mutationFn: (values: AgendaItemFormValues) => {
			const payload = {
				title: values.title,
				description: values.description.trim() || null,
				startsAt: fromEventWallTime(values.date, values.startTime),
				endsAt: fromEventWallTime(values.date, values.endTime),
				locationId: values.locationId === NONE_VALUE ? null : values.locationId,
				maxSeats: values.maxSeats === "" ? null : Number(values.maxSeats),
				requiresRegistration: values.requiresRegistration,
			};
			return item
				? updateAdminAgendaItemServer({ data: { id: item.id, ...payload } })
				: createAdminAgendaItemServer({ data: { eventId, ...payload } });
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
		defaultValues: toFormValues(item, eventDate),
		validators: { onSubmit: agendaItemFormSchema },
		onSubmit: ({ value }) => {
			saveMutation.mutate(value);
		},
	});

	useEffect(() => {
		if (open) {
			form.reset(toFormValues(item, eventDate));
		}
	}, [open, item, eventDate, form]);

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
				item
					? admin_dialog_edit_title({ entity: admin_event_agenda_item() })
					: admin_dialog_add_title({ entity: admin_event_agenda_item() })
			}
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

			<form.Field name="maxSeats">
				{(field) => (
					<div>
						<Label htmlFor={field.name}>{admin_field_seat_limit()}</Label>
						<Input
							id={field.name}
							type="number"
							inputMode="numeric"
							min={0}
							className="mt-1"
							placeholder={admin_field_seat_limit_hint()}
							disabled={disabled}
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
						/>
						{fieldError(field.state.meta.errors)}
					</div>
				)}
			</form.Field>

			<form.Field name="requiresRegistration">
				{(field) => (
					<label className="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							className="size-4"
							disabled={disabled}
							checked={field.state.value}
							onChange={(event) => field.handleChange(event.target.checked)}
						/>
						{admin_field_requires_registration()}
					</label>
				)}
			</form.Field>

			<form.Field name="description">
				{(field) => (
					<div>
						<Label htmlFor={field.name}>{admin_field_description()}</Label>
						<Textarea
							id={field.name}
							className="mt-1"
							rows={3}
							disabled={disabled}
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
						/>
					</div>
				)}
			</form.Field>
		</AdminFormDialog>
	);
}
