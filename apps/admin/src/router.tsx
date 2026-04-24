import { createParaglideRouterRewrite } from "@repo/router-utils/paraglide-router-rewrite";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
	return createRouter({
		routeTree,
		scrollRestoration: true,
		rewrite: createParaglideRouterRewrite(),
	});
}
