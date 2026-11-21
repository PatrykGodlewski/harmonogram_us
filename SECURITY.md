# Security policy

## Reporting a vulnerability

Please report vulnerabilities **privately** through GitHub:
[Security → Report a vulnerability](https://github.com/PatrykGodlewski/harmonogram_us/security/advisories/new).
Do not open a public issue, pull request or discussion for a suspected vulnerability.

Include what you found, how to reproduce it (steps, requests, a proof of concept) and the impact you
expect. Reports in Polish or English are welcome.

## What to expect

- Acknowledgement within 5 working days.
- An assessment (accepted, needs more information, or not a vulnerability) within 14 days.
- For accepted reports: a fix on `next` as soon as practical, a GitHub security advisory once the fix is
  available, and credit in the advisory unless you ask otherwise.

## Supported versions

There are no releases yet. Security fixes go to `next` (development) and `main`.

## Scope

In scope: this repository's code and configuration (`apps/`, `packages/`, `services/`, `proto/`,
Docker and CI files), including authentication, registration, personal data handling and the
internal gRPC service.

Out of scope: third-party services a deployment uses (Cloudflare Turnstile, the university's sign-in
provider, the mail provider, the hosting platform), denial of service by volume, social engineering,
and findings that need a compromised device or administrator account.

## Safe harbour

We will not pursue legal action against good-faith research that respects this policy: test only
against your own deployment or local copy, do not access or keep other people's data, and give us
reasonable time to fix the issue before disclosure.
