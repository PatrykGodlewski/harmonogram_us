import {
	getSurveyForRegistration,
	submitSurvey,
} from "@repo/db/queries/surveys";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { appError, withDomainErrors } from "../errors";
import { isSurveyTokenValid } from "./link";

const linkSchema = z.object({
	registrationId: z.string().min(1).max(100),
	token: z.string().max(200),
});

export type SurveyQuestion = {
	id: string;
	label: string;
	kind: "text" | "choice" | "yesno" | "rating";
	options: string[];
	required: boolean;
};

/** What the survey link opens; "invalid" covers a wrong link and a registration with no survey alike. */
export type SurveyPage =
	| { status: "invalid" }
	| {
			status: "open" | "answered" | "closed";
			eventTitle: string;
			questions: SurveyQuestion[];
	  };

/** The survey behind a signed e-mail link (F20); the token is checked before any lookup. */
export const fetchSurveyServer = createServerFn({ method: "GET" })
	.validator((input: unknown) => linkSchema.parse(input))
	.handler(async ({ data }): Promise<SurveyPage> => {
		if (!isSurveyTokenValid(data.registrationId, data.token)) {
			return { status: "invalid" };
		}
		const survey = await getSurveyForRegistration(data.registrationId);
		if (!survey) {
			return { status: "invalid" };
		}
		return {
			status: survey.status,
			eventTitle: survey.eventTitle,
			questions: survey.questions.map(
				({ id, label, kind, options, required }) => ({
					id,
					label,
					kind,
					options,
					required,
				}),
			),
		};
	});

export const surveyQueryOptions = (registrationId: string, token: string) =>
	queryOptions({
		queryKey: ["survey", registrationId, token] as const,
		queryFn: () => fetchSurveyServer({ data: { registrationId, token } }),
	});

const submitSchema = linkSchema.extend({
	answers: z.record(z.string().max(100), z.string().max(2000)),
});

/** Stores the answers once; anonymous (the answers keep no link to the person). */
export const submitSurveyServer = createServerFn({ method: "POST" })
	.validator((input: unknown) => submitSchema.parse(input))
	.handler(async ({ data }) => {
		if (!isSurveyTokenValid(data.registrationId, data.token)) {
			throw appError("SURVEY_LINK_INVALID");
		}
		await withDomainErrors(() =>
			submitSurvey(data.registrationId, data.answers),
		);
		return { ok: true as const };
	});
