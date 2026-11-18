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
	group_email_badge,
	group_email_button,
	group_email_deadline,
	group_email_fallback,
	group_email_group,
	group_email_ignore,
	group_email_intro,
	group_email_items,
	group_email_preview,
	group_email_title,
} from "@repo/i18n/paraglide/messages";
import type { Locale } from "@repo/i18n/paraglide/runtime";

export type GroupInvitationEmailProps = {
	url: string;
	locale: Locale;
	eventTitle: string;
	/** Already formatted in Europe/Warsaw. */
	eventDate: string;
	deadline: string;
	teacherName: string;
	groupName: string | null;
	itemTitles: string[];
};

const text = { fontSize: "15px", lineHeight: "22px", margin: "0 0 12px" };

export function GroupInvitationEmail(props: GroupInvitationEmailProps) {
	const { locale } = props;
	return (
		<Html>
			<Head />
			<Preview>
				{group_email_preview({ event: props.eventTitle }, { locale })}
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
							overflow: "hidden",
						}}
					>
						<Section
							style={{ backgroundColor: "#0f2a56", padding: "18px 24px" }}
						>
							<Text
								style={{
									color: "#f2c14e",
									fontSize: "12px",
									fontWeight: "700",
									letterSpacing: "0.08em",
									textTransform: "uppercase",
									margin: "0",
								}}
							>
								{group_email_badge({}, { locale })}
							</Text>
							<Text
								style={{
									color: "#ffffff",
									fontSize: "22px",
									margin: "6px 0 0",
								}}
							>
								{group_email_title({}, { locale })}
							</Text>
						</Section>
						<Section style={{ padding: "24px" }}>
							<Text style={text}>
								{group_email_intro(
									{
										teacher: props.teacherName,
										event: props.eventTitle,
										date: props.eventDate,
									},
									{ locale },
								)}
							</Text>
							{props.groupName ? (
								<Text style={text}>
									{group_email_group({ group: props.groupName }, { locale })}
								</Text>
							) : null}
							{props.itemTitles.length > 0 ? (
								<Text style={text}>
									{group_email_items(
										{ items: props.itemTitles.join(", ") },
										{ locale },
									)}
								</Text>
							) : null}
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
								{group_email_button({}, { locale })}
							</Button>
							<Text style={{ ...text, marginTop: "16px" }}>
								{group_email_deadline({ deadline: props.deadline }, { locale })}
							</Text>
							<Text style={{ ...text, fontSize: "13px", color: "#4b5563" }}>
								{group_email_fallback({}, { locale })} {props.url}
							</Text>
							<Text style={{ ...text, fontSize: "13px", color: "#4b5563" }}>
								{group_email_ignore({}, { locale })}
							</Text>
						</Section>
					</Section>
				</Container>
			</Body>
		</Html>
	);
}
