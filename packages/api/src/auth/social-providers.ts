export const enabledSocialProviders = ["google"] as const;

export type EnabledSocialProvider = (typeof enabledSocialProviders)[number];
