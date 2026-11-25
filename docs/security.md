# Security and the development process

How this repository protects its code, its dependencies and the people who use it. Decisions:
[secure process design](superpowers/specs/2026-11-21-bezpieczny-proces-design.md). Reporting a
vulnerability: [SECURITY.md](../SECURITY.md).

## Licence

[FSL-1.1-ALv2](../LICENSE.md) (the Functional Source License, as Sentry uses). Anyone may use, change and
self-host Turnout, except to offer it as a competing commercial product or service; each version
becomes Apache-2.0 two years after it is published. The project is source-available ("fair source"),
not OSI open source.

## Controls

| Area | What is in place | Where |
|---|---|---|
| Review | `main` accepts changes only through pull requests with green, up-to-date CI (`checks`, `unit`, `e2e`, `rust`, and the three CodeQL analyses) and resolved conversations; no force pushes or deletion; linear history. No approval count is required (a single maintainer cannot approve their own PR) and admins can bypass in an emergency; CODEOWNERS requests the maintainer's review on outside PRs | GitHub branch protection, `.github/CODEOWNERS` |
| Tests | TDD; a Playwright test per feature; Vitest against real Postgres; Rust unit, property and server tests | `docs/testing.md`, CI |
| Code scanning | CodeQL (`security-extended`) for TypeScript, Rust and workflows on every push, PR and weekly | `.github/workflows/codeql.yml` |
| Dependencies | Dependabot alerts and security updates; weekly grouped version updates (npm, cargo, Actions, Docker, Compose); dependency review blocks PRs adding high-severity vulnerabilities or unexpected licences; cargo-deny (advisories, licences, sources) | `.github/dependabot.yml`, `dependency-review.yml`, `deny.toml` |
| CI hardening | Actions pinned to commit SHAs; workflows read-only by default; checkout without persisted credentials | `.github/workflows/*` |
| Reporting | Private vulnerability reporting (GitHub security advisories) | `SECURITY.md` |
| Secrets | GitHub secret scanning with push protection; secrets only in `.env` (gitignored) and platform variables; `@repo/env` validates them and keeps server values out of the browser | repository settings, `packages/env` |
| Posture | OpenSSF Scorecard weekly and on `main`, results published | `.github/workflows/scorecard.yml` |
| Application | Rate limits, CAPTCHA, disposable-address and breached-password checks; account pre-hijacking protection; permission checks enforced by a test over every panel function; personal data retention and deletion; internal gRPC service on the private network with a per-service token | `docs/architecture.md` |
| Containers | Base images pinned by digest; the documents service runs as a non-root user | `Dockerfile`, `apps/documents/Dockerfile` |

## Not done yet

- Signed releases, an SBOM per release and signed container images (Sigstore): there are no releases
  or published images yet; add them with the first release workflow.
- Branch protection for `next` (the working branch), required approvals (needs a second maintainer) and required signed commits.
- A contributor licence agreement: contributions come in under the project licence with a DCO sign-off;
  whether the hosted offer needs more rights from outside contributors is a legal question for the owner.
- An external security audit or penetration test.
