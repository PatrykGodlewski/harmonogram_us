import * as React from "react";

export function useInFlightActions() {
	const inFlightRef = React.useRef(new Set<string>());
	const [inFlightIds, setInFlightIds] = React.useState(() => new Set<string>());

	const syncInFlightState = React.useCallback(() => {
		setInFlightIds(new Set(inFlightRef.current));
	}, []);

	const isInFlight = React.useCallback(
		(actionId: string) => inFlightIds.has(actionId),
		[inFlightIds],
	);

	const runExclusive = React.useCallback(
		(actionId: string, action: () => void) => {
			if (inFlightRef.current.has(actionId)) {
				return false;
			}

			inFlightRef.current.add(actionId);
			syncInFlightState();
			action();
			return true;
		},
		[syncInFlightState],
	);

	const finish = React.useCallback(
		(actionId: string) => {
			inFlightRef.current.delete(actionId);
			syncInFlightState();
		},
		[syncInFlightState],
	);

	return { isInFlight, runExclusive, finish };
}
