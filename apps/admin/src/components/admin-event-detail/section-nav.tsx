import { admin_sections } from "@repo/i18n/paraglide/messages";
import { cn } from "@repo/ui/utils";
import { useEffect, useState } from "react";

export type PageSection = { id: string; label: string };

/** The section whose top last passed the upper part of the screen. */
function useCurrentSection(ids: string[]): string | undefined {
	const [current, setCurrent] = useState<string | undefined>(ids[0]);
	const key = ids.join(" ");
	useEffect(() => {
		const visible = new Set<string>();
		// After a jump the page is still settling: the jump's target wins for a moment.
		let jumpedAt = 0;
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) visible.add(entry.target.id);
					else visible.delete(entry.target.id);
				}
				const first = key.split(" ").find((id) => visible.has(id));
				if (first && Date.now() - jumpedAt > 1000) setCurrent(first);
			},
			{ rootMargin: "-80px 0px -55% 0px" },
		);
		for (const id of key.split(" ")) {
			const element = document.getElementById(id);
			if (element) observer.observe(element);
		}
		// A jump marks its target, even one too low on the page to reach the top.
		const handleHashChange = () => {
			const id = window.location.hash.slice(1);
			if (key.split(" ").includes(id)) {
				jumpedAt = Date.now();
				setCurrent(id);
			}
		};
		window.addEventListener("hashchange", handleHashChange);
		return () => {
			observer.disconnect();
			window.removeEventListener("hashchange", handleHashChange);
		};
	}, [key]);
	return current;
}

/** A sticky row of links to the page's sections; the one in view is marked. */
export function SectionNav({ sections }: { sections: PageSection[] }) {
	const current = useCurrentSection(sections.map((section) => section.id));
	return (
		<nav
			aria-label={admin_sections()}
			className="sticky top-0 z-30 -mx-6 -mt-6 border-b border-navy bg-manela/95 px-6 backdrop-blur"
		>
			<ul className="flex gap-1 overflow-x-auto py-2">
				{sections.map((section) => (
					<li key={section.id} className="shrink-0">
						<a
							href={`#${section.id}`}
							aria-current={current === section.id ? "true" : undefined}
							className={cn(
								"block border border-transparent px-3 py-1.5 font-mono text-xs font-bold tracking-wider uppercase outline-none hover:border-navy focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-navy",
								current === section.id && "border-navy bg-lime",
							)}
						>
							{section.label}
						</a>
					</li>
				))}
			</ul>
		</nav>
	);
}
