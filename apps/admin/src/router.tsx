import { createParaglideRouterRewrite } from "@repo/router-utils/paraglide-router-rewrite";
import { getAppErrorCode } from "@repo/ui/app-errors";
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				// An app error (forbidden, not found) is an answer, not a glitch: don't retry it.
				retry: (failureCount, error) =>
					getAppErrorCode(error) === null && failureCount < 3,
			},
		},
	});

	const router = createRouter({
		routeTree,
		context: { queryClient },
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		rewrite: createParaglideRouterRewrite(),
	});

	setupRouterSsrQueryIntegration({ router, queryClient });

	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
