import { hash, verify } from '@node-rs/argon2';

export async function hashPassword(password: string): Promise<string> {
	return hash(password, {
		memoryCost: 19456,
		timeCost: 2,
		outputLen: 32,
		parallelism: 1,
	});
}

export async function verifyPasswordHash(
	storedHash: string,
	password: string,
): Promise<boolean> {
	return verify(storedHash, password);
}

export async function verifyPasswordStrength(password: string): Promise<boolean> {
	return password.length >= 8 && password.length <= 255;
}
