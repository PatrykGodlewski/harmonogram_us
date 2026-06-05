/// <reference types="vite/client" />

import { ensureCurrentUser } from "@repo/api/auth/current-user-query";
import { syncDocumentLocale } from "@repo/i18n/localization/sync-document-locale";
import {
	error_title,
	go_home,
	not_found_title,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import { createStudentsRootDocumentHead } from "@repo/router-utils/metadata/students-root-document-head";
import { Toaster } from "@repo/ui/components/sonner";
import { Header } from "@repo/ui/composed/header";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
	createRootRouteWithContext,
	HeadContent,
	Link,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import appCss from "~/app.css?url";
import { EventSeatCountsSync } from "~/components/event-seat-counts-sync";

function NotFound() {
	return (
		<div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
			<h1 className="text-2xl font-bold">{not_found_title()}</h1>
			<Link to="/" className="text-primary hover:underline">
				{go_home()}
			</Link>
		</div>
	);
}

function ErrorComponent({ error }: { error: unknown }) {
	return (
		<div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8">
			<h1 className="text-xl font-bold text-red-600">{error_title()}</h1>
			<p className="text-muted-foreground">
				{error instanceof Error ? error.message : String(error)}
			</p>
			<Link to="/" className="text-primary hover:underline">
				{go_home()}
			</Link>
		</div>
	);
}

export const Route = createRootRouteWithContext<{
	queryClient: QueryClient;
}>()({
	notFoundComponent: NotFound,
	errorComponent: ErrorComponent,
	beforeLoad: async ({ context: { queryClient } }) => {
		syncDocumentLocale();
		const user = await ensureCurrentUser(queryClient);
		return { user };
	},
	shellComponent: RootDocument,
	head: createStudentsRootDocumentHead(appCss),
	component: RootComponent,
});

function RootComponent() {
	const { user } = Route.useRouteContext();
	return (
		<>
			<EventSeatCountsSync />
			<ReactQueryDevtools buttonPosition="bottom-right" />
			<Header user={user} />
			<Outlet />
			<Toaster />
		</>
	);
}

function RootDocument({ children }: { children: ReactNode }) {
	return (
		<html lang={getLocale()} suppressHydrationWarning>
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	);
}
