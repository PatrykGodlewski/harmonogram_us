import validateEmail from "deep-email-validator";
import disposableDomainList from "disposable-email-domains";
import { appError } from "../errors";

export type EmailRejection = {
	email: string;
	reason: "invalid" | "disposable" | "undeliverable";
};

/** Domain-level deliverability check (regex, typo, MX). Injectable for tests. */
export type DomainValidator = (sampleEmail: string) => Promise<boolean>;

let disposableDomains: Set<string> | null = null;

function isDisposable(domain: string): boolean {
	disposableDomains ??= new Set(
		disposableDomainList.map((d) => d.toLowerCase()),
	);
	return disposableDomains.has(domain);
}

export const defaultDomainValidator: DomainValidator = async (email) => {
	const result = await validateEmail({
		email,
		validateRegex: true,
		validateMx: true,
		validateTypo: true,
		validateDisposable: false,
		// SMTP probing defaults to on: it is slow and port 25 is blocked on most
		// hosts, so it rejects real addresses. MX records are enough.
		validateSMTP: false,
	});
	return result.valid;
};

/**
 * Applies the sign-up email policy (no disposable domains, a working mail
 * server) to a list of addresses. MX is checked once per domain.
 */
export async function checkEmails(
	emails: string[],
	deps: { validate?: DomainValidator } = {},
): Promise<{ rejected: EmailRejection[] }> {
	const validate = deps.validate ?? defaultDomainValidator;
	const rejected: EmailRejection[] = [];
	const byDomain = new Map<string, string[]>();

	for (const email of emails) {
		const domain = email.split("@")[1]?.toLowerCase();
		if (!domain) {
			rejected.push({ email, reason: "invalid" });
		} else if (isDisposable(domain)) {
			rejected.push({ email, reason: "disposable" });
		} else {
			byDomain.set(domain, [...(byDomain.get(domain) ?? []), email]);
		}
	}

	const verdicts = await Promise.all(
		[...byDomain.values()].map(async (group) => ({
			group,
			ok: await validate(group[0] ?? ""),
		})),
	);
	for (const { group, ok } of verdicts) {
		if (!ok) {
			rejected.push(
				...group.map((email) => ({ email, reason: "undeliverable" as const })),
			);
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
