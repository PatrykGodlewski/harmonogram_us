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
	reg_email_button,
	reg_email_confirmed_intro,
	reg_email_confirmed_subject,
	reg_email_promoted_intro,
	reg_email_promoted_subject,
	reg_email_ticket,
	reg_email_ticket_button,
	reg_email_waitlisted_intro,
	reg_email_waitlisted_subject,
	reg_email_withdraw_hint,
} from "@repo/i18n/paraglide/messages";

export type RegistrationEmailChange = "confirmed" | "waitlisted" | "promoted";

export type RegistrationEmailProps = {
	change: RegistrationEmailChange;
	locale: "pl" | "en";
	eventTitle: string;
	/** Already formatted in the installation time zone. */
	eventDate: string;
	url: string;
	/** The registrant's ticket; only for a registration that holds a place. */
	ticketUrl?: string;
};

const SUBJECTS = {
	confirmed: reg_email_confirmed_subject,
	waitlisted: reg_email_waitlisted_subject,
	promoted: reg_email_promoted_subject,
} as const;

const INTROS = {
	confirmed: reg_email_confirmed_intro,
	waitlisted: reg_email_waitlisted_intro,
	promoted: reg_email_promoted_intro,
} as const;

/** Subject and plain-text body; the HTML version is RegistrationEmail. */
export function registrationEmailText(props: RegistrationEmailProps): {
	subject: string;
	text: string;
} {
	const { locale } = props;
	const intro = INTROS[props.change](
		{ event: props.eventTitle, date: props.eventDate },
		{ locale },
	);
	return {
		subject: SUBJECTS[props.change]({ event: props.eventTitle }, { locale }),
		text: [
			intro,
			props.url,
			props.ticketUrl
				? `${reg_email_ticket({}, { locale })}\n${props.ticketUrl}`
				: null,
			reg_email_withdraw_hint({}, { locale }),
		]
			.filter(Boolean)
			.join("\n\n"),
	};
}

const text = { fontSize: "15px", lineHeight: "22px", margin: "0 0 12px" };

export function RegistrationEmail(props: RegistrationEmailProps) {
	const { locale } = props;
	const intro = INTROS[props.change](
		{ event: props.eventTitle, date: props.eventDate },
		{ locale },
	);
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
						{props.ticketUrl ? (
							<Button
								href={props.ticketUrl}
								style={{
									marginLeft: "8px",
									border: "1px solid #0f2a56",
									color: "#0f2a56",
									borderRadius: "8px",
									padding: "11px 19px",
									fontWeight: "700",
								}}
							>
								{reg_email_ticket_button({}, { locale })}
							</Button>
						) : null}
						<Text
							style={{
								...text,
								marginTop: "16px",
								fontSize: "13px",
								color: "#4b5563",
							}}
						>
							{reg_email_withdraw_hint({}, { locale })}
						</Text>
					</Section>
				</Container>
			</Body>
		</Html>
	);
}
