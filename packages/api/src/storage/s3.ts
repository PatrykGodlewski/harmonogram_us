/** Server-only: files in an S3-compatible bucket (Cloudflare R2 in production, SeaweedFS locally). */
import { env } from "@repo/env";
import { AwsClient } from "aws4fetch";

export type StorageConfig = {
	/** Without the bucket, e.g. https://<account>.r2.cloudflarestorage.com */
	endpoint: string;
	bucket: string;
	accessKeyId: string;
	secretAccessKey: string;
	region: string;
};

/** The configuration, or null when storage is not set up (files are off). */
export function storageConfig(): StorageConfig | null {
	const { S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } =
		env;
	if (
		!S3_ENDPOINT ||
		!S3_BUCKET ||
		!S3_ACCESS_KEY_ID ||
		!S3_SECRET_ACCESS_KEY
	) {
		return null;
	}
	return {
		endpoint: S3_ENDPOINT.replace(/\/+$/, ""),
		bucket: S3_BUCKET,
		accessKeyId: S3_ACCESS_KEY_ID,
		secretAccessKey: S3_SECRET_ACCESS_KEY,
		region: env.S3_REGION,
	};
}

const TIMEOUT_MS = 30_000;

function client(config: StorageConfig): AwsClient {
	return new AwsClient({
		accessKeyId: config.accessKeyId,
		secretAccessKey: config.secretAccessKey,
		service: "s3",
		region: config.region,
		retries: 0,
	});
}

/** Path-style object URL; keys are app-made (`events/{id}/{uuid}`), so no encoding is needed. */
function objectUrl(config: StorageConfig, key: string): string {
	return `${config.endpoint}/${config.bucket}/${key}`;
}

/** Errors carry only the HTTP status, never keys or signatures. */
export async function putObject(
	config: StorageConfig,
	key: string,
	body: ArrayBuffer,
	contentType: string,
): Promise<void> {
	const response = await client(config).fetch(objectUrl(config, key), {
		method: "PUT",
		body,
		headers: { "content-type": contentType },
		signal: AbortSignal.timeout(TIMEOUT_MS),
	});
	if (!response.ok) {
		throw new Error(`Storage PUT failed: HTTP ${response.status}`);
	}
}

/** A missing object counts as deleted. */
export async function deleteObject(
	config: StorageConfig,
	key: string,
): Promise<void> {
	const response = await client(config).fetch(objectUrl(config, key), {
		method: "DELETE",
		signal: AbortSignal.timeout(TIMEOUT_MS),
	});
	if (!response.ok && response.status !== 404) {
		throw new Error(`Storage DELETE failed: HTTP ${response.status}`);
	}
}

/** How long a signed download link works: long enough to start the download. */
export const SIGNED_URL_SECONDS = 60;

/** A short-lived signed GET that downloads the object under `filename`, or shows it inline. */
export async function presignDownload(
	config: StorageConfig,
	key: string,
	filename: string,
	options: { inline?: boolean; expiresSeconds?: number } = {},
): Promise<string> {
	const url = new URL(objectUrl(config, key));
	url.searchParams.set(
		"X-Amz-Expires",
		String(options.expiresSeconds ?? SIGNED_URL_SECONDS),
	);
	url.searchParams.set(
		"response-content-disposition",
		options.inline ? "inline" : contentDisposition(filename),
	);
	const signed = await client(config).sign(url.toString(), {
		method: "GET",
		aws: { signQuery: true },
	});
	return signed.url;
}

/** `attachment` with an ASCII fallback and the exact name per RFC 5987. */
export function contentDisposition(filename: string): string {
	const ascii = filename
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/ł/g, "l")
		.replace(/Ł/g, "L")
		.replace(/[^\x20-\x7e]|["\\]/g, "_");
	const encoded = encodeURIComponent(filename).replace(
		/['()*]/g,
		(char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
	);
	return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
