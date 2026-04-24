import { deLocalizeUrl, localizeUrl } from "@repo/i18n/paraglide/runtime";

function withSearchAndHash(from: URL, to: URL): URL {
	const next = new URL(to.href);
	next.search = from.search;
	next.hash = from.hash;
	return next;
}

/**
 * TanStack Router rewrite pair: browser URLs carry `/en/...` or `/pl/...`;
 * the route tree stays locale-free (`/`, `/login`, …).
 *
 * @see https://inlang.com/m/gerre34r/library-inlang-paraglideJs
 * @see https://tanstack.com/router/latest/docs/framework/react/guide/url-rewrites
 */
export function createParaglideRouterRewrite() {
	return {
		input: ({ url }: { url: URL }) => {
			const delocalized = deLocalizeUrl(url.href);
			return withSearchAndHash(url, delocalized);
		},
		output: ({ url }: { url: URL }) => {
			const localized = localizeUrl(url.href);
			return withSearchAndHash(url, localized);
		},
	};
}
