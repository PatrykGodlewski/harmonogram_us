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
	event_change_date,
	event_change_intro,
	event_change_no_place,
	event_change_place,
	event_change_subject,
	reg_email_button,
} from "@repo/i18n/paraglide/messages";

export type EventChangeEmailProps = {
	locale: "pl" | "en";
	eventTitle: string;
	/** Already formatted in the installation time zone; null when unchanged. */
	date: { before: string; after: string } | null;
	place: { before: string | null; after: string | null } | null;
	url: string;
};

function changeLines(props: EventChangeEmailProps): string[] {
	const { locale } = props;
	const none = event_change_no_place({}, { locale });
	return [
		props.date ? event_change_date({ ...props.date }, { locale }) : null,
		props.place
			? event_change_place(
					{
						before: props.place.before ?? none,
						after: props.place.after ?? none,
					},
					{ locale },
				)
			: null,
	].filter((line) => line !== null) as string[];
}

/** Subject and plain-text body; the HTML version is EventChangeEmail. */
export function eventChangeEmailText(props: EventChangeEmailProps): {
	subject: string;
	text: string;
} {
	const { locale } = props;
	return {
		subject: event_change_subject({ event: props.eventTitle }, { locale }),
		text: [
			event_change_intro({ event: props.eventTitle }, { locale }),
			changeLines(props).join("\n"),
			props.url,
		].join("\n\n"),
	};
}

const text = { fontSize: "15px", lineHeight: "22px", margin: "0 0 12px" };

export function EventChangeEmail(props: EventChangeEmailProps) {
	const { locale } = props;
	const intro = event_change_intro({ event: props.eventTitle }, { locale });
	return (
		<Html>
			<Head />
			<Preview>{intro}</Preview>
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
						<Text style={text}>{intro}</Text>
						{changeLines(props).map((line) => (
							<Text key={line} style={{ ...text, fontWeight: "700" }}>
								{line}
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
					</Section>
				</Container>
			</Body>
		</Html>
	);
}
