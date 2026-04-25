declare module "@react-email/components" {
	import type { ComponentType, CSSProperties, ReactNode } from "react";

	type BaseProps = {
		children?: ReactNode;
		style?: CSSProperties;
	};

	export const Body: ComponentType<BaseProps>;
	export const Container: ComponentType<BaseProps>;
	export const Head: ComponentType<BaseProps>;
	export const Html: ComponentType<BaseProps>;
	export const Preview: ComponentType<BaseProps>;
	export const Section: ComponentType<BaseProps>;
	export const Text: ComponentType<BaseProps>;
	export const Link: ComponentType<
		BaseProps & {
			href: string;
		}
	>;
}
