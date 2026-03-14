/// <reference types="vite/client" />

import { createRootRoute, HeadContent, Link, Outlet, Scripts } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import appCss from '~/app.css?url';

function NotFound() {
	return (
		<div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
			<h1 className="text-2xl font-bold">Page not found</h1>
			<Link to="/" className="text-primary hover:underline">
				Go home
			</Link>
		</div>
	);
}

function ErrorComponent({ error }: { error: unknown }) {
	return (
		<div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8">
			<h1 className="text-xl font-bold text-red-600">Something went wrong</h1>
			<p className="text-muted-foreground">
				{error instanceof Error ? error.message : String(error)}
			</p>
			<Link to="/" className="text-primary hover:underline">
				Go home
			</Link>
		</div>
	);
}

export const Route = createRootRoute({
	notFoundComponent: NotFound,
	errorComponent: ErrorComponent,
	head: () => ({
		meta: [
			{ charSet: 'utf-8' },
			{ name: 'viewport', content: 'width=device-width, initial-scale=1' },
			{ title: 'University Event Registration | Admin' },
		],
		links: [{ rel: 'stylesheet', href: appCss }],
	}),
	component: RootComponent,
});

function RootComponent() {
	return (
		<RootDocument>
			<Outlet />
		</RootDocument>
	);
}

function RootDocument({ children }: { children: ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head suppressHydrationWarning>
				<HeadContent />
			</head>
			<body suppressHydrationWarning>
				{children}
				<Scripts />
			</body>
		</html>
	);
}
