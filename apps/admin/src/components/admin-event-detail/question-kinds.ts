import type { EventQuestion } from "@repo/api/admin/questions";
import {
	questions_kind_choice,
	questions_kind_rating,
	questions_kind_text,
	questions_kind_yesno,
} from "@repo/i18n/paraglide/messages";

export const QUESTION_KIND_LABELS: Record<EventQuestion["kind"], () => string> =
	{
		text: questions_kind_text,
		choice: questions_kind_choice,
		yesno: questions_kind_yesno,
		rating: questions_kind_rating,
	};
