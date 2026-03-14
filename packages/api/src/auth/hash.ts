import { hash, verify } from '@node-rs/argon2';

export async function hashPassword(password: string | number | null | undefined): Promise<string> {
	const pw = password != null ? String(password).trim() : '';
	if (!pw) {
		throw new Error('Password must be a non-empty string');
	}
	return hash(pw, {
		memoryCost: 19456,
		timeCost: 2,
		outputLen: 32,
		parallelism: 1,
	});
}

export async function verifyPasswordHash(storedHash: string, password: string): Promise<boolean> {
	if (!storedHash || typeof storedHash !== 'string') return false;
	const pw = typeof password === 'string' ? password : String(password ?? '');
	try {
		return await verify(storedHash, pw);
	} catch {
		return false;
	}
}

export async function verifyPasswordStrength(password: string): Promise<boolean> {
	return password.length >= 8 && password.length <= 255;
}
