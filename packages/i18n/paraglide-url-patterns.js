/**
 * Shared Paraglide URL patterns: every locale (including base) is prefixed in the path.
 * Keep in sync with `paraglideVitePlugin({ urlPatterns })` and `scripts/compile-paraglide.mjs`.
 *
 * @type {import("@inlang/paraglide-js").CompilerOptions["urlPatterns"]}
 */
export const paraglideUrlPatterns = [
	{
		pattern: "/",
		localized: [
			["en", "/en"],
			["pl", "/pl"],
		],
	},
	{
		pattern: "/:path(.*)?",
		localized: [
			["en", "/en/:path(.*)?"],
			["pl", "/pl/:path(.*)?"],
		],
	},
];
