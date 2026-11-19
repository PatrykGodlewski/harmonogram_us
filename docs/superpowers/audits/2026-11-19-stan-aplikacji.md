> **ARCHIWALNE (2026-11-19).** Zastąpione przez `docs/superpowers/specs/2026-11-19-produkt-design.md`. Zostaje jako zapis historii; nie jest źródłem prawdy.

# Audyt stanu aplikacji — 2026-11-19

Zlecenie: `docs/superpowers/briefs/2026-11-19-kierunek-produktu.md`, Krok 2. Stan kodu: gałąź `next`, commit `d9e28b4`. Każde stwierdzenie ma dowód (ścieżka:linia, commit albo komenda z wynikiem).

**Położenie dokumentów** (zgodne ze zleceniem): specyfikacje w `docs/superpowers/specs/` (2 pliki), plany w `docs/superpowers/plans/` (2 pliki), brief w `docs/superpowers/briefs/`. Ledgerów brak: katalog `.superpowers/sdd/` jest pusty (`ls .superpowers/sdd/*/progress.md` → „no matches found”). Wcześniejszego audytu ani briefu nie było.

## Krok 1 — punkt zatrzymania

| Pozycja | Stan | Dowód |
|---|---|---|
| Brief zapisany bez zmian | zacommitowany | `d9e28b4 docs: product direction brief …` |
| Zadanie w toku (refaktoryzacja po przeglądzie, partie B2–D) | dokończone i wypchnięte | `2e4771c` (triggery na poziomie instrukcji), `19a4530` (API: typowane kody błędów, wspólny limiter), `2f69f97` (UI: wspólna mapa komunikatów); `git push origin next` → `origin/next` = `2f69f97` |
| Wpis w ledgerze | niemożliwy — plan wykonywano bez ledgera (patrz wyżej); dowodem są commity i przebiegi testów | — |
| Zmiany niezwiązane z zadaniem | brak; drzewo robocze czyste | `git status --short` → pusto (przed zapisem audytu) |
| Testy bazowe | `pnpm test` → **121/121 zaliczone**, kod wyjścia 0, 42 s, na `d9e28b4` | api 19, ui 7, worker 4, collections 7, db 84 (wyjście turbo/vitest) |

Zadanie w toku nie dotyczyło komercjalizacji, więc wyjątek z Kroku 1.3 nie miał zastosowania.

## A. Zadania planów

Żaden plan nie ma zaznaczonych kroków (`grep -c '\- \[x\]'` → 0 w obu plikach; 43 i 39 pól `- [ ]`). Plany wykonywano bez aktualizacji pól wyboru i bez ledgera, więc status ustalono z `git log main..next`. Testy wymienione poniżej przechodzą w przebiegu bazowym.

### `docs/superpowers/plans/2026-11-18-agenda-registration.md`

| Task | Tytuł | Status | Dowód |
|---|---|---|---|
| 1 | Schema, migrations, count triggers, and the DB test harness | ukończone | `e275d9c`; migracje `0002`, `0003`; `packages/db/test/seat-counts.test.ts` |
| 2 | Registration queries for agenda items | ukończone | `84f5c38`; `packages/db/test/registrations.test.ts` |
| 3 | Agenda CRUD, event details, and registrant queries | ukończone | `79d2970`; `packages/db/test/agenda-items.test.ts` |
| 4 | Shared Warsaw-time and agenda-layout helpers | ukończone | `26a9b18`; `packages/ui/test/time.test.ts`, `agenda.test.ts` |
| 5 | API server functions, Electric proxy and collection | ukończone | `21ccac6`, poprawka `de6f7f8`; `packages/collections/test/*.test.ts` |
| 6 | Public event details page | ukończone | `99bbfd8`; brak testu automatycznego w repozytorium (patrz H) |
| 7 | Admin event page with agenda editor and registrants | ukończone | `1a3824c`; brak testu automatycznego w repozytorium |
| 8 | Admin role (#12) | ukończone | `86ddf78`; `packages/db/test/roles.test.ts` |

Poprawki po przeglądzie: `00a111a` (migracja `0006`, przeliczenie pod blokadą), `b07a7f6`, `6de62d6`, `b98287a`, `bd7e4c1`, `f21275f` (kolejność blokad).

### `docs/superpowers/plans/2026-11-18-group-registration.md`

| Task | Tytuł | Status | Dowód |
|---|---|---|---|
| 1 | Schema, hold-aware count triggers | ukończone | `ac0b1f5`; migracje `0007`, `0008`; `packages/db/test/group-holds.test.ts` |
| 2 | Group lifecycle queries | ukończone | `b0ab88a`; `packages/db/test/groups.test.ts` |
| 3 | Acceptance, member changes, account-safety helpers | ukończone | `7a08754`; `group-members.test.ts`, `account-safety.test.ts` |
| 4 | `@repo/jobs`, worker app, invitation email, deployment | ukończone | `2cfac7d`, `7a72964`; `apps/worker/test/handlers.test.ts`, `packages/api/test/transactional-enqueue.test.ts` |
| 5 | Auth: invitation plugin, account-safety hooks, verification email | ukończone | `1dabad6`; `packages/api/test/group-invitation-plugin.test.ts` |
| 6 | API server functions | ukończone | `1fe0409` (+ `7c8e703` testy bez Redis) |
| 7 | Web UI | ukończone | `01edbec`; brak testu automatycznego w repozytorium |
| 8 | Admin: groups on the event page, deadline setting | ukończone | `93dda71`; brak testu automatycznego w repozytorium |

Poprawki i refaktoryzacja po planie: `722d88b`, `2b8b7e4`, `1d6e609`, `6e5c646`, `11e4f22`, `035bc16`, `2e4771c` (migracja `0009`), `19a4530`, `2f69f97`.

**Praca spoza planów:** „projekt 3” (pełny Docker) jest zapowiedziany w specach (`2026-11-18-agenda-registration-design.md:11`, `2026-11-18-group-registration-design.md:37`), ale nie ma speca ani planu i jest nierozpoczęty. Motyw wizualny (prośba użytkownika) też nie ma speca ani planu. Wcześniejsze commity w `main..next` spoza planów: `6de62d6` (zgodność z dokumentacją bibliotek), `b98287a` (zadanie typecheck).

**Ocena według Z2:** oba plany mają wszystkie zadania ukończone, więc nie ma zadań do klasyfikacji. Pierwszy nowy plan startuje od `d9e28b4` (Z6).

## B. Stan gałęzi

| Pozycja | Wartość | Dowód |
|---|---|---|
| Gałąź robocza | `next` | `git status -sb` → `## next...origin/next [ahead 1]` (lokalnie jest commit briefu `d9e28b4`, którego nie ma jeszcze na zdalnej) |
| Worktree | jeden, główny katalog repozytorium | `git worktree list` → `/home/godlew/projects/harmonogram_us d9e28b4 [next]` |
| Względem `main` | 40 commitów przed `main`, niescalone | `git rev-list --count main..next` → 40; `git merge-base main next` → `80a1d64` (= `main`, 2026-06-06) |
| Scalenie z `main` | nie; decyzja należy do użytkownika (stąd gałąź `next`) | `git branch -a --contains next` → tylko `next` |

## C. Architektura w obecnym kształcie

### Stack i wersje (zakresy z `package.json`)

| Składnik | Wersja | Źródło |
|---|---|---|
| Node / pnpm / Turbo / Biome | `>=22.12.0` / `pnpm@10.33.2` / `^2.9.6` / `^2.4.13` | `package.json` (engines, packageManager, devDependencies) |
| TanStack Start / Router / Query | `^1.167.45` / `^1.168.23` / `^5.100.1` | `apps/web/package.json` |
| TanStack DB / react-db / electric-db-collection | `0.6.8` (override) / `^0.1.83` / `^0.3.6` | `package.json` `pnpm.overrides`, `packages/collections/package.json` |
| React / Vite / TypeScript | `^19.2.5` (override) / `8.0.10` (override) / `^6.0.3` | `package.json`, `apps/*/package.json` |
| Drizzle ORM / drizzle-kit / postgres-js | `^0.45.2` / `^0.31.10` / `^3.4.9` | `packages/db/package.json` |
| Better Auth | `^1.6.9` | `packages/api/package.json` |
| pg-boss / esbuild | `^12.38.2` / `^0.27.0` | `apps/worker/package.json` |
| Paraglide / Tailwind / Zod | `^2.16.1` / `^4.2.4` / `^4.3.6` | `apps/web/package.json` |
| ioredis / nodemailer / Vitest | `^5.10.1` / `^8.0.6` / `^5.1.1` | `packages/api/package.json` |
| Postgres / Redis / Electric / Mailpit (dev) | `postgres:16-alpine` / `redis:7-alpine` / `electricsql/electric:latest` / `axllent/mailpit:latest` | `docker-compose.yml:3,16,23,32` |

### Moduły i zależności między `@repo/*` (z `package.json`, bez `@repo/config`)

| Pakiet | Zależy od |
|---|---|
| `apps/web` | api, collections, db, env, i18n, jobs, router-utils, ui |
| `apps/admin` | api, env, i18n, router-utils, ui |
| `apps/worker` | api, db, env, i18n, jobs, ui |
| `@repo/api` | db, env, i18n, jobs |
| `@repo/ui` | api, db, env, i18n |
| `@repo/db`, `@repo/jobs`, `@repo/collections`, `@repo/env`, `@repo/i18n` | tylko env lub nic |
| `@repo/router-utils` | i18n |

Uwaga: `@repo/ui` zależy od `@repo/api` i `@repo/db`, a więc warstwa prezentacji od warstwy danych (`packages/ui/package.json`). Cykl nie występuje, bo `api` nie zależy od `ui`.

### Model danych (migracje `0000`–`0009`, `packages/db/src/schema/*`)

| Tabela | Kluczowe kolumny i ograniczenia | Dowód |
|---|---|---|
| `user` | `id`, `name`, `email` unikalny, `email_verified`, `role text default 'user'` | `schema/better-auth.ts:4-11`, `migrations/0005` |
| `session`, `account`, `verification` | standard Better Auth (`account.password`, `provider_id`) | `schema/better-auth.ts:20-71`, `migrations/0000` |
| `events` | `title`, `description`, `date`, `ends_at`, `max_seats`, `group_deadline_hours default 48`, FK `type_id`/`location_id`/`faculty_id`; **brak statusu, kategorii, strefy czasowej, ochrony i treści dwujęzycznej** | `schema/events.ts:5-27`, `migrations/0001`, `0004` |
| `event_types`, `event_locations`, `event_faculties` | płaskie słowniki | `schema/event-lookups.ts:6-32` |
| `event_registrations` | `event_id`, `user_id`, `group_id`; UNIQUE (`event_id`,`user_id`); **brak kolumny stanu**: zapis = istnienie wiersza, rezygnacja = DELETE | `migrations/0001:63`, `queries/event-registrations.ts:212` |
| `event_seat_counts` | utrzymywana triggerami, `CHECK (seats_remaining >= 0)` | `migrations/0003:43` |
| `agenda_items` | `requires_registration`, `max_seats`, `CHECK ends_at > starts_at` | `schema/agenda.ts:17-31`, `migrations/0002:30` |
| `agenda_item_registrations` | UNIQUE (`agenda_item_id`,`user_id`) | `migrations/0002:40` |
| `agenda_item_seat_counts` | `CHECK (seats_remaining IS NULL OR >= 0)` | `migrations/0003:47` |
| `registration_groups` | `status text default 'open'` (open/closed), `places CHECK > 0`, `join_code` | `schema/groups.ts:18-31`, `migrations/0007:38` |
| `registration_group_members` | `status text default 'invited'` (invited/confirmed), `token_hash`, UNIQUE (`group_id`,`email`) | `schema/groups.ts:61-70`, `migrations/0007:52` |
| `registration_group_items`, `registration_group_member_items` | przypisanie sesji do grupy i członka | `schema/groups.ts:48,97` |

Triggery: funkcje odświeżania liczników z zasadą „najpierw blokada, potem przeliczenie” (`migrations/0006:7,23`), uwzględnianie miejsc trzymanych przez grupy (`0008:5-161`) i triggery na poziomie instrukcji z tabelami przejść (`0009:13-123`). Liczniki może zmieniać tylko trigger (CLAUDE.md, sekcja „Live seat counts”).

### Logowanie i role

- Better Auth z adapterem Drizzle: e-mail z hasłem, magic link, opcjonalni dostawcy społecznościowi, captcha Turnstile tylko wtedy, gdy ustawiono `TURNSTILE_SECRET_KEY`, oraz własna wtyczka zaproszeń grupowych (`packages/api/src/auth/better-auth.ts:32,67,381-392`; `auth/group-invitation-plugin.ts`).
- Role: jedna kolumna tekstowa `user.role` (`user`/`admin`) (`schema/better-auth.ts:11`). Admina sprawdza `isAdmin()` z `@repo/db/queries/roles` (`packages/api/src/auth/user.ts:2,40`). `adminMiddleware` odrzuca nie-adminów kodem `FORBIDDEN` (`packages/api/src/auth/admin-middleware.ts:6-16`), a test jest w `packages/db/test/roles.test.ts`. CLAUDE.md twierdzi, że sprawdzenia roli nie ma (#12). **To jest nieaktualne**, bo sprawdzenie istnieje od `86ddf78`.
- Brakuje: uprawnień per wydarzenie lub kategoria, roli organizatora, grup i list dostępu, logowania przez uczelnianego dostawcę tożsamości (P8).

### Przebieg zapisu (stany i przejścia)

| Obiekt | Stany | Przejścia | Dowód |
|---|---|---|---|
| Rejestracja na wydarzenie | brak enuma: jest wiersz albo go nie ma | zapis (INSERT, odmowa przy pełnym limicie przez CHECK → `EVENT_FULL`), rezygnacja (DELETE) | `queries/event-registrations.ts:93,175,212` |
| Rejestracja na sesję | jest wiersz albo go nie ma | zapis wymaga rejestracji na wydarzenie (tworzy ją); rezygnacja z sesji | `queries/event-registrations.ts`, `test/registrations.test.ts` |
| Grupa | `open` → `closed` | zamknięcie przez właściciela albo zadanie `close-expired-groups` po terminie | `queries/groups.ts` (`closeGroup`, `closeExpiredGroups`) |
| Członek grupy | `invited` → `confirmed`; usunięcie | akceptacja zaproszenia (`acceptInvitation`), usunięcie przez właściciela | `queries/group-members.ts:83-171,214` |
| Lista rezerwowa, moderacja, płatność | **brak** | — | brak kolumn i enumów (`grep -n status schema/*.ts` → tylko `groups.ts:31,70`) |

### Powiadomienia

- E-mail przez Nodemailer z szablonami react-email (`packages/api/src/notifications/email.tsx`, `magic-link-email.tsx`, `group-invitation-email.tsx`). Lokalnie wiadomości trafiają do Mailpit.
- Kolejki pg-boss (`packages/jobs/src/queues.ts:4-9`):
  - `group-invitations`: polityka `short`, `singletonKey` = memberId;
  - `close-expired-groups`: cron `*/5 * * * *` w strefie Europe/Warsaw.
- Wysyłki są dodawane do kolejki w tej samej transakcji co dane (`packages/jobs/src/client.ts`, `enqueueInvitationEmails(..., { tx })`).
- E-mail weryfikacyjny Better Auth idzie poza kolejką (patrz D5).

### API

Funkcje serwerowe (`createServerFn`) w `packages/api/src`:

| Domena | Funkcje |
|---|---|
| `events/queries.ts` | `fetchFilterOptionsServer`, `fetchEventsServer`, `fetchEventDetailsServer` |
| `events/mutations.ts` | `registerForEventServer`, `unregisterFromEventServer`, `registerForAgendaItemServer`, `unregisterFromAgendaItemServer` |
| `events/my-registrations.ts` | `fetchMyRegisteredEventIdsServer`, `fetchMyRegistrationsServer` |
| `groups/queries.ts` | `fetchMyGroupsServer`, `fetchGroupDetailsServer`, `fetchJoinGroupInfoServer`, `fetchInvitationServer` |
| `groups/mutations.ts` | `createGroupServer`, `inviteToGroupServer`, `resendInvitationServer`, `removeMemberServer`, `setMemberItemsServer`, `updateGroupServer`, `closeGroupServer`, `joinGroupServer` |
| `admin/queries.ts` | wydarzenia, słowniki, opcje filtrów, szczegóły wydarzenia, zapisani, grupy (8 funkcji `fetchAdmin*Server`) |
| `admin/mutations.ts` | CRUD wydarzeń, typów, miejsc, wydziałów i sesji (15 funkcji `*Admin*Server`) |
| `auth/current-user-query.ts` | `fetchCurrentUserServer` |

Endpoint Better Auth: `routes/api/auth/$.ts` w obu aplikacjach, plus `POST /group-invitation/accept` (wtyczka). Proxy kształtów Electric: `apps/web/src/routes/api/electric/event-seat-counts.ts`, `agenda-item-seat-counts.ts`.

**Brakuje** publicznego API REST lub OpenAPI, eksportu iCal i eksportu HTTP w stylu Indico (`grep -rniE "ical|openapi|text/calendar" apps/*/src packages/*/src` → tylko fałszywe trafienia w słowach typu „automatically”, „vertical”).

### Tłumaczenia

Paraglide 2, dwa locale `en` (bazowe) i `pl` (`packages/i18n/project.inlang/settings.json:3-4`), po 293 komunikaty w `messages/en.json` i `messages/pl.json`. Prefiksy `/en`, `/pl` w URL. Teksty zaszyte poza tłumaczeniami wymienia D2.

### Dostępność

- Pojedyncze elementy: `aria-live="polite"` na licznikach miejsc (`apps/web/src/components/event-details/agenda-item-row.tsx:68`, `event-summary.tsx:65`, `routes/groups/$groupId.tsx:154`), `sr-only` w komponentach shadcn.
- **Brak** automatycznego testu dostępności (`grep -rl "axe-core\|@axe" apps packages` → pusto), deklaracji dostępności i audytu WCAG.

### Wdrożenie

- `Dockerfile`: wieloetapowy, `turbo prune` i `ARG APP=web|admin|worker`, wynik w `.output` albo `dist` (`Dockerfile:1-40`).
- `railway.toml` dla web, admin i worker.
- `docker-compose.yml` uruchamia tylko usługi pomocnicze (db, mailpit, redis, electric) bez samych aplikacji.
- Electric dostaje `DATABASE_URL` z `.env` hosta (`docker-compose.yml:37`), czyli `localhost:5432` (`.env.example:24`). Ten adres nie działa z wnętrza kontenera (D6).
- CI nie istnieje (`ls .github` → brak katalogu).

### Mechanizm wtyczek

**Brak.** `grep -rni plugin` w kodzie aplikacji zwraca tylko wtyczki Better Auth (`group-invitation-plugin.ts`, `captcha`, `magicLink`) oraz konfigurację Vite, Babel i Tailwind. Integracje są zaszyte w rdzeniu: Turnstile (`packages/api/src/security/turnstile.ts`), SMTP (`notifications/email.tsx`), Redis (`security/rate-limit.ts`), dostawcy społecznościowi (`auth/social-providers.ts`), Electric (`@repo/collections`).

## D. Rejestr rozwiązań tymczasowych (definicja: zlecenie, sekcja 6)

Metoda (bash, z pominięciem `node_modules`, `paraglide`, `.output`, `dist`, `.nitro`, `.tanstack`, `routeTree.gen.ts`, `migrations/meta`):

- `grep -rnE "TODO|FIXME|HACK|XXX"` → 0 trafień;
- `grep -rnE "\.(skip|only|todo)\(|xit\("` → 0 trafień;
- zakomentowany kod (`^\s*//.*(;|=>|\) \{)$`) → 0 trafień;
- przegląd każdego `catch` i `.catch(`;
- `grep Warsaw`;
- `grep` zaszytych tekstów interfejsu.

| # | Rozwiązanie tymczasowe | Miejsce | Ocena |
|---|---|---|---|
| D1 | Strefa czasowa zaszyta w kodzie: wszystkie czasy wydarzeń są w Europe/Warsaw, a wydarzenie nie ma własnej strefy | `packages/ui/src/time.ts:2` (`EVENT_TIME_ZONE`), `packages/jobs/src/queues.ts:9` (`JOBS_TIME_ZONE`) | Wartość instalacji w kodzie (T6). Brak strefy wydarzenia przeczy F-I18-02 |
| D2 | Teksty interfejsu poza plikami tłumaczeń | `packages/ui/src/components/dialog.tsx:75,113` („Close”), `sheet.tsx:77`, `sidebar.tsx:197,287,290`, `composed/admin/admin-entity-table.tsx:74` („Actions”), `composed/login.tsx:258` („Failed to send login link”), `composed/signup.tsx:274,277` („Failed to sign up”) | Przeczy P6 („teksty interfejsu wyłącznie w plikach tłumaczeń”) |
| D3 | Połknięty wyjątek: błąd `awaitTxId` jest ignorowany bez logu i bez obsługi zastępczej | `apps/web/src/lib/event-details/use-event-details-registrations.ts:119` | Połykanie wyjątków |
| D4 | Połknięty wyjątek: błąd `awaitTxId` jest ignorowany; odświeżenie listy następuje, ale przyczyna ginie | `apps/web/src/lib/events/seat-count.ts:74` | Połykanie wyjątków (łagodniejsze niż D3) |
| D5 | Błąd wysyłki e-maila weryfikacyjnego jest tylko logowany i nie wraca do kolejki | `packages/api/src/auth/better-auth.ts:285-293` | Wiadomość może zginąć. Niespójne z wysyłką zaproszeń, która ma ponowienia w pg-boss (`packages/jobs/src/client.ts`) |
| D6 | Środowisko Docker niepowtarzalne: Electric dostaje adres bazy hosta (`localhost`), obrazy mają tag `:latest`, compose nie uruchamia aplikacji | `docker-compose.yml:16,32,37`; `.env.example:24` | Przeczy F-OPS-01 („bez ręcznych kroków”). Odpowiada nierozpoczętemu „projektowi 3” |
| D7 | Każdy błąd limitera, także awaria Redis, zamienia się w `RATE_LIMITED`. Awaria infrastruktury jest przedstawiana użytkownikowi jako przekroczenie limitu | `packages/api/src/security/rate-limit.ts:59-63`; to samo w `packages/api/src/auth/better-auth.ts:128-132` | Maskowanie wyjątku |
| D8 | Ochrona po cichu wyłączona przez brak konfiguracji: bez `REDIS_URL` limity się nie stosują, bez `TURNSTILE_SECRET_KEY` captcha jest pomijana, w obu przypadkach bez błędu przy starcie w produkcji | `packages/env/src/index.ts:35-36`, `packages/api/src/security/rate-limit.ts:55-57`, `security/turnstile.ts:9-11`, `auth/better-auth.ts:383` | To konfiguracja (T6), ale brak wymuszenia w produkcji działa jak flaga ukrywająca brak zabezpieczenia. Do decyzji w Kroku 4 |
| D9 | Zaszyty domyślny nadawca z roboczą nazwą projektu | `packages/api/src/notifications/email.tsx:32` (`noreply@harmonogram.local`) | Dane na sztywno udające konfigurację (T6) |

**Sprawdzone, uznane za poprawne:**

| Miejsce | Powód |
|---|---|
| `packages/db/src/queries/*` (`catch (error)` → `mapConstraintError`) | Wyjątek jest tłumaczony na kod domenowy i rzucany dalej |
| `packages/api/src/auth/better-auth.ts:216,232` | Nieprawidłowy URL lub referer daje zdefiniowaną wartość zastępczą (inny sygnał locale) |
| `packages/db/src/queries/account-safety.ts:61` | Nieparsowalny JSON tokenu oznacza „brak e-maila” zgodnie z kontraktem funkcji |
| `packages/env/src/index.ts:9` | Walidacja klucza zwraca false |
| `packages/api/src/auth/user.ts:69`, `apps/web/src/routes/account.tsx:295`, `packages/ui/src/composed/signup.tsx:276`, `group-invitation-plugin.ts:52,64` | Wyjątek jest rzucany dalej |
| `packages/jobs/src/client.ts:40` | Reset obietnicy i ponowne rzucenie |
| `apps/web/src/server.ts:5` | Rozgrzewka kolejki przy starcie; błąd jest logowany, a pierwsze użycie ponawia `getBoss` |
| `security/turnstile.ts:26` | Brak JSON skutkuje `CAPTCHA_FAILED` |
| `apps/web/src/lib/events/seat-count.ts:63` | Wartość zastępcza: odświeżenie listy |
| `.catch()` w schematach Zod (`events/schemas.ts:16-19`, `routes/events/$eventId.tsx:27`) | Domyślne wartości parametrów URL |
| `apps/web/src/routes/join/$code.tsx:32`, `invite/$token.tsx:32` | Nieznany kod lub token wyświetla stronę „nie znaleziono” |
| `packages/db/src/seed/data.ts:170` | Dane seed, nie produkcja |
| `packages/db/vitest.config.ts:4` | Adres bazy testowej w kodzie testów |
| `process.exit` w `apps/worker/src/index.ts:44`, `seed/run.ts:10` | Zakończenie procesu |

Ręcznych zmian bazy nie znaleziono: wszystkie zmiany schematu są w migracjach `0000`–`0009`, a dziennik migracji jest w `migrations/meta/_journal.json`.

## E. Komercjalizacja

**Pusto.** Wykonane sprawdzenia:

- `ls LICENSE* NOTICE*` → brak plików. Repozytorium nie ma licencji, co jest wejściem do pytania O3.
- Pole `license` we wszystkich 13 plikach `package.json` → `None`.
- `grep -rniE "licen[cs]e|pricing|paywall|subscription|telemetry|analytics|billing"` w `apps/*/src` i `packages/*/src` → 0 trafień.
- W kodzie nie ma telemetrii ani połączeń z serwerem producenta.
- Jedyne połączenia wychodzące to Cloudflare Turnstile (`security/turnstile.ts`, tylko gdy skonfigurowano), sprawdzenie MX domen e-mail (`security/email-policy.ts:26`, `validateMx: true`) i sprawdzenie haseł HIBP (`auth/better-auth.ts:164`, User-Agent `harmonogram-us-auth`). Wszystkie trzy to funkcje bezpieczeństwa wywoływane przez instancję, nie telemetria.

Pytanie O4 nie ma zastosowania.

## Inwentarz Indico — liczby kontrolne (Krok 3.2)

Źródła: `indico` na `7bc32f2fe889943ef5df9c00ddfe868c9720cd34` (płytki klon w `../indico-ref`), `indico-plugins` na `1be80e0ec25a58df0530c7dcb3e0d4eff5a78c95` (2026-11-11; zlecenie nie przypina commita wtyczek, więc zapisano ten, który pobrano). Skrypt: `docs/superpowers/parity/tools/inwentarz.py` (statyczna analiza AST; kod Indico nie jest uruchamiany).

| Pozycja | Zlecenie | Skrypt | Różnica | Metoda i wyjaśnienie |
|---|---|---|---|---|
| `add_url_rule` w `blueprint.py` | 1004 | 1004 | 0 | wywołania w plikach `blueprint.py` poza `tests/` |
| klasy `RH*` | 1078 | 1082 | +0,4% | klasy `RH*` we wszystkich modułach poza testami |
| tabele | 143 | 171 | +19,6% | 143 = dosłowne deklaracje `__tablename__` (skrypt potwierdza 143). Skrypt liczy tabele fizyczne: pomija 4 abstrakcyjne bazy (`JSONSettingsBase`, `PrincipalSettingsBase`, `BaseFileType`, `LogEntryBase`), dolicza klasy dziedziczące nazwę tabeli z abstrakcyjnej bazy (6 tabel ustawień, 4 tabele dzienników, typy plików redakcji) → 150 tabel modeli, i dodaje 21 tabel asocjacyjnych `db.Table(...)` |
| klasy enum | 80 | 87 | +8,8% | 80 = enumy w `indico/modules`; skrypt dolicza 7 enumów z `indico/core` i `indico/util` (np. `ProtectionMode`, `PrincipalType`). Pomija 31 historycznych kopii w migracjach Alembic. 56 z 87 opisuje stan lub tryb (nazwa kończy się na State, Status, Mode, Action, Type) i trafia do macierzy G4 |
| sygnały | 166 | 166 | 0 | wywołania `.signal(...)` w `indico/core/signals` |
| ustawienia konfiguracji | 97 | 97 | 0 | `.. data::` w `docs/source/config/settings.rst` |
| pliki testów Python | 142 | 142 | 0 | `*_test.py` |
| moduły w `indico/modules` | 23 | 23 | 0 | katalogi z `__init__.py` (do tego 26 podmodułów pierwszego poziomu) |
| lokalizacje tłumaczeń | 19 | 19 | 0 | katalogi z `LC_MESSAGES` |
| wtyczki `indico-plugins` | 18 | 18 | 0 | katalogi bez `_meta` |

Pozostałe rodzaje pozycji: 56 poleceń CLI, 20 zadań Celery (w tym cykliczne), 20 eksporterów HTTP API (hooki i formaty), 32 rozdziały referencji API, 7 funkcji wydarzenia, 30 uprawnień zarządzania. Razem 1776 pozycji: 1665 przypisanych do wierszy katalogu, 111 wyłączonych z powodów F1 (a: 83, b: 5, c: 23), 0 nieprzypisanych. Dwa kolejne przebiegi skryptu dają bajtowo identyczny plik (`cmp` → brak różnic).

## F. Mapa parytetu

Źródło wierszy: `docs/superpowers/parity/katalog-funkcji.yaml` (752 wiersze, commit `a80945a`). Status „spełniona” wymaga przechodzącego testu e2e oznaczonego ID wiersza. W repozytorium nie ma testów e2e (sekcja H), więc **żaden wiersz nie jest spełniony**. „Częściowo” oznacza, że część zachowania wiersza istnieje w kodzie albo jest sprawdzana testem integracyjnym. Dowód podano niżej. Pozostałe wiersze mają status „brak”: kodu realizującego ich zachowanie nie ma (sekcja C opisuje cały obecny zakres aplikacji).

**Parytet: 0% wierszy zielonych** (0 z 747 wierszy „wymagana”).

| Domena | Wiersze | wymagana | spełniona | częściowo | brak | wyłączone / do decyzji |
|---|---|---|---|---|---|---|
| WYD | 75 | 75 | 0 | 7 | 68 | 0 |
| DOS | 21 | 21 | 0 | 1 | 20 | 0 |
| REJ | 119 | 119 | 0 | 19 | 100 | 0 |
| PLT | 16 | 16 | 0 | 0 | 16 | 0 |
| ABS | 57 | 57 | 0 | 0 | 57 | 0 |
| REF | 25 | 25 | 0 | 0 | 25 | 0 |
| PAP | 27 | 27 | 0 | 0 | 27 | 0 |
| EDI | 27 | 27 | 0 | 0 | 27 | 0 |
| PRG | 25 | 25 | 0 | 0 | 25 | 0 |
| MAT | 26 | 26 | 0 | 0 | 26 | 0 |
| ANK | 14 | 14 | 0 | 0 | 14 | 0 |
| WYG | 13 | 13 | 0 | 0 | 13 | 0 |
| KOM | 26 | 26 | 0 | 2 | 24 | 0 |
| DOK | 20 | 20 | 0 | 0 | 20 | 0 |
| SAL | 50 | 50 | 0 | 0 | 50 | 0 |
| WID | 14 | 14 | 0 | 0 | 14 | 0 |
| UZY | 35 | 35 | 0 | 3 | 32 | 0 |
| UWT | 23 | 23 | 0 | 3 | 20 | 0 |
| WYS | 6 | 6 | 0 | 0 | 6 | 0 |
| API | 16 | 16 | 0 | 0 | 16 | 0 |
| ADM | 46 | 42 | 0 | 1 | 41 | 4 |
| PLG | 42 | 42 | 0 | 0 | 42 | 0 |
| I18 | 11 | 11 | 0 | 3 | 8 | 0 |
| OPS | 15 | 15 | 0 | 2 | 13 | 0 |
| MIG | 3 | 2 | 0 | 0 | 2 | 1 |
| **Razem** | **752** | **747** | **0** | **41** | **706** | **5** |

### Wiersze „częściowo” (dowód)

| Wiersz | Tytuł | Co istnieje (dowód) |
|---|---|---|
| F-WYD-05.1 | Tworzenie wydarzenia | `packages/api/src/admin/mutations.ts` (`createAdminEventServer`), panel `apps/admin/src/components/admin-events-page.tsx` |
| F-WYD-05.2 | Publikacja w dwie minuty | formularz tworzenia w panelu wymaga tytułu, terminu, typu, miejsca i wydziału (`packages/api/src/admin/mutations.ts`); brak publikacji z minimum pól i brak roli organizatora |
| F-WYD-05.4 | Edycja tytułu, opisu i skrótu adresu | `updateAdminEventServer` (tytuł, opis); brak skrótu adresu |
| F-WYD-05.5 | Edycja terminu i strefy czasowej | `updateAdminEventServer` (`date`, `endsAt`); brak strefy czasowej wydarzenia (D1) |
| F-WYD-05.6 | Edycja miejsca wydarzenia | miejsce ze słownika `event_locations` (`packages/db/src/schema/event-lookups.ts`) |
| F-WYD-05.9 | Usuwanie wydarzenia | `deleteAdminEventServer` |
| F-WYD-09.11 | Kalendarz kampusu z filtrami i wyszukiwaniem | lista z wyszukiwaniem i filtrami miejsca, wydziału i typu (`packages/api/src/events/schemas.ts:4-12`, `apps/web/src/routes/index.tsx`); brak widoku kalendarza, filtra terminu i formy |
| F-DOS-07.1 | Administratorzy systemu | kolumna `user.role`, `adminMiddleware` (`packages/api/src/auth/admin-middleware.ts`), `packages/db/test/roles.test.ts`; brak nadawania roli w interfejsie |
| F-REJ-01.5 | Limit uczestników formularza | `events.max_seats` i `CHECK (seats_remaining >= 0)` (`migrations/0003`), `packages/db/test/concurrency.test.ts` |
| F-REJ-05.5 | Wymóg logowania i konta | zapis wymaga zalogowania (`protectedActionFn`, `packages/api/src/events/mutations.ts`) |
| F-REJ-05.7 | Jedna rejestracja na osobę w formularzu | UNIQUE (`event_id`, `user_id`) (`migrations/0001`) |
| F-REJ-07.1 | Lista rejestracji w panelu | `apps/admin/src/components/admin-event-detail/registrants-list.tsx` |
| F-REJ-09.4 | Wycofanie rejestracji przez uczestnika | `unregisterFromEventServer` (`packages/api/src/events/mutations.ts`); wycofanie usuwa wiersz zamiast zmiany stanu |
| F-REJ-15.1 | CAPTCHA w formularzu | Turnstile w formularzu dołączania do grupy (`apps/web/src/routes/join/$code.tsx`); zwykły zapis nie ma CAPTCHA |
| F-REJ-17.2 | Zapis na punkt programu z własnym limitem | `registerForAgendaItem` i `agenda_item_seat_counts` (`packages/db/src/queries/event-registrations.ts`, `migrations/0002`, `0003`) |
| F-REJ-17.3 | Zapis na punkt programu rejestruje na wydarzenie | zapis na punkt programu tworzy rejestrację na wydarzenie (`packages/db/test/registrations.test.ts`) |
| F-REJ-19.1 | Utworzenie grupy | rejestracja grupowa (`packages/db/src/queries/groups.ts`, `group-members.ts`, testy `groups.test.ts`, `group-members.test.ts`, `group-holds.test.ts`; UI `apps/web/src/routes/groups/`, `join/`, `invite/`) |
| F-REJ-19.2 | Zaproszenia członków grupy e-mailem | rejestracja grupowa (`packages/db/src/queries/groups.ts`, `group-members.ts`, testy `groups.test.ts`, `group-members.test.ts`, `group-holds.test.ts`; UI `apps/web/src/routes/groups/`, `join/`, `invite/`) |
| F-REJ-19.3 | Dołączanie do grupy przez link i kod QR | rejestracja grupowa (`packages/db/src/queries/groups.ts`, `group-members.ts`, testy `groups.test.ts`, `group-members.test.ts`, `group-holds.test.ts`; UI `apps/web/src/routes/groups/`, `join/`, `invite/`) |
| F-REJ-19.4 | Potwierdzenie miejsca jednym przyciskiem | rejestracja grupowa (`packages/db/src/queries/groups.ts`, `group-members.ts`, testy `groups.test.ts`, `group-members.test.ts`, `group-holds.test.ts`; UI `apps/web/src/routes/groups/`, `join/`, `invite/`) |
| F-REJ-19.5 | Zarządzanie grupą przez nauczyciela | rejestracja grupowa (`packages/db/src/queries/groups.ts`, `group-members.ts`, testy `groups.test.ts`, `group-members.test.ts`, `group-holds.test.ts`; UI `apps/web/src/routes/groups/`, `join/`, `invite/`) |
| F-REJ-19.6 | Punkty programu członków grupy | rejestracja grupowa (`packages/db/src/queries/groups.ts`, `group-members.ts`, testy `groups.test.ts`, `group-members.test.ts`, `group-holds.test.ts`; UI `apps/web/src/routes/groups/`, `join/`, `invite/`) |
| F-REJ-19.7 | Termin potwierdzeń i automatyczne zamknięcie grup | rejestracja grupowa (`packages/db/src/queries/groups.ts`, `group-members.ts`, testy `groups.test.ts`, `group-members.test.ts`, `group-holds.test.ts`; UI `apps/web/src/routes/groups/`, `join/`, `invite/`) |
| F-REJ-19.8 | Liczniki miejsc uwzględniają grupy | rejestracja grupowa (`packages/db/src/queries/groups.ts`, `group-members.ts`, testy `groups.test.ts`, `group-members.test.ts`, `group-holds.test.ts`; UI `apps/web/src/routes/groups/`, `join/`, `invite/`) |
| F-REJ-19.9 | Przejścia stanów grupy i członka grupy | rejestracja grupowa (`packages/db/src/queries/groups.ts`, `group-members.ts`, testy `groups.test.ts`, `group-members.test.ts`, `group-holds.test.ts`; UI `apps/web/src/routes/groups/`, `join/`, `invite/`) |
| F-REJ-19.10 | Grupy w panelu administratora | rejestracja grupowa (`packages/db/src/queries/groups.ts`, `group-members.ts`, testy `groups.test.ts`, `group-members.test.ts`, `group-holds.test.ts`; UI `apps/web/src/routes/groups/`, `join/`, `invite/`) |
| F-REJ-19.11 | Moje grupy na koncie użytkownika | rejestracja grupowa (`packages/db/src/queries/groups.ts`, `group-members.ts`, testy `groups.test.ts`, `group-members.test.ts`, `group-holds.test.ts`; UI `apps/web/src/routes/groups/`, `join/`, `invite/`) |
| F-KOM-05.2 | Kolejka wysyłki i ponawianie | pg-boss, `retryLimit: 3` dla zaproszeń (`packages/jobs/src/client.ts:66`); e-mail weryfikacyjny bez kolejki (D5) |
| F-KOM-05.4 | Konfiguracja serwera pocztowego instalacji | `SMTP_*` w `packages/env/src/index.ts`, `packages/api/src/notifications/email.tsx` |
| F-UZY-01.1 | Zakładanie konta lokalnego z potwierdzeniem e-mail | `emailVerification` (`packages/api/src/auth/better-auth.ts:282`) |
| F-UZY-01.2 | Wymagania bezpieczeństwa hasła | `assertPasswordMeetsPolicy` z HIBP (`packages/api/src/auth/better-auth.ts:184`) |
| F-UZY-01.6 | Blokada adresów e-mail przy zakładaniu konta | `checkEmails`: domeny jednorazowe i MX (`packages/api/src/security/email-policy.ts`) |
| F-UWT-01.1 | Logowanie i wylogowanie hasłem | Better Auth `emailAndPassword` (`packages/api/src/auth/better-auth.ts:279`), `apps/web/src/routes/logout.tsx` |
| F-UWT-01.2 | Limit nieudanych prób logowania | `SIGN_IN_LIMIT` (`packages/api/src/security/rate-limits.ts:31`); wyłączony bez `REDIS_URL` (D8) |
| F-UWT-01.6 | CAPTCHA przy zakładaniu konta | Turnstile w rejestracji konta (`packages/ui/src/composed/signup.tsx`) |
| F-ADM-07.3 | Wysyłka wiadomości e-mail w tle | worker pg-boss (`apps/worker/src/handlers/send-invitation.ts`, `apps/worker/test/handlers.test.ts`) |
| F-I18-01.1 | Przełączanie języka interfejsu | Paraglide, prefiksy `/pl`, `/en` (`packages/i18n/project.inlang/settings.json`) |
| F-I18-01.4 | Wiadomości e-mail w języku odbiorcy | język e-maili logowania z nagłówków (`resolveAuthLocaleFromHeaders`, `packages/api/src/auth/better-auth.ts:243`) |
| F-I18-02.2 | Formaty dat i godzin zgodne z językiem | `formatWarsawDateTime(date, locale)` (`packages/ui/src/time.ts`, `packages/ui/test/time.test.ts`) |
| F-OPS-01.1 | Powtarzalne wdrożenie z kontenerów | `Dockerfile` (APP=web|admin|worker), `apps/*/railway.toml`; compose bez aplikacji (D6) |
| F-OPS-06.5 | Ograniczanie liczby żądań | `consumeRateLimit` (`packages/api/src/security/rate-limit.ts`) |

### Wiersze „brak” według domen

- **WYD** (68): F-WYD-01.1, F-WYD-01.2, F-WYD-02.1, F-WYD-02.2, F-WYD-02.3, F-WYD-02.4, F-WYD-02.5, F-WYD-02.6, F-WYD-02.7, F-WYD-02.8, F-WYD-02.9, F-WYD-02.10, F-WYD-02.11, F-WYD-03.1, F-WYD-03.2, F-WYD-03.3, F-WYD-03.4, F-WYD-04.1, F-WYD-04.2, F-WYD-05.3, F-WYD-05.7, F-WYD-05.8, F-WYD-05.10, F-WYD-05.11, F-WYD-05.12, F-WYD-05.13, F-WYD-05.14, F-WYD-05.15, F-WYD-06.1, F-WYD-06.2, F-WYD-06.3, F-WYD-07.1, F-WYD-07.2, F-WYD-07.3, F-WYD-08.1, F-WYD-08.2, F-WYD-08.3, F-WYD-09.1, F-WYD-09.2, F-WYD-09.3, F-WYD-09.4, F-WYD-09.5, F-WYD-09.6, F-WYD-09.7, F-WYD-09.8, F-WYD-09.9, F-WYD-09.10, F-WYD-10.1, F-WYD-10.2, F-WYD-10.3, F-WYD-10.4, F-WYD-11.1, F-WYD-11.2, F-WYD-12.1, F-WYD-12.2, F-WYD-12.3, F-WYD-13.1, F-WYD-14.1, F-WYD-14.2, F-WYD-14.3, F-WYD-14.4, F-WYD-15.1, F-WYD-15.2, F-WYD-15.3, F-WYD-15.4, F-WYD-15.5, F-WYD-15.6, F-WYD-15.7
- **DOS** (20): F-DOS-01.1, F-DOS-01.2, F-DOS-01.3, F-DOS-01.4, F-DOS-01.5, F-DOS-01.6, F-DOS-02.1, F-DOS-02.2, F-DOS-02.3, F-DOS-03.1, F-DOS-03.2, F-DOS-03.3, F-DOS-03.4, F-DOS-04.1, F-DOS-04.2, F-DOS-04.3, F-DOS-05.1, F-DOS-05.2, F-DOS-06.1, F-DOS-06.2
- **REJ** (100): F-REJ-01.1, F-REJ-01.2, F-REJ-01.3, F-REJ-01.4, F-REJ-01.6, F-REJ-01.7, F-REJ-01.8, F-REJ-01.9, F-REJ-01.10, F-REJ-01.11, F-REJ-01.12, F-REJ-02.1, F-REJ-02.2, F-REJ-02.3, F-REJ-02.4, F-REJ-02.5, F-REJ-02.6, F-REJ-02.7, F-REJ-02.8, F-REJ-02.9, F-REJ-02.10, F-REJ-02.11, F-REJ-02.12, F-REJ-03.1, F-REJ-03.2, F-REJ-04.1, F-REJ-04.2, F-REJ-04.3, F-REJ-04.4, F-REJ-05.1, F-REJ-05.2, F-REJ-05.3, F-REJ-05.4, F-REJ-05.6, F-REJ-06.1, F-REJ-06.2, F-REJ-06.3, F-REJ-06.4, F-REJ-06.5, F-REJ-06.6, F-REJ-06.7, F-REJ-06.8, F-REJ-07.2, F-REJ-07.3, F-REJ-07.4, F-REJ-07.5, F-REJ-07.6, F-REJ-07.7, F-REJ-07.8, F-REJ-07.9, F-REJ-08.1, F-REJ-08.2, F-REJ-08.3, F-REJ-08.4, F-REJ-08.5, F-REJ-08.6, F-REJ-08.7, F-REJ-08.8, F-REJ-09.1, F-REJ-09.2, F-REJ-09.3, F-REJ-10.1, F-REJ-10.2, F-REJ-10.3, F-REJ-10.4, F-REJ-10.5, F-REJ-11.1, F-REJ-11.2, F-REJ-11.3, F-REJ-11.4, F-REJ-12.1, F-REJ-12.2, F-REJ-12.3, F-REJ-12.4, F-REJ-12.5, F-REJ-13.1, F-REJ-13.2, F-REJ-13.3, F-REJ-13.4, F-REJ-13.5, F-REJ-13.6, F-REJ-13.7, F-REJ-13.8, F-REJ-14.1, F-REJ-14.2, F-REJ-14.3, F-REJ-14.4, F-REJ-16.1, F-REJ-16.2, F-REJ-16.3, F-REJ-17.1, F-REJ-17.4, F-REJ-18.1, F-REJ-18.2, F-REJ-20.1, F-REJ-20.2, F-REJ-20.3, F-REJ-20.4, F-REJ-20.5, F-REJ-20.6
- **PLT** (16): F-PLT-01.1, F-PLT-01.2, F-PLT-01.3, F-PLT-01.4, F-PLT-01.5, F-PLT-01.6, F-PLT-02.1, F-PLT-02.2, F-PLT-03.1, F-PLT-04.1, F-PLT-04.2, F-PLT-04.3, F-PLT-04.4, F-PLT-04.5, F-PLT-05.1, F-PLT-05.2
- **ABS** (57): F-ABS-01.1, F-ABS-01.2, F-ABS-01.3, F-ABS-01.4, F-ABS-02.1, F-ABS-02.2, F-ABS-02.3, F-ABS-02.4, F-ABS-02.5, F-ABS-02.6, F-ABS-02.7, F-ABS-02.8, F-ABS-03.1, F-ABS-03.2, F-ABS-03.3, F-ABS-03.4, F-ABS-04.1, F-ABS-04.2, F-ABS-04.3, F-ABS-04.4, F-ABS-05.1, F-ABS-05.2, F-ABS-05.3, F-ABS-05.4, F-ABS-05.5, F-ABS-05.6, F-ABS-05.7, F-ABS-06.1, F-ABS-06.2, F-ABS-06.3, F-ABS-06.4, F-ABS-06.5, F-ABS-06.6, F-ABS-07.1, F-ABS-07.2, F-ABS-07.3, F-ABS-07.4, F-ABS-07.5, F-ABS-08.1, F-ABS-08.2, F-ABS-08.3, F-ABS-08.4, F-ABS-08.5, F-ABS-08.6, F-ABS-08.7, F-ABS-08.8, F-ABS-08.9, F-ABS-08.10, F-ABS-09.1, F-ABS-09.2, F-ABS-09.3, F-ABS-09.4, F-ABS-09.5, F-ABS-10.1, F-ABS-10.2, F-ABS-10.3, F-ABS-11
- **REF** (25): F-REF-01.1, F-REF-01.2, F-REF-01.3, F-REF-01.4, F-REF-01.5, F-REF-01.6, F-REF-01.7, F-REF-01.8, F-REF-01.9, F-REF-02.1, F-REF-02.2, F-REF-02.3, F-REF-02.4, F-REF-02.5, F-REF-02.6, F-REF-02.7, F-REF-02.8, F-REF-03.1, F-REF-03.2, F-REF-03.3, F-REF-04.1, F-REF-04.2, F-REF-05.1, F-REF-05.2, F-REF-05.3
- **PAP** (27): F-PAP-01.1, F-PAP-01.2, F-PAP-01.3, F-PAP-01.4, F-PAP-01.5, F-PAP-01.6, F-PAP-01.7, F-PAP-01.8, F-PAP-01.9, F-PAP-01.10, F-PAP-01.11, F-PAP-01.12, F-PAP-01.13, F-PAP-01.14, F-PAP-01.15, F-PAP-01.16, F-PAP-02.1, F-PAP-02.2, F-PAP-02.3, F-PAP-02.4, F-PAP-02.5, F-PAP-02.6, F-PAP-02.7, F-PAP-02.8, F-PAP-02.9, F-PAP-02.10, F-PAP-02.11
- **EDI** (27): F-EDI-01.1, F-EDI-01.2, F-EDI-01.3, F-EDI-01.4, F-EDI-01.5, F-EDI-01.6, F-EDI-01.7, F-EDI-01.8, F-EDI-01.9, F-EDI-01.10, F-EDI-01.11, F-EDI-01.12, F-EDI-01.13, F-EDI-01.14, F-EDI-01.15, F-EDI-01.16, F-EDI-01.17, F-EDI-01.18, F-EDI-01.19, F-EDI-01.20, F-EDI-01.21, F-EDI-01.22, F-EDI-01.23, F-EDI-02.1, F-EDI-02.2, F-EDI-02.3, F-EDI-02.4
- **PRG** (25): F-PRG-01.1, F-PRG-01.2, F-PRG-01.3, F-PRG-01.4, F-PRG-01.5, F-PRG-01.6, F-PRG-02.1, F-PRG-03.1, F-PRG-03.2, F-PRG-03.3, F-PRG-04.1, F-PRG-04.2, F-PRG-04.3, F-PRG-04.4, F-PRG-05.1, F-PRG-05.2, F-PRG-05.3, F-PRG-05.4, F-PRG-05.5, F-PRG-06.1, F-PRG-06.2, F-PRG-06.3, F-PRG-06.4, F-PRG-07.1, F-PRG-07.2
- **MAT** (26): F-MAT-01.1, F-MAT-01.2, F-MAT-01.3, F-MAT-01.4, F-MAT-01.5, F-MAT-01.6, F-MAT-01.7, F-MAT-01.8, F-MAT-01.9, F-MAT-01.10, F-MAT-01.11, F-MAT-01.12, F-MAT-01.13, F-MAT-02.1, F-MAT-02.2, F-MAT-02.3, F-MAT-02.4, F-MAT-02.5, F-MAT-02.6, F-MAT-02.7, F-MAT-03.1, F-MAT-03.2, F-MAT-03.3, F-MAT-04.1, F-MAT-04.2, F-MAT-04.3
- **ANK** (14): F-ANK-01.1, F-ANK-01.2, F-ANK-01.3, F-ANK-01.4, F-ANK-01.5, F-ANK-01.6, F-ANK-01.7, F-ANK-01.8, F-ANK-01.9, F-ANK-01.10, F-ANK-01.11, F-ANK-01.12, F-ANK-01.13, F-ANK-01.14
- **WYG** (13): F-WYG-01.1, F-WYG-01.2, F-WYG-01.3, F-WYG-01.4, F-WYG-01.5, F-WYG-01.6, F-WYG-02.1, F-WYG-02.2, F-WYG-02.3, F-WYG-02.4, F-WYG-03.1, F-WYG-04.1, F-WYG-04.2
- **KOM** (24): F-KOM-01.1, F-KOM-01.2, F-KOM-01.3, F-KOM-01.4, F-KOM-01.5, F-KOM-02.1, F-KOM-02.2, F-KOM-02.3, F-KOM-02.4, F-KOM-03.1, F-KOM-03.2, F-KOM-03.3, F-KOM-03.4, F-KOM-03.5, F-KOM-03.6, F-KOM-03.7, F-KOM-03.8, F-KOM-04.1, F-KOM-04.2, F-KOM-04.3, F-KOM-04.4, F-KOM-04.5, F-KOM-05.1, F-KOM-05.3
- **DOK** (20): F-DOK-01.1, F-DOK-01.2, F-DOK-01.3, F-DOK-01.4, F-DOK-01.5, F-DOK-01.6, F-DOK-01.7, F-DOK-01.8, F-DOK-01.9, F-DOK-01.10, F-DOK-01.11, F-DOK-02.1, F-DOK-02.2, F-DOK-02.3, F-DOK-02.4, F-DOK-02.5, F-DOK-02.6, F-DOK-02.7, F-DOK-02.8, F-DOK-03.1
- **SAL** (50): F-SAL-01.1, F-SAL-01.2, F-SAL-01.3, F-SAL-01.4, F-SAL-01.5, F-SAL-01.6, F-SAL-02.1, F-SAL-02.2, F-SAL-02.3, F-SAL-02.4, F-SAL-02.5, F-SAL-02.6, F-SAL-02.7, F-SAL-02.8, F-SAL-02.9, F-SAL-02.10, F-SAL-02.11, F-SAL-03.1, F-SAL-03.2, F-SAL-03.3, F-SAL-03.4, F-SAL-03.5, F-SAL-03.6, F-SAL-04.1, F-SAL-04.2, F-SAL-04.3, F-SAL-04.4, F-SAL-05.1, F-SAL-05.2, F-SAL-05.3, F-SAL-05.4, F-SAL-05.5, F-SAL-06.1, F-SAL-06.2, F-SAL-06.3, F-SAL-06.4, F-SAL-07.1, F-SAL-07.2, F-SAL-07.3, F-SAL-07.4, F-SAL-07.5, F-SAL-07.6, F-SAL-07.7, F-SAL-08.1, F-SAL-08.2, F-SAL-08.3, F-SAL-08.4, F-SAL-08.5, F-SAL-08.6, F-SAL-08.7
- **WID** (14): F-WID-01.1, F-WID-01.2, F-WID-01.3, F-WID-01.4, F-WID-01.5, F-WID-01.6, F-WID-01.7, F-WID-01.8, F-WID-01.9, F-WID-01.10, F-WID-01.11, F-WID-02.1, F-WID-02.2, F-WID-02.3
- **UZY** (32): F-UZY-01.3, F-UZY-01.4, F-UZY-01.5, F-UZY-01.7, F-UZY-01.8, F-UZY-01.9, F-UZY-02.1, F-UZY-02.2, F-UZY-02.3, F-UZY-02.4, F-UZY-02.5, F-UZY-02.6, F-UZY-02.7, F-UZY-02.8, F-UZY-02.9, F-UZY-03.1, F-UZY-03.2, F-UZY-03.3, F-UZY-03.4, F-UZY-04.1, F-UZY-04.2, F-UZY-05.1, F-UZY-05.2, F-UZY-05.3, F-UZY-05.4, F-UZY-06.1, F-UZY-06.2, F-UZY-07.1, F-UZY-07.2, F-UZY-07.4, F-UZY-07.5, F-UZY-07.6
- **UWT** (20): F-UWT-01.3, F-UWT-01.4, F-UWT-01.5, F-UWT-02.1, F-UWT-02.2, F-UWT-02.3, F-UWT-02.4, F-UWT-02.5, F-UWT-02.6, F-UWT-02.7, F-UWT-03.1, F-UWT-03.2, F-UWT-04.1, F-UWT-04.2, F-UWT-04.3, F-UWT-04.4, F-UWT-04.5, F-UWT-04.6, F-UWT-04.7, F-UWT-04.8
- **WYS** (6): F-WYS-01.1, F-WYS-01.2, F-WYS-01.3, F-WYS-01.4, F-WYS-02.1, F-WYS-02.2
- **API** (16): F-API-01.1, F-API-01.2, F-API-01.3, F-API-01.4, F-API-01.5, F-API-01.6, F-API-01.7, F-API-01.8, F-API-01.9, F-API-02.1, F-API-02.2, F-API-02.3, F-API-03.1, F-API-03.2, F-API-04.1, F-API-04.2
- **ADM** (41): F-ADM-01.1, F-ADM-01.2, F-ADM-01.3, F-ADM-01.4, F-ADM-01.5, F-ADM-01.6, F-ADM-01.7, F-ADM-01.8, F-ADM-01.9, F-ADM-01.10, F-ADM-01.11, F-ADM-01.12, F-ADM-02.1, F-ADM-02.2, F-ADM-02.3, F-ADM-02.4, F-ADM-03.1, F-ADM-03.2, F-ADM-03.3, F-ADM-03.4, F-ADM-03.5, F-ADM-04.3, F-ADM-04.4, F-ADM-04.5, F-ADM-05.1, F-ADM-05.2, F-ADM-06.1, F-ADM-06.2, F-ADM-06.3, F-ADM-06.4, F-ADM-06.5, F-ADM-06.6, F-ADM-07.1, F-ADM-07.2, F-ADM-07.4, F-ADM-07.5, F-ADM-07.6, F-ADM-08.1, F-ADM-09.1, F-ADM-09.2, F-ADM-09.3
- **PLG** (42): F-PLG-01.1, F-PLG-02.1, F-PLG-03.1, F-PLG-03.2, F-PLG-04.1, F-PLG-04.2, F-PLG-04.3, F-PLG-04.4, F-PLG-04.5, F-PLG-04.6, F-PLG-04.7, F-PLG-04.8, F-PLG-04.9, F-PLG-04.10, F-PLG-04.11, F-PLG-04.12, F-PLG-04.13, F-PLG-04.14, F-PLG-04.15, F-PLG-04.16, F-PLG-05.1, F-PLG-05.2, F-PLG-05.3, F-PLG-05.4, F-PLG-05.5, F-PLG-05.6, F-PLG-05.7, F-PLG-06.1, F-PLG-06.2, F-PLG-06.3, F-PLG-06.4, F-PLG-06.5, F-PLG-06.6, F-PLG-06.7, F-PLG-06.8, F-PLG-06.9, F-PLG-06.10, F-PLG-07.1, F-PLG-07.2, F-PLG-07.3, F-PLG-08.1, F-PLG-08.2
- **I18** (8): F-I18-01.2, F-I18-01.3, F-I18-01.5, F-I18-02.1, F-I18-03.1, F-I18-03.2, F-I18-03.3, F-I18-04.1
- **OPS** (13): F-OPS-01.2, F-OPS-01.3, F-OPS-02.1, F-OPS-03.1, F-OPS-04.1, F-OPS-04.2, F-OPS-04.3, F-OPS-04.4, F-OPS-05.1, F-OPS-06.1, F-OPS-06.2, F-OPS-06.3, F-OPS-06.4
- **MIG** (2): F-MIG-01.1, F-MIG-01.2

### Wiersze wyłączone i do decyzji

| Wiersz | Status | Powód |
|---|---|---|
| F-ADM-01.13 Ustawienia deweloperskie Indico | wylaczona | F1 (c): Tryb debugowania, dziennik zapytań SQL i profilowanie żądań służą wyłącznie deweloperom Indico. |
| F-ADM-06.7 Narzędzia deweloperskie i tłumaczeniowe projektu Indico | wylaczona | F1 (c): Serwer deweloperski oraz obsługa tłumaczeń w projekcie Indico (ekstrakcja, push i pull do serwisu tłumaczeń) to narzędzia wyłącznie dla deweloperów Indico. |
| F-ADM-06.8 Polecenia naprawcze dla historycznych wersji Indico | wylaczona | F1 (a): Reset stanu migracji po aktualizacji z Indico 1.9.x i naprawa list dostępu po błędzie sprzed 2.2.3 dotyczą wyłącznie historycznych wersji Indico. |
| F-ADM-10 Rejestracja instancji we wspólnocie Indico | wylaczona | F1 (b): Telemetria cephalopod (rejestr instancji wspólnoty Indico i jego punkt informacji o systemie) to infrastruktura wspólnoty i CERN-u. Odrębna od F-ADM-05, które pobiera komunikaty bez wysyłania danych instancji. |
| F-MIG-02 Jednorazowa pełna migracja archiwum Indico | do-decyzji | pytanie O2 (pełna migracja archiwum) |

## G. Mapa przewag

Ta sama zasada co w F: bez testu e2e żadna pozycja nie jest „spełniona”.

| Pozycja | Status | Dowód |
|---|---|---|
| P1 Uczestnik na telefonie | częściowo | Interfejs projektowany mobile-first (Tailwind, `apps/web/src/routes/*`); ścieżki lista → szczegóły → zapis → rezygnacja istnieją (`routes/index.tsx`, `routes/events/$eventId.tsx`). Brak testów e2e przy 360 px |
| P2 Zapis bez tarcia | częściowo | Zapis jednym przyciskiem dla zalogowanego, dane z konta (`registerForEventServer`, `apps/web/src/components/event-details/event-summary.tsx`). Brak własnych pytań organizatora, więc warunek „bez pytań” jest jedynym przypadkiem. Brak testu e2e |
| P3 Limit, lista rezerwowa, rezygnacja | częściowo | Limit z niezmiennikiem pod współbieżnością (`CHECK`, `packages/db/test/concurrency.test.ts`), rezygnacja jednym działaniem (`unregisterFromEventServer`). **Brak listy rezerwowej i awansu** (brak stanu rejestracji, sekcja C) |
| P4 Publikacja w dwie minuty | częściowo | Tworzenie wydarzenia w panelu (`createAdminEventServer`). Brak minimalnego zestawu pól, roli organizatora i duplikowania (`grep -rn "duplicate\|clone" apps/admin/src packages/api/src/admin` → pusto) |
| P5 Jeden kalendarz kampusu | częściowo | Publiczna lista z wyszukiwaniem i filtrami miejsca, wydziału i typu (`packages/api/src/events/schemas.ts`). Brak widoku kalendarza, ICS, Open Graph i schema.org (`grep -rn "og:\|schema.org\|ld+json" apps/web/src` → pusto) |
| P6 Dostępność i dwa języki | częściowo | Interfejs pl/en (Paraglide), `aria-live` na licznikach. Teksty poza tłumaczeniami (D2), brak testu axe, deklaracji dostępności i przeglądu ręcznego |
| P7 RODO w projekcie | brak | Brak klauzuli przy zapisie, retencji, eksportu i usunięcia konta (`apps/web/src/routes/account.tsx` nie ma tych funkcji) |
| P8 Logowanie uczelniane | brak | Brak interfejsu tożsamości i adaptera uczelni; jest hasło, magic link i opcjonalni dostawcy społecznościowi (`packages/api/src/auth/social-providers.ts`) |
| P9 Check-in w tej samej aplikacji | brak | Brak biletów i odhaczania obecności |
| P10 Przypomnienia i zmiany | brak | Brak powiadomień o zmianie terminu, miejsca i odwołaniu (brak statusu wydarzenia, sekcja C) |
| P11 Integracja z USOS | brak | Zależy od O1; brak kodu |
| P12 Współistnienie z Indico | brak | Brak importu z Indico |
| P13 Statystyki | częściowo | Organizator (admin) widzi zapisanych i liczniki miejsc (`registrants-list.tsx`, `event-summary-card.tsx`). Brak listy rezerwowej, obecności, odsetka nieobecnych i statystyk administratora w czasie |
| P14 Treść w dwóch językach | brak | `events` ma jedną kolumnę `title` i `description` (`packages/db/src/schema/events.ts`) |
| P15 API i osadzanie | brak | Brak publicznego REST API, OpenAPI i widżetu (sekcja C, „API”) |
| P16 Goście bez konta | brak | Zapis wymaga konta. Magic link i zaproszenie grupowe zakładają konto niejawnie (`auth/group-invitation-plugin.ts`) |

## H. Infrastruktura testowa

| Pozycja | Stan | Dowód |
|---|---|---|
| Framework | Vitest `^5.1.1` w `@repo/db`, `@repo/api`, `@repo/ui`, `@repo/collections`, `apps/worker` | `package.json` każdego pakietu |
| Testy e2e | **brak w repozytorium**. Skrypty CDP (`flow.mjs`, `group-flow.mjs`, `admin-flow.mjs`) istnieją tylko w katalogu tymczasowym sesji, poza repozytorium, i nie są częścią zestawu | `grep -rl "playwright\|cypress\|puppeteer" package.json apps/*/package.json packages/*/package.json` → pusto |
| CI | **brak** | `ls .github` → brak katalogu |
| Uruchamianie | `pnpm test` przez `turbo test --concurrency=1`, `cache: false` | `turbo.json:34-36` |
| Izolacja bazy | baza `harmonogram_us_test` tworzona i migrowana w `globalSetup`; `resetDb()` wykonuje TRUNCATE tabel; `fileParallelism: false` w db, api i worker | `packages/db/test/global-setup.ts`, `test/helpers.ts:22-28`, `packages/*/vitest.config.ts` |
| Dane testowe | fabryki `createEvent`, `createItem`, `createUser`, `createGroupRow`, `addMemberRow`, `invitationToken` | `packages/db/test/helpers.ts` |
| Zegar | niekontrolowany; testy terminów używają `hoursFromNow()` i zmieniają `group_deadline_hours` | `packages/db/test/groups.test.ts:175-184` |
| Pominięte i niestabilne | 0 pominiętych (grep wyżej), brak `retry` w konfiguracji; w przebiegu bazowym brak niestabilnych | `grep -rn retry packages/*/vitest.config.*` → pusto |
| Czas przebiegu | 42 s (cały `pnpm test`) | przebieg bazowy, Krok 1 |

Podział testów (przebieg bazowy z 19 listopada, `d9e28b4`):

| Pakiet | Pliki | Testy | Rodzaj |
|---|---|---|---|
| `@repo/db` | 9 | 84 | integracyjne, prawdziwy Postgres; w tym współbieżność (`concurrency.test.ts`) |
| `@repo/api` | 6 | 19 | 2 pliki integracyjne (`transactional-enqueue`, `group-invitation-plugin`, prawdziwy Postgres), 4 jednostkowe |
| `apps/worker` | 1 | 4 | integracyjne (baza testowa) |
| `@repo/collections` | 3 | 7 | jednostkowe |
| `@repo/ui` | 2 | 7 | jednostkowe |
| **Razem** | 21 | **121** | ok. 18 jednostkowych, ok. 103 integracyjne, **0 e2e** |

Podział api na jednostkowe i integracyjne liczony po plikach: testy w 2 plikach integracyjnych mają łącznie około 6 przypadków. Dokładny podział sprawdzi narzędzie z Etapu 0.

## Kolizje z nowym kierunkiem (do Kroku 4)

1. **Rejestracja bez stanów.** Zapis to istnienie wiersza, a rezygnacja to DELETE (`queries/event-registrations.ts:212`). Brak listy rezerwowej (P3), moderacji, oczekiwania na płatność i wycofania z historią (F-REJ-05, G4). UNIQUE (`event_id`,`user_id`) (`migrations/0001:63`) wyklucza wiele formularzy na wydarzenie (F-REJ-01).
2. **Brak kategorii, statusu, ochrony i typów wydarzeń w rozumieniu Indico.** `events` ma tylko płaskie słowniki (`schema/events.ts`), co dotyczy F-WYD-01..04, F-DOS-01 i #16 (odwołanie).
3. **Role.** Jest tylko `user.role` user/admin, a panel administracyjny jest dostępny wyłącznie dla adminów (`admin-middleware.ts`). Indico pozwala organizatorom zarządzać własnymi wydarzeniami z granularnymi uprawnieniami (F-DOS-03). Obecny podział „aplikacja admin = tylko admin” trzeba przemyśleć.
4. **Brak systemu wtyczek (B2).** Turnstile, SMTP, Redis i dostawcy społecznościowi są zaszyci w rdzeniu (`packages/api/src/security/*`, `auth/better-auth.ts`). Captcha ma u Indico postać wtyczki (`cloud_captchas`).
5. **Logowanie.** Działają magic link, hasło i dostawcy społecznościowi; nie ma adaptera uczelnianego (P8). Konto zakłada się niejawnie przez magic link. Należy to zestawić z anty-celem „osobne konto” i z P16 (goście bez konta).
6. **Strefa czasowa Europe/Warsaw na sztywno** (D1). Przeczy F-I18-02 i T6.
7. **Rejestracja grupowa i miejsca trzymane przez grupy.** To wymaganie interesariusza spoza katalogu Indico. Trzeba ją dopisać do katalogu jako funkcję ponad parytet i włączyć w macierz stanów (G4), żeby nie była „funkcją bez wiersza”.
8. **Brak e2e i CI** (H). Kryteria P1, P6, G2, G3 i E7–E9 wymagają ich od zera; obecne dowody UI to wyłącznie ręczne skrypty spoza repozytorium.
9. **Teksty spoza tłumaczeń** (D2) i brak testu dostępności przeczą P6.
10. **CLAUDE.md jest nieaktualny.** Twierdzi, że nie ma sprawdzenia roli ADMIN (#12) i że `event_registrations` nie ma grup ani sesji. Kod pokazuje coś innego (`86ddf78`, `schema/event-registrations.ts`, `schema/agenda.ts`).
11. **Brak licencji** (E). Licencję trzeba wybrać przed pierwszym zewnętrznym wdrożeniem (O3).
12. **„Projekt 3” (Docker)** i motyw wizualny były zaplanowane jako następne, ale nie mają speców. Pierwszy jest objęty F-OPS-01, a drugi nie ma wiersza i powinien trafić do Etapu 1 (P1/P6) albo do „później”.
