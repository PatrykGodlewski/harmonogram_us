import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { authClient } from "../lib/auth-client";

export const Route = createFileRoute("/logout")({
	component: AdminLogoutPage,
});

function AdminLogoutPage() {
	const router = useRouter();

	useEffect(() => {
		void authClient.signOut().finally(() => {
			router.navigate({ to: "/login", search: { redirect: undefined } });
		});
	}, [router]);

	return null;
}
