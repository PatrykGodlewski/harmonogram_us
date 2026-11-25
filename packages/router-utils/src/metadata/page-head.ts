import {
	title_document_admin,
	title_document_students,
} from "@repo/i18n/paraglide/messages";

type PageHead = { meta: Array<{ title: string }> };

/** WCAG 2.4.2: every page names itself first, then the site. */
export function studentsPageHead(page: string): PageHead {
	return { meta: [{ title: `${page} · ${title_document_students()}` }] };
}

export function adminPageHead(page: string): PageHead {
	return { meta: [{ title: `${page} · ${title_document_admin()}` }] };
}

/** What a shared link shows (Open Graph). */
export type SharePreview = { title: string; description: string; url: string };

/** A public page's title plus its link preview. */
export function sharePreviewHead(preview: SharePreview) {
	return {
		meta: [
			...studentsPageHead(preview.title).meta,
			{ name: "description", content: preview.description },
			{ property: "og:type", content: "website" },
			{ property: "og:title", content: preview.title },
			{ property: "og:description", content: preview.description },
			{ property: "og:url", content: preview.url },
		],
	};
}
