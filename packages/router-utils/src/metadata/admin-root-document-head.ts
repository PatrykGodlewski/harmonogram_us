import { title_document_admin } from "@repo/i18n/paraglide/messages";
import { createRootDocumentHead } from "./create-root-document-head";

export function createAdminRootDocumentHead(stylesheetHref: string) {
	return createRootDocumentHead({
		title: title_document_admin,
		stylesheetHref,
	});
}
