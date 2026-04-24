import { useAppSession } from "@repo/api/auth/session";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

const logoutFn = createServerFn().handler(async () => {
	const session = await useAppSession();
	await session.clear();
	throw redirect({ to: "/" });
});

export const Route = createFileRoute("/logout")({
	loader: () => logoutFn(),
});
