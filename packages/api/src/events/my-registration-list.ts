import {
	listMyRegistrations,
	type MyRegistrationListItem,
} from "@repo/db/queries/my-registrations";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getCurrentUser } from "../auth/user";

export const fetchMyRegistrationListServer = createServerFn({
	method: "GET",
}).handler(async (): Promise<MyRegistrationListItem[]> => {
	const user = await getCurrentUser();
	return user ? listMyRegistrations(user.id) : [];
});

/** The signed-in user's registrations with event details, for the account page. */
export const myRegistrationListQueryOptions = queryOptions({
	queryKey: ["my-registration-list"] as const,
	queryFn: () => fetchMyRegistrationListServer(),
	staleTime: 30_000,
});
