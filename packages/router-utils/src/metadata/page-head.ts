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
