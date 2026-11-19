import type { Ticket } from "@repo/api/events/ticket";
import {
	tickets_holder,
	tickets_print,
	tickets_qr_alt,
	tickets_show_at_entry,
	tickets_waitlisted,
} from "@repo/i18n/paraglide/messages";
import { getLocale } from "@repo/i18n/paraglide/runtime";
import { Button } from "@repo/ui/components/button";
import { formatEventDateTime } from "@repo/ui/time";
import QRCode from "qrcode";
import * as React from "react";

/** What the ticket's QR code encodes; an organiser's scanner reads it back. */
function ticketQrText(ticketCode: string): string {
	return `harmonogram-ticket:${ticketCode}`;
}

export function TicketCard({ ticket }: { ticket: Ticket }) {
	const locale = getLocale();
	const handlePrint = () => window.print();

	return (
		<article className="flex flex-col gap-4 rounded-lg border p-4 sm:p-6">
			<header className="flex flex-col gap-1">
				<h1 className="text-xl font-bold">{ticket.title}</h1>
				<p className="text-sm text-muted-foreground tabular-nums">
					{formatEventDateTime(ticket.date, locale)}
					{ticket.locationLabel ? ` · ${ticket.locationLabel}` : ""}
				</p>
			</header>
			<dl className="text-sm">
				<dt className="text-muted-foreground">{tickets_holder()}</dt>
				<dd className="font-medium">{ticket.holderName}</dd>
				<dd>{ticket.holderEmail}</dd>
			</dl>
			{ticket.state === "registered" ? (
				<>
					<TicketQr ticketCode={ticket.ticketCode} />
					<p className="text-center text-sm text-muted-foreground">
						{tickets_show_at_entry()}
					</p>
					<Button
						variant="outline"
						className="print:hidden"
						onClick={handlePrint}
					>
						{tickets_print()}
					</Button>
				</>
			) : (
				<p className="rounded-md bg-muted p-3 text-sm">
					{tickets_waitlisted()}
				</p>
			)}
		</article>
	);
}

function TicketQr({ ticketCode }: { ticketCode: string }) {
	const [src, setSrc] = React.useState<string | null>(null);
	React.useEffect(() => {
		void QRCode.toDataURL(ticketQrText(ticketCode), {
			margin: 2,
			width: 280,
		}).then(setSrc);
	}, [ticketCode]);

	return (
		<div className="flex justify-center">
			{src ? (
				<img
					src={src}
					alt={tickets_qr_alt()}
					width={280}
					height={280}
					className="rounded-md bg-white"
				/>
			) : (
				<div className="size-[280px] rounded-md bg-muted" aria-hidden="true" />
			)}
		</div>
	);
}
