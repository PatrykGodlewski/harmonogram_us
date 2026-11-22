/** @jsxRuntime automatic */
/** @jsxImportSource react */
// Explicit so the templates compile the same under every runner (tsx in the worker applies its tsconfig only to its own files).
import {
	Body,
	Button,
	Container,
	Head,
	Html,
	Preview,
	Section,
	Text,
} from "@react-email/components";
import {
	guest_confirm_button,
	guest_email_ignore,
	guest_email_intro,
	guest_email_subject,
} from "@repo/i18n/paraglide/messages";

export type GuestConfirmationEmailProps = {
	url: string;
	eventTitle: string;
	locale: "pl" | "en";
};

/** Subject and text of the "confirm your registration" message sent to a guest (F17). */
export function guestConfirmationEmail({
	url,
	eventTitle,
	locale,
}: GuestConfirmationEmailProps): { subject: string; text: string } {
	return {
		subject: guest_email_subject({ title: eventTitle }, { locale }),
		text: `${guest_email_intro({ title: eventTitle }, { locale })}\n\n${url}\n\n${guest_email_ignore({}, { locale })}`,
	};
}

export function GuestConfirmationEmail({
	url,
	eventTitle,
	locale,
}: GuestConfirmationEmailProps) {
	return (
		<Html>
			<Head />
			<Preview>
				{guest_email_subject({ title: eventTitle }, { locale })}
			</Preview>
			<Body
				style={{ backgroundColor: "#f3f4f6", margin: "0", padding: "24px 0" }}
			>
				<Container
					style={{
						maxWidth: "560px",
						margin: "0 auto",
						padding: "0 20px",
						fontFamily: "Arial, sans-serif",
						color: "#111827",
					}}
				>
					<Section
						style={{
							backgroundColor: "#ffffff",
							border: "1px solid #d1d5db",
							borderRadius: "12px",
							padding: "24px",
						}}
					>
						<Text
							style={{
								fontSize: "16px",
								lineHeight: "24px",
								margin: "0 0 16px",
							}}
						>
							{guest_email_intro({ title: eventTitle }, { locale })}
						</Text>
						<Button
							href={url}
							style={{
								backgroundColor: "#0f2a56",
								color: "#ffffff",
								borderRadius: "8px",
								padding: "12px 20px",
								fontSize: "15px",
								fontWeight: "700",
								textDecoration: "none",
							}}
						>
							{guest_confirm_button({}, { locale })}
						</Button>
						<Text
							style={{ fontSize: "13px", color: "#4b5563", margin: "16px 0 0" }}
						>
							{guest_email_ignore({}, { locale })}
						</Text>
					</Section>
				</Container>
			</Body>
		</Html>
	);
}
