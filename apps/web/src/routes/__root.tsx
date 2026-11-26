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
import { HumanCheckProvider } from "@repo/ui/composed/auth/human-check";
import { Header } from "@repo/ui/composed/header";
import { HydrationMarker } from "@repo/ui/composed/hydration-marker";
import { NavigationMarker } from "@repo/ui/composed/navigation-marker";
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
import { SiteFooter } from "~/components/site-footer";

function NotFound() {
	return (
		<div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
			<h1 className="text-3xl">{not_found_title()}</h1>
			<Link to="/" className="text-primary hover:underline">
				{go_home()}
			</Link>
		</div>
	);
}

function ErrorComponent({ error }: { error: unknown }) {
	return (
		<div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8">
			<h1 className="text-2xl text-destructive">{error_title()}</h1>
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
				<NavigationMarker />
			</>
		);
	}
	return (
		<>
			<ReactQueryDevtools buttonPosition="bottom-right" />
			<Header user={user} />
			<Outlet />
			<SiteFooter />
			<Toaster />
			<HydrationMarker />
			<NavigationMarker />
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
				<HumanCheckProvider>{children}</HumanCheckProvider>
				<Scripts />
			</body>
		</html>
	);
}
