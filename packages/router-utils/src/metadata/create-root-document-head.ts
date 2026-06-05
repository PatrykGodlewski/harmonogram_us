type RootDocumentHead = {
	meta: Array<
		{ charSet: string } | { name: string; content: string } | { title: string }
	>;
	links: Array<{ rel: string; href: string }>;
};

export type RootDocumentHeadOptions = {
	title: () => string;
	stylesheetHref: string;
};

export function createRootDocumentHead({
	title,
	stylesheetHref,
}: RootDocumentHeadOptions): () => RootDocumentHead {
	return () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: String(title()) },
		],
		links: [{ rel: "stylesheet", href: stylesheetHref }],
	});
}
