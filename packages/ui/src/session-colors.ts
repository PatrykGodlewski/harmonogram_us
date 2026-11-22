import type { AgendaSessionColor } from "@repo/db/schema/agenda";

/** The colours a session can have, in the order the panel offers them. */
export const SESSION_COLORS = [
	"blue",
	"green",
	"amber",
	"rose",
	"violet",
	"slate",
] as const satisfies readonly AgendaSessionColor[];

/**
 * Classes per session colour: a solid bar (headings, legend) and a left border
 * (calendar blocks). Colour is never the only cue: titles are always shown.
 */
export const sessionColorClasses: Record<
	AgendaSessionColor,
	{ bar: string; border: string }
> = {
	slate: { bar: "bg-slate-500", border: "border-l-4 border-l-slate-500" },
	blue: { bar: "bg-blue-600", border: "border-l-4 border-l-blue-600" },
	green: { bar: "bg-green-600", border: "border-l-4 border-l-green-600" },
	amber: { bar: "bg-amber-500", border: "border-l-4 border-l-amber-500" },
	rose: { bar: "bg-rose-600", border: "border-l-4 border-l-rose-600" },
	violet: { bar: "bg-violet-600", border: "border-l-4 border-l-violet-600" },
};
