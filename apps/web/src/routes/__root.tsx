/// <reference types="vite/client" />

import { ensureCurrentUser } from "@repo/api/auth/current-user-query";
import { syncDocumentLocale } from "@repo/i18n/localization/sync-document-locale";
import {
	error_title,
	footer_accessibility,
	footer_privacy,
	go_home,
	not_found_title,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import { createStudentsRootDocumentHead } from "@repo/router-utils/metadata/students-root-document-head";
import { Toaster } from "@repo/ui/components/sonner";
import { Header } from "@repo/ui/composed/header";
import { HydrationMarker } from "@repo/ui/composed/hydration-marker";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
	createRootRouteWithContext,
	HeadContent,
	Link,
	Outlet,
	Scripts,
	useMatch,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import appCss from "~/app.css?url";

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
	// The embeddable widget (F24) is only its list: no site chrome.
	const isWidget = useMatch({ from: "/widget", shouldThrow: false });
	if (isWidget) {
		return (
			<>
				<Outlet />
				<HydrationMarker />
			</>
		);
	}
	return (
		<>
			<ReactQueryDevtools buttonPosition="bottom-right" />
			<Header user={user} />
			<Outlet />
			<footer className="mx-auto flex w-full max-w-4xl flex-wrap gap-x-4 gap-y-1 px-4 py-6 text-sm text-muted-foreground">
				<Link to="/privacy" className="underline underline-offset-2">
					{footer_privacy()}
				</Link>
				<Link to="/accessibility" className="underline underline-offset-2">
					{footer_accessibility()}
				</Link>
			</footer>
			<Toaster />
			<HydrationMarker />
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
