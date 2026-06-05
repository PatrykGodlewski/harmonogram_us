/**
 * Routes that must bypass Paraglide locale redirects and URL rewriting.
 * Keep in sync with `paraglideVitePlugin({ routeStrategies })` and `scripts/compile-paraglide.mjs`.
 *
 * @type {import("@inlang/paraglide-js").CompilerOptions["routeStrategies"]}
 */
export const paraglideRouteStrategies = [
	{ match: "/@fs/:path(.*)?", exclude: true },
	{ match: "/@id/:path(.*)?", exclude: true },
	{ match: "/@vite/:path(.*)?", exclude: true },
	{ match: "/@react-refresh", exclude: true },
	{ match: "/src/:path(.*)?", exclude: true },
	{ match: "/node_modules/:path(.*)?", exclude: true },
	{ match: "/api/:path(.*)?", exclude: true },
];
