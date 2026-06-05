import { title_document_students } from "@repo/i18n/paraglide/messages";
import { createRootDocumentHead } from "./create-root-document-head";

export function createStudentsRootDocumentHead(stylesheetHref: string) {
	return createRootDocumentHead({
		title: title_document_students,
		stylesheetHref,
	});
}
