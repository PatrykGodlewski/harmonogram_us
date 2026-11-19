# Load tests (k6)

`pnpm load` runs two k6 scenarios against the e2e stack (production images, `pnpm e2e:up` first)
and then checks the database. k6 runs from the pinned `grafana/k6` Docker image; nothing is
installed on the host.

1. **Setup** (`setup.ts`) creates users with signed session cookies directly in the e2e database
   (sign-in has CAPTCHA and rate limits), the events, and the request bodies (seroval JSON, as
   the browser sends them). Server function ids are read by export name from the manifest in
   the web image (`__23tanstack-start-server-fn-resolver-*.mjs`), so k6 calls exactly what the
   browser calls; the setup fails loudly if a name is missing.
2. **Spike** (`k6/spike.js`): 500 people register for one 50-place event within ~10 s.
   Pass: no failed request, every answer is `registered` or `waitlisted`, p95 < 2 s.
3. **Steady** (`k6/steady.js`): 100 signed-in people browse the list, an event and their account
   and register/withdraw on 2 events of 10 places for 2 minutes, so withdrawals keep promoting
   people from the waitlist. Pass: < 1% failed, p95 < 500 ms, > 20% of registrations waitlisted.
4. **Verify** (`verify.ts`): spike = exactly 50 registered and 450 waitlisted; for every event the
   seat count equals places − registered, nobody is over capacity and nobody waits while places
   are free.

Settings are in `config.ts`; run data and k6 summaries go to `load/.run/` (gitignored).
Server functions are same-origin RPC (TanStack Start docs), so k6 sends the browser's
same-origin headers; this is a test of our own app, not a public API.
