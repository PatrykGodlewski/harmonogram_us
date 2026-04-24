export default {
	async fetch(request: Request) {
		const [{ paraglideMiddleware }, { default: startHandler }] =
			await Promise.all([
				import("@repo/i18n/paraglide/server"),
				import("@tanstack/react-start/server-entry"),
			]);
		return paraglideMiddleware(request, () => startHandler.fetch(request));
	},
};
