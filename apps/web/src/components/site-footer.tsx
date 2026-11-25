import {
	footer_accessibility,
	footer_privacy,
	footer_title,
	header_client_subtitle,
	home_title,
} from "@repo/i18n/paraglide/messages";
import { Checkerboard } from "@repo/ui/composed/brand/checkerboard";
import { Link } from "@tanstack/react-router";

const linkClass =
	"underline-offset-4 outline-none hover:underline focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-green";

/** Navy footer: pixel art on a ruled grid, the links in a framed cell. */
export function SiteFooter() {
	return (
		<footer className="mt-16 border-t border-navy bg-navy text-green print:hidden">
			<div className="grid md:grid-cols-[2fr_3fr]">
				<Checkerboard
					columns={14}
					rows={8}
					animated
					className="h-36 w-full md:h-full"
				/>
				<div className="bg-grid p-6 [--grid-line:#00d47f55] [--grid-size:32px] sm:p-10">
					<div className="flex flex-col gap-4 border border-green bg-navy p-5">
						<p className="font-mono text-xs font-bold tracking-widest uppercase">
							{footer_title()}
						</p>
						<ul className="flex flex-col gap-2 font-mono text-sm">
							<li>
								<Link to="/privacy" className={linkClass}>
									{footer_privacy()}
								</Link>
							</li>
							<li>
								<Link to="/accessibility" className={linkClass}>
									{footer_accessibility()}
								</Link>
							</li>
						</ul>
					</div>
				</div>
			</div>
			<div className="flex flex-wrap justify-between gap-2 border-t border-green px-6 py-4 font-mono text-sm">
				<span>{home_title()}</span>
				<span>{header_client_subtitle()}</span>
			</div>
		</footer>
	);
}
