import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { type UniversitySignIn, universitySignIn } from "./university";

/** Sign-in methods beyond e-mail: they are configuration, not code. */
export const fetchUniversitySignInServer = createServerFn({
	method: "GET",
}).handler(async (): Promise<UniversitySignIn> => universitySignIn());

export const universitySignInQueryOptions = queryOptions({
	queryKey: ["university-sign-in"] as const,
	queryFn: () => fetchUniversitySignInServer(),
	staleTime: Number.POSITIVE_INFINITY,
});
