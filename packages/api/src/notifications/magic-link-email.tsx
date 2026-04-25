import {
	Body,
	Container,
	Head,
	Html,
	Link,
	Preview,
	Section,
	Text,
} from "@react-email/components";
import {
	auth_email_magic_link_badge,
	auth_email_magic_link_button,
	auth_email_magic_link_fallback,
	auth_email_magic_link_ignore,
	auth_email_magic_link_intro,
	auth_email_magic_link_preview,
	auth_email_magic_link_title,
} from "@repo/i18n/paraglide/messages";
import type { Locale } from "@repo/i18n/paraglide/runtime";

type MagicLinkEmailProps = {
	url: string;
	locale: Locale;
};

export function MagicLinkEmail({ url, locale }: MagicLinkEmailProps) {
	return (
		<Html>
			<Head />
			<Preview>{auth_email_magic_link_preview({}, { locale })}</Preview>
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
								{auth_email_magic_link_badge({}, { locale })}
							</Text>
							<Text
								style={{
									color: "#ffffff",
									fontSize: "22px",
									fontWeight: "700",
									margin: "10px 0 0",
								}}
							>
								{auth_email_magic_link_title({}, { locale })}
							</Text>
						</Section>
						<Section style={{ padding: "24px" }}>
							<Text
								style={{
									margin: "0 0 12px",
									lineHeight: "1.6",
									color: "#1f2937",
								}}
							>
								{auth_email_magic_link_intro({}, { locale })}
							</Text>
							<Section style={{ textAlign: "center", margin: "20px 0" }}>
								<Link
									href={url}
									style={{
										display: "inline-block",
										backgroundColor: "#0f2a56",
										color: "#ffffff",
										padding: "12px 22px",
										borderRadius: "8px",
										fontWeight: "600",
										textDecoration: "none",
									}}
								>
									{auth_email_magic_link_button({}, { locale })}
								</Link>
							</Section>
							<Text
								style={{
									fontSize: "13px",
									color: "#6b7280",
									lineHeight: "1.5",
								}}
							>
								{auth_email_magic_link_fallback({}, { locale })}
								<br />
								<Link href={url} style={{ color: "#2563eb" }}>
									{url}
								</Link>
							</Text>
							<Text
								style={{
									margin: "18px 0 0",
									fontSize: "13px",
									color: "#6b7280",
									lineHeight: "1.5",
								}}
							>
								{auth_email_magic_link_ignore({}, { locale })}
							</Text>
						</Section>
					</Section>
				</Container>
			</Body>
		</Html>
	);
}
