/** Domain error codes thrown by queries; the API passes them to the UI as `Error(code)`. */
export const DOMAIN_ERROR_CODES = [
	"EVENT_NOT_FOUND",
	"EVENT_FULL",
	"EVENT_ENDED",
	"EVENT_WAITLISTED",
	"ALREADY_REGISTERED",
	"NOT_REGISTERED",
	"ITEM_NOT_FOUND",
	"ITEM_FULL",
	"ITEM_NOT_REGISTRABLE",
	"ITEM_ENDED",
	"ITEM_LIMIT_ABOVE_EVENT",
	"END_BEFORE_START",
	"GROUP_PLACES_UNAVAILABLE",
	"GROUP_FULL",
	"GROUP_CLOSED",
	"GROUP_DEADLINE_PASSED",
	"GROUP_NOT_FOUND",
	"NOT_GROUP_OWNER",
	"INVITATION_INVALID",
	"EMAIL_NOT_VERIFIED",
	"ITEM_NOT_IN_GROUP",
	"MAX_SEATS_BELOW_REGISTERED",
	"USER_NOT_FOUND",
	"ALREADY_ORGANIZER",
	"LAST_ORGANIZER",
	"EVENT_INCOMPLETE",
	"EVENT_NOT_DRAFT",
	"EVENT_CANCELLED",
	"EVENT_ALREADY_CANCELLED",
] as const;

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

/** Codes raised outside the database layer (auth, permissions, abuse protection, input policy). */
export const TRANSPORT_ERROR_CODES = [
	"UNAUTHORIZED",
	"FORBIDDEN",
	"NOT_FOUND",
	"RATE_LIMITED",
	"CAPTCHA_REQUIRED",
	"CAPTCHA_FAILED",
	"EMAIL_NOT_ALLOWED",
] as const;

export type TransportErrorCode = (typeof TRANSPORT_ERROR_CODES)[number];

/**
 * Every error code the API sends to clients (as `Error(code)`). This module has
 * no imports so the UI can use it to map codes to messages.
 */
export type AppErrorCode = DomainErrorCode | TransportErrorCode;

const APP_ERROR_CODES: ReadonlySet<string> = new Set([
	...DOMAIN_ERROR_CODES,
	...TRANSPORT_ERROR_CODES,
]);

export function isAppErrorCode(value: unknown): value is AppErrorCode {
	return typeof value === "string" && APP_ERROR_CODES.has(value);
}

export class DomainError extends Error {
	constructor(
		readonly code: DomainErrorCode,
		message: string = code,
	) {
		super(message);
		this.name = "DomainError";
	}
}

/** Named database constraints whose violations have a domain meaning. */
const CONSTRAINTS = {
	eventSeats: "event_seat_counts_seats_remaining_nonnegative",
	itemSeats: "agenda_item_seat_counts_seats_remaining_nonnegative",
	itemTimes: "agenda_items_ends_after_starts",
	itemEventFk: "agenda_items_event_id_events_id_fk",
} as const;

type ConstraintKey = keyof typeof CONSTRAINTS;

/** What a violation means for the caller; `unique` covers any unique violation. */
export type ConstraintErrorMap = Partial<
	Record<ConstraintKey | "unique", DomainErrorCode>
>;

const DEFAULT_CONSTRAINT_ERRORS: Record<ConstraintKey, DomainErrorCode> = {
	eventSeats: "EVENT_FULL",
	itemSeats: "ITEM_FULL",
	itemTimes: "END_BEFORE_START",
	itemEventFk: "EVENT_NOT_FOUND",
};

/** Registering: a second registration for the same thing is "already registered". */
export const REGISTRATION_ERRORS: ConstraintErrorMap = {
	unique: "ALREADY_REGISTERED",
};

/** Editing capacity: a seat CHECK means the new limit is below who's registered. */
export const CAPACITY_EDIT_ERRORS: ConstraintErrorMap = {
	eventSeats: "MAX_SEATS_BELOW_REGISTERED",
	itemSeats: "MAX_SEATS_BELOW_REGISTERED",
};

/** Holding group places: a seat CHECK means there aren't enough free places. */
export const GROUP_HOLD_ERRORS: ConstraintErrorMap = {
	eventSeats: "GROUP_PLACES_UNAVAILABLE",
	itemSeats: "GROUP_PLACES_UNAVAILABLE",
};

type PgErrorFields = { code?: string; constraint_name?: string };

function findPgError(error: unknown): PgErrorFields | null {
	let current: unknown = error;
	while (current && typeof current === "object") {
		if ("constraint_name" in current || "severity" in current) {
			return current as PgErrorFields;
		}
		current = (current as { cause?: unknown }).cause;
	}
	return null;
}

/**
 * Translates database constraint violations into domain errors: the caller's
 * map first, then the defaults. Rethrows domain errors and anything unknown.
 */
export function mapConstraintError(
	error: unknown,
	errors: ConstraintErrorMap = {},
): never {
	if (error instanceof DomainError) {
		throw error;
	}
	const pg = findPgError(error);
	if (pg?.code === "23505" && errors.unique) {
		throw new DomainError(errors.unique);
	}
	const key = (Object.keys(CONSTRAINTS) as ConstraintKey[]).find(
		(candidate) => CONSTRAINTS[candidate] === pg?.constraint_name,
	);
	if (key && (pg?.code === "23514" || pg?.code === "23503")) {
		throw new DomainError(errors[key] ?? DEFAULT_CONSTRAINT_ERRORS[key]);
	}
	throw error;
}
