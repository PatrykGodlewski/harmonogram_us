import type { EnabledSocialProvider } from "@repo/api/auth/social-providers";
import { auth_button_continue_google } from "@repo/i18n/paraglide/messages";

export type AuthSocialProvider = EnabledSocialProvider;

export const authSocialButtonLabel: Record<AuthSocialProvider, () => string> = {
	google: auth_button_continue_google,
};
