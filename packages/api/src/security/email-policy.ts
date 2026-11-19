import disposableDomainList from "disposable-email-domains";
import { appError } from "../errors";

export type EmailRejection = {
	email: string;
	reason: "invalid" | "disposable";
};

let disposableDomains: Set<string> | null = null;

function isDisposable(domain: string): boolean {
	disposableDomains ??= new Set(
		disposableDomainList.map((d) => d.toLowerCase()),
	);
	return disposableDomains.has(domain);
}

/**
 * Applies the sign-up email policy: no disposable domains. Deliverability is
 * proven by the confirmation link every flow sends, so there are no network lookups.
 */
export async function checkEmails(
	emails: string[],
): Promise<{ rejected: EmailRejection[] }> {
	const rejected: EmailRejection[] = [];
	for (const email of emails) {
		const domain = email.split("@")[1]?.toLowerCase();
		if (!domain) {
			rejected.push({ email, reason: "invalid" });
		} else if (isDisposable(domain)) {
			rejected.push({ email, reason: "disposable" });
		}
	}
	return { rejected };
}

/** Throws `EMAIL_NOT_ALLOWED` when any address fails the policy. */
export async function assertEmailsAllowed(emails: string[]): Promise<void> {
	const { rejected } = await checkEmails(emails);
	if (rejected.length > 0) {
		throw appError("EMAIL_NOT_ALLOWED");
	}
}
