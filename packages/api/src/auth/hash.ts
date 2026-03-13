import crypto from 'node:crypto';

export function hashPassword(password: string): Promise<string> {
	return new Promise((resolve, reject) => {
		crypto.pbkdf2(password, 'salt', 100_000, 64, 'sha256', (err, derivedKey) => {
			if (err) reject(err);
			else resolve(derivedKey.toString('hex'));
		});
	});
}
