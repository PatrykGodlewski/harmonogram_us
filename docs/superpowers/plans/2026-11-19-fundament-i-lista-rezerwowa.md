# Fundament testów, uproszczenia i lista rezerwowa — plan implementacji

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (wybrane w przeglądzie, lista B4) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Testy e2e w CI na pełnym stosie Docker.
- Zatwierdzone uproszczenia kodu (A1–A4, A6).
- Zapisy z listą rezerwową i automatycznym awansem (F5) oraz e-maile o zapisie, liście rezerwowej i awansie (F6).

**Architecture:**
- Playwright w nowym pakiecie `e2e/`. Testy działają na obrazach produkcyjnych z `Dockerfile`, uruchamianych przez `docker compose --profile app`.
- Stan zapisu to kolumna `state` w `event_registrations`. Liczniki miejsc liczą tylko `registered`.
- Awans z listy odbywa się w tej samej transakcji co zwolnienie miejsca, pod istniejącą blokadą wydarzenia.
- E-maile idą przez jedną kolejkę pg-boss `emails`, dodawaną w tej samej transakcji co dane (wzorzec z zaproszeń grupowych).

**Tech Stack:** TanStack Start, Drizzle + Postgres (triggery liczników), ElectricSQL, Better Auth, pg-boss, Playwright, GitHub Actions, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-11-19-produkt-design.md` (funkcje F1, F4, F5, F6, F26, F27; konflikty K2 i K5; Zasady). Przegląd z listą uproszczeń: `docs/superpowers/audits/2026-11-19-przeglad.md`.

**Kolejność planów:** to plan 1 z 3 dla priorytetu 1.
- Plan 2: F2 role i `/manage`, F3 wydarzenia (publikacja, odwołanie, duplikat, link online, jednostka i kategoria), e-mail o odwołaniu (reszta F6), F7 panel organizatora.
- Plan 3: F1 język w profilu, F4 kalendarz, ICS i Open Graph, F8 dostępność, deklaracja i reguła lint, F9 RODO.

Commit bazowy: `0e565c7`.

## Global Constraints

- **Funkcja jest gotowa, gdy przechodzi test e2e.**
  - Testy przechodzą przez główne ścieżki z perspektywy użytkownika i sprawdzają widoczny skutek: treść ekranu, e-mail w Mailpit, zawartość pliku.
  - Ścieżki uczestnika działają też przy 360 px.
  - Testy e2e działają w CI.
  - Test piszesz przed kodem i widzisz, że najpierw nie przechodzi.
  - Nazwa testu zawiera numer funkcji, np. `[F5] zapis na pełne wydarzenie trafia na listę rezerwową`.
- **Bez rozwiązań tymczasowych.** Bez TODO, atrap w kodzie produkcyjnym, danych na sztywno, zakomentowanego kodu i pominiętych testów. Zmiany bazy tylko przez migracje. Czego nie da się zrobić porządnie teraz, przechodzi w całości na później.
- **Bez kodu „na przyszłość”.** Abstrakcja dopiero przy drugim użyciu. Wyjątek: integracje zewnętrzne (logowanie, płatności, wideokonferencje, import z Indico) są za prostym wspólnym interfejsem.
- **Prosto.** Z dwóch sposobów wybierz prostszy. Jeśli zadanie rośnie poza opis, zatrzymaj się i zapytaj.
- **Utrwalenie przed zmianą.** Każda zmiana działającego zachowania ma najpierw test, który je utrwala. Zadanie 3 utrwala zachowanie, które zmieniają zadania 4–9.
- **Konwencje z `CLAUDE.md`:**
  - bez plików barrel; importy przez ścieżki `@repo/*/…`;
  - zmienne środowiskowe tylko przez `@repo/env`;
  - `z.email()`;
  - Biome: taby, podwójne cudzysłowy;
  - Conventional Commits;
  - globalna kolejność blokad: `events` → `agenda_items` → `registration_groups` → `registration_group_members` → wiersze liczników.
- **Trzy kontrole przed każdym commitem:** `pnpm lint && pnpm typecheck && pnpm test`. Od zadania 1 dochodzi `pnpm e2e`.

## Review Focus

1. **Ponowny zapis po rezygnacji, gdy wydarzenie jest pełne.** Osoba trafia na koniec listy rezerwowej, a nie na pozycję z pierwszego zapisu. Test w zadaniu 9.
2. **Równoczesne rezygnacje.** Awansuje dokładnie tyle osób, ile miejsc się zwolniło, w kolejności listy. Test w zadaniu 9.
3. **Zamknięcie grupy albo zwiększenie limitu przez administratora** zwalnia miejsca i awansuje osoby z listy. Test w zadaniu 9.
4. **Zadanie e-mail dla zapisu, który zniknął albo zmienił stan przed wysyłką,** jest pomijane bez błędu i bez wysyłki. Test w zadaniu 10.
5. **Osoba z listy rezerwowej próbuje zapisać się na punkt programu.** Dostaje jasny komunikat i nie zajmuje miejsca. Test w zadaniu 9.

---

### Task 1: Stos Docker i środowisko e2e

Domyka rozwiązanie tymczasowe T9 z przeglądu.

**Files:**
- Modify: `docker-compose.yml`
- Modify: `.env.example`
- Create: `e2e/package.json`, `e2e/playwright.config.ts`, `e2e/tsconfig.json`
- Create: `e2e/fixtures/mailpit.ts`, `e2e/fixtures/auth.ts`, `e2e/fixtures/data.ts`
- Create: `e2e/tests/f1-logowanie.spec.ts`
- Modify: `pnpm-workspace.yaml` (dodaj `e2e`), root `package.json` (skrypty `e2e`, `e2e:up`)

**Interfaces:**
- Produces:
  - Compose: usługi `web`, `admin`, `worker` w profilu `app`, budowane z `Dockerfile` z `APP=web|admin|worker`, na portach 3000, 3001 i bez portu.
  - `e2e/fixtures/mailpit.ts`: `latestMessageTo(email: string): Promise<{ subject: string; text: string; links: string[] }>` (czeka na wiadomość przez `expect.poll`, maks. 15 s).
  - `e2e/fixtures/auth.ts`: `signInByEmail(page: Page, email: string): Promise<void>` (link e-mail przez interfejs i Mailpit).
  - `e2e/fixtures/data.ts`:
    - `uniqueEmail(testInfo: TestInfo): string`, zwraca `<slug-testu>-<uuid>@e2e.test`;
    - `createTestEvent(input: { title?: string; maxSeats?: number; startsInDays?: number; agenda?: { title: string; maxSeats?: number }[] }): Promise<{ id: string; title: string; itemIds: string[] }>`, przez `@repo/db/queries/events` i `agenda-items`;
    - `createTestUser(email: string, opts?: { admin?: boolean }): Promise<{ id: string }>`, z adresem zweryfikowanym, przez `@repo/db`.
  - Projekty Playwright:
    - `komputer`: Chromium 1280×800, wszystkie testy;
    - `telefon`: Chromium 360×800, `isMobile`, tylko testy z tagiem `@uczestnik`.

- [ ] **Step 1: Popraw `docker-compose.yml`.**
  - Przypnij `axllent/mailpit` i `electricsql/electric` do tagów wersji obrazów, które są teraz pobrane (`docker compose images`).
  - Ustaw Electric `DATABASE_URL: postgresql://postgres:postgres@db:5432/harmonogram_us`.
  - Dodaj profil `app` z `web`, `admin` i `worker`:
    - `env_file: .env`;
    - adresy usług wewnątrz sieci compose (`db`, `mailpit:1025`, `http://electric:3000`);
    - testowe klucze Turnstile Cloudflare: site `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA`.

- [ ] **Step 2: Napisz test utrwalający** (zachowanie już istnieje, więc ma przejść od razu):

```ts
test("[F1] logowanie linkiem e-mail @uczestnik", async ({ page }, testInfo) => {
	const email = uniqueEmail(testInfo);
	await createTestUser(email);
	await signInByEmail(page, email);
	await page.goto("/pl/account");
	await expect(page.getByText(email)).toBeVisible();
});
```

- [ ] **Step 3: Uruchom stos.**

Run: `docker compose --profile app up -d --build && pnpm db:migrate && pnpm e2e`

Expected: 2 testy zaliczone (projekty `komputer` i `telefon`).

- [ ] **Step 4: Commit:** `test(e2e): Playwright on the full compose stack, pinned images, Electric on db:5432`

### Task 2: CI w GitHub Actions

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: z zadania 1 skrypt `pnpm e2e` i profil compose `app`.

- [ ] **Step 1: Napisz `ci.yml`.** Wyzwalacze: push na `next` i `main` oraz pull request. Trzy zadania:
  - `checks`: Node 22, pnpm 10, `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm build`.
  - `unit`: `docker compose up -d db`, a potem `pnpm test`.
  - `e2e`:
    - `.env` z `.env.example` z wygenerowanymi sekretami (`openssl rand`);
    - `docker compose --profile app up -d --build`, potem `pnpm db:migrate`, potem `pnpm e2e`;
    - raport Playwright jako artefakt;
    - `retries: 0`.

- [ ] **Step 2: Wypchnij gałąź i sprawdź przebieg.**

Run: `git push origin next && gh run watch`

Expected: trzy zadania zielone.

- [ ] **Step 3: Commit:** `ci: lint, typecheck, build, Vitest and Playwright e2e`

### Task 3: Testy utrwalające obecne zachowanie

**Files:**
- Create:
  - `e2e/tests/f4-lista-wydarzen.spec.ts`
  - `e2e/tests/f5-zapisy.spec.ts`
  - `e2e/tests/f27-punkty-programu.spec.ts`
  - `e2e/tests/f26-rejestracja-grupowa.spec.ts`

**Interfaces:**
- Consumes: fiksury z zadania 1.

- [ ] **Step 1: Napisz testy.** Każdy ma przejść od razu, bo utrwala działające zachowanie. Asercje:
  - `[F4] wyszukiwanie i filtr jednostki zawężają listę @uczestnik`: dwa wydarzenia z różnymi wydziałami. Po wpisaniu tytułu pierwszego widać tylko je; po filtrze wydziału drugiego widać tylko drugie.
  - `[F5] zapis jednym kliknięciem i rezygnacja @uczestnik`:
    - wydarzenie z limitem 3;
    - po kliknięciu „Zapisz się” licznik pokazuje 2 wolne i przycisk zmienia się na „Zrezygnuj”;
    - po rezygnacji licznik pokazuje 3.
  - `[F5] pełne wydarzenie nie przyjmuje zapisu`: limit 1, zajęty przez innego użytkownika. Przycisk zapisu jest niedostępny albo pokazuje komunikat o braku miejsc. To zachowanie zmieni zadanie 9: zaktualizuj ten test w zadaniu 9, a nie wcześniej.
  - `[F27] zapis na punkt programu zapisuje też na wydarzenie @uczestnik`: po zapisie na punkt licznik punktu i licznik wydarzenia zmniejszają się o 1.
  - `[F26] nauczyciel tworzy grupę, uczeń potwierdza z e-maila`:
    - grupa na 2 miejsca, zaproszenie jednego adresu;
    - link z Mailpit otwiera stronę potwierdzenia;
    - po „Potwierdź moje miejsce” uczeń widzi wydarzenie jako zapisane;
    - licznik wydarzenia jest niższy o 2 od limitu.

- [ ] **Step 2: Run:** `pnpm e2e`. Expected: wszystkie zaliczone w obu projektach (tam, gdzie mają tag `@uczestnik`).

- [ ] **Step 3: Commit:** `test(e2e): pin event list, registration, agenda and group flows`

### Task 4: Jeden mechanizm zapisu po stronie przeglądarki

Uproszczenie A1. Domyka rozwiązania tymczasowe T3 i T4.

**Files:**
- Create: `apps/web/src/lib/registration/use-registration-actions.ts`
- Modify:
  - `apps/web/src/lib/event-details/use-event-details-registrations.ts` (zostaje tylko odczyt stanu albo plik znika, jeśli cała logika przeszła do nowego hooka);
  - komponenty listy (`apps/web/src/routes/index.tsx` i jej komponenty);
  - komponenty strony wydarzenia (`apps/web/src/components/event-details/*`).
- Delete:
  - `apps/web/src/lib/event-registration/cross-tab.ts`
  - `apps/web/src/lib/event-registration/registered-events-cache.ts`
  - `apps/web/src/lib/event-registration/use-in-flight-actions.ts`
  - `apps/web/src/lib/event-registration/use-event-registrations.ts`
  - `apps/web/src/lib/event-registration/use-registration-mutation.ts`

**Interfaces:**
- Produces: `useRegistrationActions(): { register(eventId: string): Promise<void>; unregister(eventId: string): Promise<void>; registerItem(itemId: string): Promise<void>; unregisterItem(itemId: string): Promise<void>; isPending(key: string): boolean }`.
- Przepływ każdej akcji:
  1. wywołanie istniejącej funkcji serwerowej;
  2. czekanie na `txid` w kolekcji, którą akcja zmienia (`eventSeatCountsCollection` albo `agendaItemSeatCountsCollection`);
  3. unieważnienie `myRegistrationsQueryOptions.queryKey`, `myRegisteredEventIdsQueryOptions.queryKey` i `eventDetailsQueryOptions(eventId).queryKey`.
- Gdy `awaitTxId` przekroczy czas, hook pobiera zapytania od nowa (`refetchQueries`) i pokazuje dane z serwera. Każdy inny błąd jest rzucany dalej i pokazywany przez `showRegistrationErrorToast`.

- [ ] **Step 1: Run:** `pnpm e2e --grep "\[F5\]|\[F27\]"`. Expected: zaliczone (punkt odniesienia z zadania 3).
- [ ] **Step 2: Zaimplementuj hook** i podmień oba ekrany. Usuń pliki z listy Delete.
- [ ] **Step 3: Run:** `pnpm e2e && pnpm typecheck && pnpm lint`. Expected: zaliczone, bez błędów.
- [ ] **Step 4: Commit:** `refactor(web): one registration flow (await txid, refetch on timeout), drop cross-tab and optimistic caches`

### Task 5: Zbędne zależności i sprawdzanie MX

Uproszczenia A2 i A4.

**Files:**
- Modify: `packages/api/package.json`: usuń `@oslojs/binary`, `@oslojs/crypto`, `@oslojs/encoding`, `@node-rs/argon2`, `@better-auth/i18n`, `deep-email-validator`.
- Modify: `packages/api/src/security/email-policy.ts`: zostaje tylko lista domen jednorazowych.
- Modify: `packages/api/test/email-policy.test.ts`, `email-policy-default.test.ts`.

**Interfaces:**
- Produces: `checkEmails(emails: string[]): Promise<{ allowed: string[]; rejected: string[] }>` (podpis bez zmian; bez zapytań sieciowych).

- [ ] **Step 1: Popraw test.**
  - `rejects disposable domains without network lookups`: adres `x@mailinator.com` jest odrzucony.
  - Adres z nieistniejącą domeną `x@no-such-domain-e2e.test` jest dopuszczony, bo potwierdzi go link.
- [ ] **Step 2: Run:** `pnpm --filter @repo/api test`. Expected: FAIL na drugiej asercji (dziś odrzuca brak MX).
- [ ] **Step 3: Usuń sprawdzanie MX i zależności;** `pnpm install`.
- [ ] **Step 4: Run:** `pnpm test && pnpm typecheck && pnpm build`. Expected: zaliczone.
- [ ] **Step 5: Commit:** `refactor(api): drop MX lookups and unused dependencies`

### Task 6: Limity żądań w Postgresie zamiast Redis

Uproszczenie A3. Domyka rozwiązania tymczasowe T6 i T7.

**Files:**
- Create: migracja `packages/db/src/migrations/0010_app_rate_limits.sql` (przez `pnpm db:generate`)
- Create: `packages/db/src/schema/rate-limits.ts`, `packages/db/src/queries/rate-limits.ts`
- Test: `packages/db/test/rate-limits.test.ts`
- Modify: `packages/api/src/security/rate-limit.ts`
- Create: `packages/api/src/security/production-config.ts`, test `packages/api/test/production-config.test.ts`
- Modify:
  - `apps/web/src/server.ts`, `apps/admin/src/server.ts` (sprawdzenie przy starcie);
  - `packages/env/src/index.ts` (usuń `REDIS_URL`, `REDIS_PASSWORD`);
  - `docker-compose.yml` (usuń `redis`);
  - `packages/api/package.json` (usuń `ioredis`, `rate-limiter-flexible`);
  - `.env.example`.

**Interfaces:**
- Produces:
  - Tabela `app_rate_limits(key text primary key, window_start timestamptz not null, points integer not null, blocked_until timestamptz)`.
  - `hitRateLimit(key: string, limit: { points: number; durationSeconds: number; blockDurationSeconds?: number }): Promise<boolean>` w `@repo/db/queries/rate-limits`. Jedno polecenie `INSERT … ON CONFLICT DO UPDATE`, które zeruje okno po jego upływie i ustawia blokadę po wyczerpaniu. Zwraca `false`, gdy limit jest przekroczony albo klucz zablokowany.
  - `consumeRateLimit(keyPrefix, limit, key)`: podpis bez zmian. Rzuca `RATE_LIMITED` tylko przy `false`, a błąd bazy przechodzi dalej.
  - `assertProductionSecurityConfig(config: { nodeEnv: string; turnstileSecretKey?: string }): void` rzuca `Error("TURNSTILE_SECRET_KEY is required in production")`. Wywołanie przy starcie obu serwerów.

- [ ] **Step 1: Napisz testy.**
  - `hitRateLimit allows points then refuses`: przy `points: 2` wyniki to `true, true, false`.
  - `window resets`: po przesunięciu `window_start` w teście o `durationSeconds` wstecz wynik znów jest `true`.
  - `block holds after exhaustion`: przy `blockDurationSeconds: 60` po wyczerpaniu kolejne wywołanie zwraca `false` także po przesunięciu okna.
  - `production without Turnstile secret fails`: rzuca dla `{ nodeEnv: "production" }`, nie rzuca dla `development`.
- [ ] **Step 2: Run:** `pnpm test`. Expected: FAIL (brak modułów).
- [ ] **Step 3: Zaimplementuj;** usuń Redis z compose, env i zależności.
- [ ] **Step 4: Run:** `pnpm test && pnpm e2e`. Expected: zaliczone, w tym `[F26]` (dołączanie korzysta z limitu).
- [ ] **Step 5: Commit:** `refactor: rate limits in Postgres, drop Redis; refuse production start without CAPTCHA secret`

### Task 7: Strefa czasowa i nadawca z konfiguracji, teksty do tłumaczeń

Rozwiązania tymczasowe T1, T2 i T8.

**Files:**
- Modify:
  - `packages/env/src/index.ts`: `APP_TIME_ZONE` (domyślnie `Europe/Warsaw`, walidacja `Intl.supportedValuesOf("timeZone")`) i `SMTP_FROM` wymagane (`z.string().min(1)`);
  - `packages/env/src/client.ts`: `VITE_APP_TIME_ZONE` z tą samą walidacją; `runtimeEnv` czyta `import.meta.env`, a gdy go nie ma (worker), `process.env`.
- Modify: `packages/ui/src/time.ts`
  - `EVENT_TIME_ZONE` z `VITE_APP_TIME_ZONE`;
  - zmiana nazw `formatWarsawDate` → `formatEventDate`, `formatWarsawTime` → `formatEventTime`, `formatWarsawDateTime` → `formatEventDateTime` (i pozostałe eksporty z `Warsaw` w nazwie) oraz wszystkich importów.
- Modify: `packages/jobs/src/queues.ts` (`JOBS_TIME_ZONE` z `env.APP_TIME_ZONE`), `packages/api/src/notifications/email.tsx` (nadawca `env.SMTP_FROM`), `.env.example`.
- Modify: zaszyte teksty z przeglądu T2:
  - `packages/ui/src/components/dialog.tsx:75,113`
  - `sheet.tsx:77`
  - `sidebar.tsx:197,287,290`
  - `composed/admin/admin-entity-table.tsx:74`
  - `composed/login.tsx:258`
  - `composed/signup.tsx:274,277`

  Nowe klucze w `packages/i18n/messages/{pl,en}.json`: `ui_close`, `ui_toggle_sidebar`, `ui_actions`, `auth_login_link_failed`, `auth_signup_failed`.
- Test: `packages/ui/test/time.test.ts`

**Interfaces:**
- Produces: `formatEventDate(date, locale)`, `formatEventTime(date, locale)`, `formatEventDateTime(date, locale)`: podpisy jak dotąd, nowe nazwy.

- [ ] **Step 1: Dopisz test.** `formatEventDateTime uses the configured zone`: przy `VITE_APP_TIME_ZONE=Europe/London` (`vi.stubEnv` przed importem modułu) `2026-06-01T12:00:00Z` daje godzinę `13:00`.
- [ ] **Step 2: Run:** `pnpm --filter @repo/ui test`. Expected: FAIL (strefa na sztywno).
- [ ] **Step 3: Zaimplementuj zmiany z listy Files.**
- [ ] **Step 4: Run:** `pnpm test && pnpm typecheck && pnpm lint && pnpm e2e`. Expected: zaliczone.
- [ ] **Step 5: Commit:** `refactor: time zone and sender from configuration, UI strings into messages`

### Task 8: Kolejka e-maili i e-mail weryfikacyjny przez kolejkę

Rozwiązanie tymczasowe T5.

**Files:**
- Modify:
  - `packages/jobs/src/queues.ts`: `QUEUE_EMAILS = "emails"`, payload `emailJob`;
  - `packages/jobs/src/client.ts`: `enqueueEmails`.
- Create: `apps/worker/src/handlers/send-email.ts`, rejestracja w `apps/worker/src/index.ts`.
- Modify: `packages/api/src/auth/better-auth.ts:285-293` (`sendVerificationEmail` dodaje zadanie do kolejki zamiast wysyłać i logować błąd).
- Test: `apps/worker/test/handlers.test.ts`, `e2e/tests/f1-logowanie.spec.ts`

**Interfaces:**
- Produces:
  - `emailJob = z.discriminatedUnion("kind", [z.object({ kind: z.literal("verification"), to: z.email(), url: z.url(), locale: z.enum(["pl","en"]) })])` oraz typ `EmailJob`. Zadanie 10 dopisuje wariant `{ kind: "registration", registrationId: string, change: "confirmed" | "waitlisted" | "promoted" }`.
  - `enqueueEmails(jobs: EmailJob[], opts?: { tx?: TransactionClient }): Promise<void>`: `retryLimit: 3`, `retryBackoff: true`, w transakcji przez `fromDrizzle`, jak `enqueueInvitationEmails`.
  - `handleEmailJob(job: EmailJob): Promise<void>`.

- [ ] **Step 1: Napisz testy.**
  - Worker: `verification job sends the link`. Wiadomość w Mailpit do `to` zawiera `url`.
  - e2e `[F1] rejestracja konta hasłem wysyła e-mail weryfikacyjny`. Po rejestracji w formularzu w Mailpit jest wiadomość z linkiem, a otwarcie linku oznacza konto jako zweryfikowane: strona konta nie pokazuje ostrzeżenia o weryfikacji.
- [ ] **Step 2: Run:** `pnpm --filter worker test`. Expected: FAIL (brak handlera).
- [ ] **Step 3: Zaimplementuj.**
- [ ] **Step 4: Run:** `pnpm test && pnpm e2e`. Expected: zaliczone.
- [ ] **Step 5: Commit:** `feat(jobs): emails queue; verification e-mail sent with retries`

### Task 9: Lista rezerwowa z automatycznym awansem (F5)

**Files:**
- Create: migracja `0011_registration_state.sql` (Drizzle generuje kolumny; funkcje liczników dopisane ręcznie w tym samym pliku)
- Modify:
  - `packages/db/src/schema/event-registrations.ts`;
  - `packages/db/src/queries/event-registrations.ts`, `events.ts` (`updateEvent`), `groups.ts` (`closeGroup`, `closeExpiredGroups`), `group-members.ts` (`removeMember`, `acceptInvitation`);
  - `packages/db/src/queries/domain-errors.ts` (kod `EVENT_WAITLISTED`), `packages/ui/src/app-errors.ts` (komunikat);
  - `packages/api/src/events/mutations.ts`, `my-registrations.ts`;
  - komponenty przycisku zapisu na liście i na stronie wydarzenia;
  - `packages/i18n/messages/{pl,en}.json`.
- Test:
  - `packages/db/test/waitlist.test.ts`, `concurrency.test.ts`;
  - `e2e/tests/f5-zapisy.spec.ts` (aktualizacja testu „pełne wydarzenie” z zadania 3).

**Interfaces:**
- Produces:
  - Kolumny:
    - `event_registrations.state text not null default 'registered' check (state in ('registered','waitlisted','withdrawn'))`;
    - `state_changed_at timestamptz not null default now()`;
    - `locale text not null default 'pl'`.
  - `RegistrationState = "registered" | "waitlisted" | "withdrawn"` w `@repo/db/schema/event-registrations`.
  - `refresh_event_seat_count` i `refresh_agenda_item_seat_count` liczą tylko `state = 'registered'`. Zasada „najpierw blokada, potem przeliczenie” z migracji `0006` zostaje.
  - `RegistrationChange = { registrationId: string; change: "confirmed" | "waitlisted" | "promoted" }`.
  - `RegistrationHooks = { onChanged(tx: TransactionClient, changes: RegistrationChange[]): Promise<void> }`.
  - `registerForEvent(eventId: string, userId: string, locale: "pl"|"en", hooks?: RegistrationHooks): Promise<{ state: "registered" | "waitlisted"; txid: number }>`:
    - pod blokadą wydarzenia: wolne miejsce daje `registered`, brak miejsca daje `waitlisted`;
    - wiersz `withdrawn` jest używany ponownie, z nowym `state_changed_at`.
  - `unregisterFromEvent(eventId: string, userId: string, hooks?: RegistrationHooks): Promise<{ txid: number }>`: ustawia `withdrawn`, usuwa zapisy na punkty programu i wywołuje `promoteFromWaitlist`.
  - `promoteFromWaitlist(tx: TransactionClient, eventId: string): Promise<RegistrationChange[]>`: dopóki `event_seat_counts.seats_remaining > 0`, zmienia najstarszy (`state_changed_at`) wpis `waitlisted` na `registered`.
  - Te same funkcje dostają opcjonalne `hooks?: RegistrationHooks` i wywołują `promoteFromWaitlist` po zwolnieniu miejsc: `updateEvent` (wzrost `max_seats`), `closeGroup`, `closeExpiredGroups`, `removeMember`.
  - `registerForAgendaItem`: osoba w stanie `waitlisted` dostaje `EVENT_WAITLISTED`. Brak zapisu na pełne wydarzenie nadal daje `EVENT_FULL`, bo punkty programu nie mają listy rezerwowej (spec, K2).
  - `getMyRegistrationStates(userId: string): Promise<{ eventId: string; state: "registered" | "waitlisted"; waitlistPosition: number | null }[]>` zastępuje `getRegisteredEventIdsForUser`, razem z jej funkcją serwerową i `queryOptions`.
  - Interfejs:
    - przy braku miejsc przycisk „Zapisz na listę rezerwową”;
    - po zapisie „Jesteś na liście rezerwowej (pozycja N)” i „Wypisz się z listy”.

- [ ] **Step 1: Napisz testy e2e** (najpierw czerwone):
  - `[F5] zapis na pełne wydarzenie trafia na listę rezerwową @uczestnik`: limit 1 zajęty. Kliknięcie „Zapisz na listę rezerwową” pokazuje „pozycja 1”.
  - `[F5] po rezygnacji pierwsza osoba z listy awansuje @uczestnik`: osoba A zapisana, B i C na liście. Po rezygnacji A osoba B (w osobnym kontekście) widzi „Jesteś zapisany”, a C „pozycja 1”.
  - `[F5] osoba z listy rezerwowej nie zapisze się na punkt programu`: widzi komunikat `EVENT_WAITLISTED`.
- [ ] **Step 2: Napisz testy Vitest:**
  - `20 concurrent registrations for 5 seats give 5 registered and 15 waitlisted`;
  - `concurrent withdrawals promote exactly as many, in waitlist order`;
  - `re-registering after withdrawal joins the end of the waitlist`;
  - `raising max_seats by 2 promotes 2`;
  - `closing a group promotes waitlisted people into released places`;
  - `migration keeps existing rows registered with unchanged counts` (wiersze dodane przed migracją `0011` w teście migracji).
- [ ] **Step 3: Run:** `pnpm --filter @repo/db test && pnpm e2e --grep "\[F5\]"`. Expected: FAIL z powodu braku listy rezerwowej.
- [ ] **Step 4: Zaimplementuj** według Interfaces.
- [ ] **Step 5: Run:** `pnpm test && pnpm e2e`. Expected: wszystko zaliczone, także `[F26]` i `[F27]`.
- [ ] **Step 6: Commit:** `feat(registrations): waitlist with automatic promotion (F5)`

### Task 10: E-maile o zapisie, liście rezerwowej i awansie (F6) oraz `CLAUDE.md`

Spełnia F6 bez e-maila o odwołaniu, który dochodzi w planie 2 razem z odwołaniem wydarzenia. Dodatkowo aktualizacja `CLAUDE.md` (lista B7).

**Files:**
- Create: `packages/api/src/notifications/registration-email.tsx` (pl/en)
- Modify:
  - `packages/jobs/src/queues.ts` (wariant `"registration"` w `emailJob`);
  - `apps/worker/src/handlers/send-email.ts`;
  - `packages/api/src/events/mutations.ts` oraz miejsca wywołujące funkcje z zadania 9: przekazanie `hooks.onChanged` → `enqueueEmails(changes → jobs, { tx })`;
  - `apps/worker/src/handlers/close-expired.ts`.
- Modify: `CLAUDE.md`
  - rola administratora istnieje;
  - zapisy mają stan i listę rezerwową;
  - grupy i punkty programu działają;
  - brak Redis;
  - strefa czasowa z konfiguracji;
  - sposób pracy z listy B (jeden plan, test e2e przed kodem, `pnpm e2e`).
- Test: `apps/worker/test/handlers.test.ts`, `e2e/tests/f6-powiadomienia.spec.ts`

**Interfaces:**
- Consumes: z zadania 8 `EmailJob`, `enqueueEmails`, `handleEmailJob`; z zadania 9 `RegistrationHooks`, `RegistrationChange`.
- Produces: `handleEmailJob({ kind: "registration", … })`.
  - Wczytuje zapis, wydarzenie i użytkownika.
  - Wysyła wiadomość w języku `event_registrations.locale`, z tytułem, terminem (`formatEventDateTime`) i linkiem do wydarzenia.
  - Pomija zadanie bez błędu, gdy zapisu nie ma albo jego stan nie pasuje do `change` (`confirmed` i `promoted` wymagają `registered`, a `waitlisted` wymaga `waitlisted`).

- [ ] **Step 1: Napisz testy e2e** (najpierw czerwone):
  - `[F6] zapis wysyła potwierdzenie @uczestnik`: w Mailpit jest wiadomość do zapisanej osoby z tytułem wydarzenia w temacie i linkiem do strony wydarzenia.
  - `[F6] zapis na listę rezerwową wysyła informację o liście`.
  - `[F6] awans z listy wysyła e-mail o awansie`: osoba B po rezygnacji A dostaje wiadomość „miejsce się zwolniło” z linkiem.
- [ ] **Step 2: Napisz test workera.** `registration job for a withdrawn registration sends nothing`: w Mailpit nie ma nowej wiadomości.
- [ ] **Step 3: Run:** `pnpm --filter worker test && pnpm e2e --grep "\[F6\]"`. Expected: FAIL (brak e-maili).
- [ ] **Step 4: Zaimplementuj;** zaktualizuj `CLAUDE.md`.
- [ ] **Step 5: Run:** `pnpm lint && pnpm typecheck && pnpm test && pnpm e2e`, a potem wypchnij i `gh run watch`. Expected: wszystko zielone lokalnie i w CI.
- [ ] **Step 6: Commit:** `feat(notifications): registration, waitlist and promotion e-mails (F6); update CLAUDE.md`
