import type { RegistrationChangeMessage } from "./types";

const CHANNEL_NAME = "harmonogram:event-registration-changes";

const tabId =
	typeof crypto !== "undefined" && "randomUUID" in crypto
		? crypto.randomUUID()
		: `tab-${Math.random().toString(36).slice(2)}`;

type CrossTabMessage = RegistrationChangeMessage & {
	sourceTabId: string;
};

export function publishRegistrationChange(message: RegistrationChangeMessage) {
	if (typeof BroadcastChannel === "undefined") {
		return;
	}

	const channel = new BroadcastChannel(CHANNEL_NAME);
	channel.postMessage({ ...message, sourceTabId: tabId });
	channel.close();
}

export function subscribeRegistrationChanges(
	handler: (message: RegistrationChangeMessage) => void,
) {
	if (typeof BroadcastChannel === "undefined") {
		return () => {};
	}

	const channel = new BroadcastChannel(CHANNEL_NAME);
	channel.onmessage = (event: MessageEvent<CrossTabMessage>) => {
		if (event.data.sourceTabId === tabId) {
			return;
		}

		const { sourceTabId: _sourceTabId, ...message } = event.data;
		handler(message);
	};

	return () => {
		channel.close();
	};
}
