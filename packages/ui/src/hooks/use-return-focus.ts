import * as React from "react";

type FocusEvents = {
	onOpenAutoFocus?: (event: Event) => void;
	onCloseAutoFocus?: (event: Event) => void;
};

/**
 * Radix dialogs give focus back only to their own Trigger, so a dialog opened from
 * state (a button that sets `open`) drops focus to the page on close (WCAG 2.4.3).
 * Remember what had focus when the dialog opened and return there.
 */
export function useReturnFocus({
	onOpenAutoFocus,
	onCloseAutoFocus,
}: FocusEvents): Required<FocusEvents> {
	const opener = React.useRef<HTMLElement | null>(null);
	return {
		onOpenAutoFocus: (event) => {
			// Runs before focus moves into the dialog: the opener still has it.
			const active = document.activeElement;
			opener.current = active instanceof HTMLElement ? active : null;
			onOpenAutoFocus?.(event);
		},
		onCloseAutoFocus: (event) => {
			onCloseAutoFocus?.(event);
			const target = opener.current;
			if (event.defaultPrevented || !target?.isConnected) return;
			event.preventDefault();
			target.focus();
		},
	};
}
