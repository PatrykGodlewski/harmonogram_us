/** @jsxRuntime automatic */
/** @jsxImportSource react */
// Explicit so the templates compile the same under every runner (see registration-email.tsx).
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
	event_message_footer,
	event_message_subject,
	reg_email_button,
} from "@repo/i18n/paraglide/messages";

export type EventMessageEmailProps = {
	locale: "pl" | "en";
	eventTitle: string;
	subject: string;
	/** The organizer's text, shown as plain text (never as HTML). */
	body: string;
	url: string;
};

/** Paragraphs separated by blank lines. */
function paragraphs(body: string): string[] {
	return body
		.split(/\n\s*\n/)
		.map((paragraph) => paragraph.trim())
		.filter(Boolean);
}

/** Subject and plain-text body; the HTML version is EventMessageEmail. */
export function eventMessageEmailText(props: EventMessageEmailProps): {
	subject: string;
	text: string;
} {
	const { locale } = props;
	return {
		subject: event_message_subject(
			{ event: props.eventTitle, subject: props.subject },
			{ locale },
		),
		text: [
			props.body.trim(),
			props.url,
			event_message_footer({ event: props.eventTitle }, { locale }),
		].join("\n\n"),
	};
}

const text = { fontSize: "15px", lineHeight: "22px", margin: "0 0 12px" };

export function EventMessageEmail(props: EventMessageEmailProps) {
	const { locale } = props;
	return (
		<Html>
			<Head />
			<Preview>{props.subject}</Preview>
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
						{paragraphs(props.body).map((paragraph, index) => (
							// Static list: the index is a stable key (paragraphs may repeat).
							// biome-ignore lint/suspicious/noArrayIndexKey: static content
							<Text key={index} style={text}>
								{paragraph.split("\n").map((line, lineIndex) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: static content
									<span key={lineIndex}>
										{lineIndex > 0 ? <br /> : null}
										{line}
									</span>
								))}
							</Text>
						))}
						<Button
							href={props.url}
							style={{
								backgroundColor: "#0f2a56",
								color: "#ffffff",
								borderRadius: "8px",
								padding: "12px 20px",
								fontWeight: "700",
							}}
						>
							{reg_email_button({}, { locale })}
						</Button>
						<Text style={{ ...text, marginTop: "16px", color: "#6b7280" }}>
							{event_message_footer({ event: props.eventTitle }, { locale })}
						</Text>
					</Section>
				</Container>
			</Body>
		</Html>
	);
}
