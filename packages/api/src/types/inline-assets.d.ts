declare module "*.ttf?inline" {
	/** A data URL (base64) of the font, inlined by Vite. */
	const dataUrl: string;
	export default dataUrl;
}
