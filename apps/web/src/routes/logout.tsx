import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { authClient } from "~/lib/auth-client";

export const Route = createFileRoute("/logout")({
	component: LogoutPage,
});

function LogoutPage() {
	const router = useRouter();

	useEffect(() => {
		void authClient.signOut().finally(() => {
			void router.invalidate().finally(() => {
				router.navigate({ to: "/" });
			});
		});
	}, [router]);

	return null;
}
