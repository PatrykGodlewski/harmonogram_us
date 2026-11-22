import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { authClient } from "~/lib/auth-client";

export const Route = createFileRoute("/logout")({
	component: LogoutPage,
});

function LogoutPage() {
	const router = useRouter();
	const queryClient = useQueryClient();

	useEffect(() => {
		void authClient.signOut().finally(() => {
			// Cached lists and pages may hold what only a signed-in person may see.
			queryClient.clear();
			void router.invalidate().finally(() => {
				router.navigate({ to: "/" });
			});
		});
	}, [router, queryClient]);

	return null;
}
