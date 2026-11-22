import { and, asc, desc, eq, gt, lt, max, notInArray } from "drizzle-orm";
import { db } from "../client";
import {
	eventQuestions,
	type QuestionForm,
	type QuestionKind,
	registrationAnswers,
} from "../schema/event-questions";
import { surveyAnswers } from "../schema/surveys";
import { DomainError } from "./domain-errors";

export type EventQuestion = {
	id: string;
	eventId: string;
	form: QuestionForm;
	label: string;
	kind: QuestionKind;
	options: string[];
	required: boolean;
	position: number;
};

export type EventQuestionInput = {
	/** Registration form (default) or the survey after the event. */
	form?: QuestionForm;
	label: string;
	kind: QuestionKind;
	options?: string[];
	required?: boolean;
};

const columns = {
	id: eventQuestions.id,
	eventId: eventQuestions.eventId,
	form: eventQuestions.form,
	label: eventQuestions.label,
	kind: eventQuestions.kind,
	options: eventQuestions.options,
	required: eventQuestions.required,
	position: eventQuestions.position,
};

/** Trimmed, distinct options for a choice (at least two); none for other kinds. */
function normalizeOptions(
	kind: QuestionKind,
	options: string[] = [],
): string[] {
	if (kind !== "choice") {
		return [];
	}
	const distinct = [
		...new Set(options.map((option) => option.trim()).filter(Boolean)),
	];
	if (distinct.length < 2) {
		throw new DomainError("QUESTION_OPTIONS");
	}
	return distinct;
}

/** A rating only makes sense in a survey. */
function assertKindFits(kind: QuestionKind, form: QuestionForm): void {
	if (kind === "rating" && form !== "survey") {
		throw new DomainError("QUESTION_KIND");
	}
}

export async function listEventQuestions(
	eventId: string,
	form: QuestionForm,
): Promise<EventQuestion[]> {
	return db
		.select(columns)
		.from(eventQuestions)
		.where(
			and(eq(eventQuestions.eventId, eventId), eq(eventQuestions.form, form)),
		)
		.orderBy(asc(eventQuestions.position), asc(eventQuestions.createdAt));
}

export async function getQuestionEventId(
	questionId: string,
): Promise<string | null> {
	const [row] = await db
		.select({ eventId: eventQuestions.eventId })
		.from(eventQuestions)
		.where(eq(eventQuestions.id, questionId));
	return row?.eventId ?? null;
}

/** Adds a question at the end of the event's list for its form. */
export async function createEventQuestion(
	input: EventQuestionInput & { eventId: string },
): Promise<EventQuestion> {
	const form = input.form ?? "registration";
	assertKindFits(input.kind, form);
	const options = normalizeOptions(input.kind, input.options);
	return db.transaction(async (tx) => {
		const [last] = await tx
			.select({ position: max(eventQuestions.position) })
			.from(eventQuestions)
			.where(
				and(
					eq(eventQuestions.eventId, input.eventId),
					eq(eventQuestions.form, form),
				),
			);
		const [row] = await tx
			.insert(eventQuestions)
			.values({
				eventId: input.eventId,
				form,
				label: input.label.trim(),
				kind: input.kind,
				options,
				required: input.required ?? false,
				position: (last?.position ?? -1) + 1,
			})
			.returning(columns);
		if (!row) {
			throw new DomainError("QUESTION_NOT_FOUND");
		}
		return row;
	});
}

/** Changes a question; answers already given stay while they still fit it. */
export async function updateEventQuestion(
	id: string,
	input: Partial<EventQuestionInput>,
): Promise<EventQuestion> {
	return db.transaction(async (tx) => {
		const [current] = await tx
			.select(columns)
			.from(eventQuestions)
			.where(eq(eventQuestions.id, id))
			.for("update");
		if (!current) {
			throw new DomainError("QUESTION_NOT_FOUND");
		}
		const kind = input.kind ?? current.kind;
		assertKindFits(kind, current.form);
		const [row] = await tx
			.update(eventQuestions)
			.set({
				...(input.label !== undefined ? { label: input.label.trim() } : {}),
				kind,
				options: normalizeOptions(kind, input.options ?? current.options),
				...(input.required !== undefined ? { required: input.required } : {}),
			})
			.where(eq(eventQuestions.id, id))
			.returning(columns);
		if (!row) {
			throw new DomainError("QUESTION_NOT_FOUND");
		}
		// Answers that no longer fit go: all of them on a new kind, others outside the new options.
		const answers = row.form === "survey" ? surveyAnswers : registrationAnswers;
		if (row.kind !== current.kind) {
			await tx.delete(answers).where(eq(answers.questionId, id));
		} else if (row.kind === "choice") {
			await tx
				.delete(answers)
				.where(
					and(
						eq(answers.questionId, id),
						notInArray(answers.value, row.options),
					),
				);
		}
		return row;
	});
}

/** Deletes a question and every answer to it. */
export async function deleteEventQuestion(id: string): Promise<void> {
	await db.delete(eventQuestions).where(eq(eventQuestions.id, id));
}

/** Swaps a question with its neighbour above or below (no-op at the ends). */
export async function moveEventQuestion(
	id: string,
	direction: "up" | "down",
): Promise<void> {
	await db.transaction(async (tx) => {
		const [current] = await tx
			.select(columns)
			.from(eventQuestions)
			.where(eq(eventQuestions.id, id))
			.for("update");
		if (!current) {
			throw new DomainError("QUESTION_NOT_FOUND");
		}
		const [neighbour] = await tx
			.select(columns)
			.from(eventQuestions)
			.where(
				and(
					eq(eventQuestions.eventId, current.eventId),
					eq(eventQuestions.form, current.form),
					direction === "up"
						? lt(eventQuestions.position, current.position)
						: gt(eventQuestions.position, current.position),
				),
			)
			.orderBy(
				direction === "up"
					? desc(eventQuestions.position)
					: asc(eventQuestions.position),
			)
			.limit(1)
			.for("update");
		if (!neighbour) {
			return;
		}
		await tx
			.update(eventQuestions)
			.set({ position: neighbour.position })
			.where(eq(eventQuestions.id, current.id));
		await tx
			.update(eventQuestions)
			.set({ position: current.position })
			.where(eq(eventQuestions.id, neighbour.id));
	});
}
