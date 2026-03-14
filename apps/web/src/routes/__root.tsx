/// <reference types="vite/client" />

import { useAppSession } from '@repo/api/auth/session';
import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import {
	createRootRouteWithContext,
	HeadContent,
	Link,
	Outlet,
	Scripts,
} from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import type { ReactNode } from 'react';
import appCss from '~/app.css?url';

const getCurrentUserFn = createServerFn({ method: 'GET' }).handler(async () => {
	const session = await useAppSession();
	const { userId, email } = session.data;
	if (!userId || !email) return null;
	return { id: userId, email };
});

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

export const Route = createRootRouteWithContext<{
	queryClient: QueryClient;
}>()({
	notFoundComponent: NotFound,
	errorComponent: ErrorComponent,
	beforeLoad: async () => {
		const user = await getCurrentUserFn();
		return { user };
	},
	shellComponent: RootDocument,
	head: () => ({
		meta: [
			{ charSet: 'utf-8' },
			{ name: 'viewport', content: 'width=device-width, initial-scale=1' },
			{ title: 'University Event Registration | Students' },
		],
		links: [{ rel: 'stylesheet', href: appCss }],
	}),
	component: RootComponent,
});

function RootComponent() {
	const { queryClient, user } = Route.useRouteContext();
	return (
		<QueryClientProvider client={queryClient}>
			<ReactQueryDevtools buttonPosition="bottom-right" />
			<nav className="flex items-center justify-between border-b px-6 py-4">
				<Link to="/" className="font-semibold">
					University Events
				</Link>
				<div className="flex gap-4">
					{user ? (
						<>
							<span className="text-muted-foreground">{user.email}</span>
							<Link to="/logout" className="text-primary hover:underline">
								Logout
							</Link>
						</>
					) : (
						<>
							<Link to="/login" className="text-primary hover:underline">
								Login
							</Link>
							<Link to="/signup" className="text-primary hover:underline">
								Sign up
							</Link>
						</>
					)}
				</div>
			</nav>
			<Outlet />
		</QueryClientProvider>
	);
}

function RootDocument({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
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
