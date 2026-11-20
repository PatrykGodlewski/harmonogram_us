export type Approval = "pending" | "rejected" | null;

/** The approval state of a registration, if it is waiting for or was refused approval. */
export function approvalOf(state: string | undefined): Approval {
	return state === "pending" || state === "rejected" ? state : null;
}
