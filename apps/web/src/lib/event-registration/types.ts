export type RegistrationMutationResult = {
	txid?: number;
};

export type RegistrationChangeMessage = {
	eventId: string;
	seatDelta: number;
	txid?: number;
	registered?: boolean;
};

export type RegisteredEventsMutationContext = {
	previousRegisteredIds: string[] | undefined;
};

export type EventRegistrationActions = {
	isRegistered: (eventId: string) => boolean;
	isRegisterPending: (eventId: string) => boolean;
	isUnregisterPending: (eventId: string) => boolean;
	register: (eventId: string) => void;
	unregister: (eventId: string) => void;
};
