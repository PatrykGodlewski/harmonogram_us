import { DynamicBuffer } from '@oslojs/binary';
import { decodeBase64 } from '@oslojs/encoding';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { z } from 'zod';

const encryptionKeySchema = z
	.string({ required_error: 'ENCRYPTION_KEY must be provided' })
	.min(1, 'ENCRYPTION_KEY must not be empty')
	.transform((val) => {
		const decoded = decodeBase64(val);
		if (decoded.byteLength !== 16) {
			throw new Error('ENCRYPTION_KEY must be a base64-encoded 16-byte key');
		}
		return decoded;
	});

const key = encryptionKeySchema.parse(process.env.ENCRYPTION_KEY);

export function encrypt(data: Uint8Array): Uint8Array {
	const iv = randomBytes(16);
	const cipher = createCipheriv('aes-128-gcm', key, iv);
	const encrypted = new DynamicBuffer(0);
	encrypted.write(iv);
	encrypted.write(cipher.update(data));
	encrypted.write(cipher.final());
	encrypted.write(cipher.getAuthTag());
	return encrypted.bytes();
}

export function encryptString(data: string): Uint8Array {
	return encrypt(new TextEncoder().encode(data));
}

export function decrypt(encrypted: Uint8Array): Uint8Array {
	if (encrypted.byteLength < 33) {
		throw new Error('Invalid encrypted data');
	}
	const decipher = createDecipheriv(
		'aes-128-gcm',
		key,
		encrypted.slice(0, 16),
	);
	decipher.setAuthTag(encrypted.slice(encrypted.byteLength - 16));
	const decrypted = new DynamicBuffer(0);
	decrypted.write(
		decipher.update(encrypted.slice(16, encrypted.byteLength - 16)),
	);
	decrypted.write(decipher.final());
	return decrypted.bytes();
}

export function decryptToString(data: Uint8Array): string {
	return new TextDecoder().decode(decrypt(data));
}
