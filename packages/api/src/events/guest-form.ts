import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { loadGuestForm } from "./guest-form-load";
import { eventPageSchema } from "./schemas";

/** What the sign-in page needs to register someone for an event without an account (F17). */
export type GuestForm = {
	eventId: string;
	title: string;
	questions: {
		id: string;
		label: string;
		kind: "text" | "choice" | "yesno" | "rating";
		options: string[];
		required: boolean;
	}[];
};

export const fetchGuestFormServer = createServerFn({ method: "GET" })
	.validator((input: unknown) => eventPageSchema.parse(input))
	.handler(({ data }) => loadGuestForm(data.eventId, data.invite));

export const guestFormQueryOptions = (eventId: string, invite?: string) =>
	queryOptions({
		queryKey: ["guest-form", eventId, invite ?? null] as const,
		queryFn: () => fetchGuestFormServer({ data: { eventId, invite } }),
		staleTime: 60_000,
	});
