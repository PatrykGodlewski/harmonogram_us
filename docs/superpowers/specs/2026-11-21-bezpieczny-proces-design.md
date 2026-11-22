# Secure development process for a public repository: design

Status: approved by the owner's answers (21 November 2026). Small change: short design.

## Intent

The original request asked to "review this application to comply secure sdlc flow for open source projects". The repository is public on GitHub and had none of the usual safeguards. The goal is a repository that outsiders can trust and contribute to safely, and that the owner can sell as a hosted service.

## Decisions

**The owner's:**
- Licence: "similar licence like Sentry: allow easy self-hosting and selling a hosted version of my app". That is the **Functional Source License, FSL-1.1-ALv2**, Sentry's licence:
  - Anyone may use, modify and self-host the code, except as a competing commercial product or service.
  - Each version becomes Apache-2.0 two years after release.
  - The project is described as source-available ("fair source"), not OSI open source.
- GitHub settings are applied by Claude, not just documented:
  - protect `main`
  - Dependabot security updates
  - private vulnerability reporting
- Contact is through GitHub only; no e-mail address is published.

**Claude's calls:**
- **Policy files:**
  - `LICENSE`
  - `SECURITY.md`: private vulnerability reporting, response targets, scope, safe harbour.
  - `CONTRIBUTING.md`: workflow from AGENTS.md; contributions licensed under the project licence, with a Developer Certificate of Origin sign-off.
  - `CODE_OF_CONDUCT.md`: Contributor Covenant 2.1.
  - `.github/CODEOWNERS`
- **Supply chain:**
  - Dependabot version updates, weekly and grouped, for npm, cargo, GitHub Actions, Dockerfiles and Compose images.
  - Every action pinned to a commit SHA with a version comment.
  - Workflows default to `permissions: contents: read`.
  - cargo-deny already runs.
  - Dependency review on pull requests: fails on high-severity vulnerabilities, and on licences outside the allow list.
- **Code scanning:**
  - CodeQL for JavaScript/TypeScript, Rust and Actions (on push, PR and weekly).
  - OpenSSF Scorecard (weekly, plus pushes to `main`), with results published.
  - GitHub secret scanning and push protection are already on.
- **Branch protection on `main`:**
  - pull requests only
  - required checks: `checks`, `unit`, `e2e`, `rust`, `CodeQL`
  - no force pushes or deletions
  - linear history
  - `next` stays the working branch and is not protected.
- **Documentation:** `docs/security.md` describes the process and lists what is not done yet.

## Non-goals

- Signed releases, SBOMs and container image signing: there are no releases or published images yet. The process document lists them as the first step when releases start.
- A CLA. Whether outside contributions need extra rights for the hosted offer is a legal question for the owner; until then, contributions come in under the project licence with a DCO sign-off.

## Verification

- Workflows parse and run on GitHub (first run checked).
- `gh api` shows the protection and security settings.
- Scorecard runs once (on push to `main` or by manual dispatch).
