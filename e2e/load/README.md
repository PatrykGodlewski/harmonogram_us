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

After the spike the runner waits for the worker to send every queued confirmation e-mail
(pass: within 60 s).

**Stress** (`pnpm load:stress`, `k6/stress.js`): the steady mix ramped 50 → 100 → 200 → 400
users; it stops at the step where errors pass 5% or p95 passes 2 s. Informational: the step it
reached is the result.

**Documents** (`pnpm load:documents`, `k6/documents.js`): 200 people download their ticket PDF
within ~10 s while 50 others browse the list and an event page. Pass: every download is a PDF.
`pnpm load:documents --baseline` saves the run as the reference; a later run fails when browse
p95 during the burst is more than 10% worse than that baseline. It measures whether rendering
PDFs slows the rest of the site (the Rust documents service, Plan 7).

**Reports and Prometheus.** Every scenario writes an HTML report (k6 web dashboard) and a JSON
summary to `load/.run/`. With `pnpm observability:up` running, k6 also streams its metrics to
Prometheus (remote write), next to the apps' own metrics, and Grafana shows both on the
"Harmonogram" dashboard (http://localhost:13002 for the e2e stack).

Settings are in `config.ts`; run data and k6 summaries go to `load/.run/` (gitignored).
Server functions are same-origin RPC (TanStack Start docs), so k6 sends the browser's
same-origin headers; this is a test of our own app, not a public API.
