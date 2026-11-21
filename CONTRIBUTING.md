# Contributing

Thank you for helping. Issues are written in Polish; code, commits and documentation in English.

## Before you start

- Read [AGENTS.md](AGENTS.md) (the working rules; they apply to people too) and
  [docs/development.md](docs/development.md) (setup and commands).
- For a new feature, open an issue first: scope comes from the
  [product spec](docs/superpowers/specs/2026-11-19-produkt-design.md).
- Security problems: do not open an issue, see [SECURITY.md](SECURITY.md).

## Making a change

1. Branch from `next`.
2. Write the test first and watch it fail. Every feature needs a Playwright test named `[Fn] …`;
   screens are designed for 360 px phones first.
3. Keep the change small; follow nearby patterns; put UI text in both `packages/i18n/messages/pl.json`
   and `en.json`.
4. Run the checks in [docs/testing.md](docs/testing.md): at least `pnpm lint`, `pnpm typecheck`,
   `pnpm test`, and `pnpm e2e:up && pnpm e2e` for UI changes; `pnpm rust:test` and `pnpm proto:lint`
   for the documents service.
5. Commit with [Conventional Commits](https://www.conventionalcommits.org) and sign off each commit
   (`git commit -s`, see below).
6. Open a pull request against `next`. CI must be green; a maintainer reviews it.

## Licence of contributions

The project is licensed under the [Functional Source License, FSL-1.1-ALv2](LICENSE.md). By contributing
you agree that your contribution is licensed under the same terms.

Sign off every commit to certify the [Developer Certificate of Origin](https://developercertificate.org)
(that you wrote it or have the right to submit it): `git commit -s` adds
`Signed-off-by: Your Name <you@example.com>`.

## Code of conduct

Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).
