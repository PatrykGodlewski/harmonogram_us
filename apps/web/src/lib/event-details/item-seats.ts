import type { AgendaItemData, ItemSeatCount } from "./types";

/** An item's own seats; without a limit of its own it is never full (`docs/data-flows.md`). */
export function itemSeatCount(item: AgendaItemData): ItemSeatCount {
	return {
		seatsRemaining: item.seatsRemaining,
		maxSeats: item.maxSeats,
		registeredCount: item.registeredCount,
	};
}

export function isItemFull(seatCount: ItemSeatCount): boolean {
	return seatCount.seatsRemaining !== null && seatCount.seatsRemaining <= 0;
}
