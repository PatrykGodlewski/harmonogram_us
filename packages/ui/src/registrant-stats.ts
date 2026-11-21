import type { RegistrationState } from "@repo/db/schema/event-registrations";

export type RegistrantStats = {
	registered: number;
	/** Registered and checked in. */
	present: number;
	waitlisted: number;
	/** Waiting for the organiser's approval. */
	pending: number;
	/** Registered but not checked in; null until the event has ended. */
	absent: number | null;
	/** `absent / registered` (0–1); null until the end or when nobody registered. */
	absentShare: number | null;
};

/** The event's numbers for the organiser (F15), from the registrant list. */
export function registrantStats(
	registrants: {
		state: RegistrationState;
		checkedInAt: Date | string | null;
	}[],
	ended: boolean,
): RegistrantStats {
	const count = (state: RegistrationState) =>
		registrants.filter((registrant) => registrant.state === state).length;
	const registered = count("registered");
	const present = registrants.filter(
		(registrant) => registrant.state === "registered" && registrant.checkedInAt,
	).length;
	const absent = ended ? registered - present : null;
	return {
		registered,
		present,
		waitlisted: count("waitlisted"),
		pending: count("pending"),
		absent,
		absentShare: absent !== null && registered > 0 ? absent / registered : null,
	};
}
