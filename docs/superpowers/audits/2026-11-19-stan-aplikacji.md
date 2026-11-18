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

Pozostałe rodzaje pozycji: 56 poleceń CLI, 20 zadań Celery (w tym cykliczne), 20 eksporterów HTTP API (hooki i formaty), 32 rozdziały referencji API, 7 funkcji wydarzenia, 30 uprawnień zarządzania. Razem 1802 pozycje. Dwa kolejne przebiegi skryptu dają bajtowo identyczny plik (`cmp` → brak różnic).

## F. Mapa parytetu

Uzupełniana po Kroku 3 (inwentarz Indico i `docs/superpowers/parity/katalog-funkcji.yaml`).

## G. Mapa przewag

Uzupełniana po Kroku 3 razem z F.

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
