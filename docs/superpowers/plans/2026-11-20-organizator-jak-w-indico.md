# Organizator na poziomie Indico: plan implementacji

> **Dla wykonawcy:** wymagany skill `superpowers:executing-plans` (wykonanie inline) albo `superpowers:subagent-driven-development`. Kroki mają składnię checkboxów (`- [ ]`).

**Cel:** organizator (nie tylko administrator) tworzy, publikuje, odwołuje i duplikuje swoje wydarzenia, dzieli je ze współorganizatorami, zarządza listą zapisanych (dodanie, usunięcie, CSV, wiadomość) i odhacza obecność skanerem kodów QR. To zakres zarządzania wydarzeniem, jaki daje Indico, ale prościej i na telefonie.

**Architektura:**
- *Role:* `user.role` przyjmuje `user | organizer | admin`. Nowa tabela `event_organizers (event_id, user_id)` mówi, kto zarządza wydarzeniem. Rola `organizer` pozwala **tworzyć** wydarzenia, a wiersz w `event_organizers` pozwala **zarządzać** jednym wydarzeniem (jak „event creator” i „manager” w Indico). Administrator zarządza wszystkim.
- *Gdzie:* organizator pracuje w `apps/admin` (decyzja użytkownika z 20.11, zmienia K4 w specu). Panel pokazuje mu tylko jego wydarzenia, a słowniki i role tylko administratorowi. Każda server function wydarzenia sprawdza `assertCanManageEvent` po stronie serwera.
- *Cykl życia:* `events.status` to `draft | published | cancelled`. Nowe wydarzenie jest szkicem. Publikacja sprawdza, że jest miejsce albo link online. Odwołanie jest nieodwracalne, zostawia zapisy jako historię, zamyka zapisy i wysyła e-maile. Stan „odwołane” trafia na stronę publiczną na żywo przez nowy kształt Electric.
- *Obecność:* `event_registrations.checked_in_at`. Skaner w panelu czyta kamerę telefonu (`getUserMedia` + `jsqr`) i wywołuje `checkInByTicketCode`.

**Stos:** TanStack Start/Router/Query/Form, Drizzle + Postgres, ElectricSQL + TanStack DB, pg-boss, react-email, Paraglide, shadcn, `jsqr` (nowa zależność `apps/admin`), Playwright, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-19-produkt-design.md`: F2, F3, F6 (odwołanie), F7, F11 (skaner i obecność). Plan 2 z sekcji „Roadmap” w `CLAUDE.md`.

## Decyzje użytkownika (20.11)

- Organizator zarządza w `apps/admin` ograniczonym do swoich wydarzeń, a nie pod `/manage` w `apps/web`. Task 11 poprawia K4 w specu i `CLAUDE.md`.
- Ten plan obejmuje istniejące, częściowe funkcje organizatora: F2, F3, F6, F7, F11. Reszta (uczestnik, brakujące funkcje) jest na liście „Następne” na końcu.

## Ograniczenia globalne

- Funkcja jest gotowa, gdy przechodzi jej test e2e. Nazwa testu zaczyna się od numeru funkcji (`[F2]`, `[F3]`, `[F6]`, `[F7]`, `[F11]`). Test piszemy najpierw i patrzymy, jak pada.
- Bez rozwiązań tymczasowych, bez TODO, bez kodu „na przyszłość”. Zmiany bazy tylko migracjami (`pnpm db:generate`, potem ręczne dopiski SQL).
- Kolejność blokad: `events` → `agenda_items` → `registration_groups` → `registration_group_members` → wiersze liczników. Nigdy nie piszemy do `event_seat_counts` ani `agenda_item_seat_counts`.
- Każda zmiana zwalniająca miejsca woła `promoteAndNotify` w tej samej transakcji, z zablokowanym wierszem wydarzenia. E-maile kolejkujemy w tej samej transakcji (`enqueueEmails(jobs, { tx })`), nigdy po commicie.
- Każdy nowy kod błędu trafia do `DOMAIN_ERROR_CODES` w `@repo/db/queries/domain-errors`, a jego komunikat do `@repo/ui/app-errors` (pl i en).
- Teksty UI tylko w `packages/i18n/messages/{pl,en}.json`, potem `pnpm messages:compile`.
- Ekrany panelu najpierw na telefon (360 px). Testy e2e organizatora działają w obu projektach Playwright (`komputer`, `telefon`), więc nie mają tagu `@uczestnik`, tylko `@organizator`. `playwright.config.ts`: projekt `telefon` łapie `@uczestnik|@organizator`.
- Konwencje z `CLAUDE.md`: bez barrel files, `env` z `@repo/env`, `z.email()`, Biome, `handle*`, Conventional Commits. Commity lokalnie na `next`, bez pushowania.

## Na co uważać przy przeglądzie

1. Obcy organizator wywołujący server function cudzego wydarzenia bezpośrednio (nie przez UI) dostaje `FORBIDDEN`, także dla punktów programu, grup, zapisanych, CSV, wiadomości i skanera. Vitest w Task 2 sprawdza `assertCanManageEvent` dla każdej server function z listy.
2. Szkic nie wycieka publicznie: `/pl/events/<id szkicu>` daje 404, szkic nie jest na liście, a `registerForEvent`, zapis na punkt i utworzenie grupy na szkicu dają `EVENT_NOT_FOUND`. Testy w Task 4.
3. Odwołanie w trakcie zapisu: równoległe `registerForEvent` i `cancelEvent` dają albo zapis z e-mailem o odwołaniu, albo `EVENT_CANCELLED`, nigdy zapis bez e-maila. Vitest w Task 5 (blokada wydarzenia w obu ścieżkach).
4. CSV z polskimi znakami i złośliwym imieniem: plik zaczyna się od BOM UTF-8, `Zażółć` otwiera się poprawnie, a wartość `=HYPERLINK(...)` dostaje prefiks `'`, żeby arkusz nie wykonał formuły. Unit test w Task 8.
5. Drugi skan tego samego biletu i bilet z innego wydarzenia: drugi skan pokazuje „Już odhaczono o 10:02”, a nie błąd. Bilet z innego wydarzenia albo osoby z listy rezerwowej pokazuje czytelny komunikat i nikogo nie odhacza. Testy w Task 10.

---

### Task 1: Rola organizatora i współorganizatorzy w bazie

**Pliki:**
- Modyfikuj: `packages/db/src/schema/better-auth.ts` (komentarz roli), `packages/db/src/queries/roles.ts`, `packages/db/src/seed/accounts.ts` (`AccountRole`), `packages/db/src/seed/create-account.ts` (`--role user|organizer|admin`), `packages/db/src/queries/events.ts` (`createEvent`), `packages/db/src/queries/domain-errors.ts`
- Utwórz: `packages/db/src/schema/event-organizers.ts`, `packages/db/src/queries/event-organizers.ts`, migrację `packages/db/src/migrations/0014_event_organizers.sql`
- Test: `packages/db/test/event-organizers.test.ts`

**Interfejsy:**
- `UserRole = "user" | "organizer" | "admin"`. Migracja dodaje `CHECK (role IN ('user','organizer','admin'))` na `"user".role`.
- Tabela `event_organizers`: `event_id text NOT NULL REFERENCES events ON DELETE CASCADE`, `user_id text NOT NULL REFERENCES "user" ON DELETE CASCADE`, `created_at timestamptz NOT NULL DEFAULT now()`, `PRIMARY KEY (event_id, user_id)`, indeks na `user_id`.
- `canCreateEvents(userId: string): Promise<boolean>`: rola `organizer` albo `admin`.
- `canManageEvent(userId: string, eventId: string): Promise<boolean>`: admin albo wiersz w `event_organizers`.
- `hasPanelAccess(userId: string): Promise<boolean>`: `canCreateEvents` albo co najmniej jeden wiersz w `event_organizers`.
- `listManagedEventIds(userId: string): Promise<string[] | "all">` (`"all"` dla admina).
- `EventOrganizer = { userId: string; email: string; name: string; addedAt: Date }`, a `listEventOrganizers(eventId: string): Promise<EventOrganizer[]>` sortuje po `addedAt`.
- `addEventOrganizer(eventId: string, email: string): Promise<EventOrganizer>`: e-mail bez względu na wielkość liter. Błędy `USER_NOT_FOUND` (brak konta) i `ALREADY_ORGANIZER` (unique).
- `removeEventOrganizer(eventId: string, userId: string): Promise<void>`: `LAST_ORGANIZER`, gdy zostałby zero organizatorów. Blokuje wiersz wydarzenia (`lockEvent`).
- `CreateEventInput` dostaje `organizerId: string | null`. `createEvent` w jednej transakcji wstawia wydarzenie i, gdy `organizerId` nie jest `null`, wiersz organizatora.
- Nowe kody: `USER_NOT_FOUND`, `ALREADY_ORGANIZER`, `LAST_ORGANIZER`.

- [ ] **Krok 1: testy Vitest:**
  - `createEvent({ ..., organizerId })` czyni twórcę organizatorem, a `canManageEvent(twórca, id)` to `true`;
  - obcy organizator: `canManageEvent` to `false`, a admin bez wiersza: `true`;
  - `addEventOrganizer(id, "  Kolega@E2E.test ")` dodaje istniejące konto `kolega@e2e.test`, drugi raz daje `ALREADY_ORGANIZER`, a nieznany e-mail `USER_NOT_FOUND`;
  - `hasPanelAccess` jest `true` dla zwykłego użytkownika dodanego jako współorganizator i `false` dla zwykłego użytkownika bez wydarzeń;
  - `removeEventOrganizer` ostatniej osoby daje `LAST_ORGANIZER`;
  - migracja odrzuca `role = 'superuser'`.
- [ ] **Krok 2:** `pnpm --filter @repo/db exec vitest run test/event-organizers.test.ts`. Oczekiwane: FAIL, brak modułu.
- [ ] **Krok 3:** schemat, `pnpm db:generate`, dopisanie `CHECK` do migracji, zapytania i poprawione wywołania `createEvent` (seed: `organizerId: null`, fikstura e2e `createTestEvent` przyjmuje opcjonalne `organizerId`).
- [ ] **Krok 4:** `pnpm --filter @repo/db test`. Oczekiwane: PASS.
- [ ] **Krok 5:** commit `feat(db): organizer role and event organizers`.

### Task 2: Panel ograniczony do wydarzeń organizatora i współorganizatorzy w UI

**Pliki:**
- Utwórz: `packages/api/src/auth/event-access.ts`, `apps/admin/src/components/admin-event-detail/organizers-card.tsx`
- Modyfikuj:
  - `packages/api/src/auth/user.ts`: `AuthenticatedUser` dostaje `role: UserRole` i `hasPanelAccess: boolean`; `isAdmin` zostaje;
  - `packages/api/src/admin/queries.ts` i `mutations.ts`: zapytania i mutacje wydarzeń, punktów programu, zapisanych i grup przechodzą z `adminMiddleware` na `panelMiddleware` plus `assertCanManageEvent`; słowniki zostają przy `adminMiddleware`;
  - `packages/ui/src/composed/admin/admin-layout.tsx`: pozycje słowników tylko dla `isAdmin`;
  - `apps/admin/src/routes/_authenticated.tsx`: `NoAccess`, gdy `!user.hasPanelAccess`;
  - `apps/admin/src/components/admin-events-page.tsx`: przycisk „Dodaj” tylko przy `canCreateEvents`;
  - `apps/admin/src/routes/_authenticated/events.$eventId.tsx`: karta „Organizatorzy”;
  - messages.
- Testy: `packages/api/test/event-access.test.ts`, `e2e/tests/f2-organizatorzy.spec.ts`; `e2e/fixtures/data.ts` `createTestUser(email, { role?: UserRole, password? })` zamiast `admin?: boolean` (popraw istniejące wywołania).

**Interfejsy:**
- `panelMiddleware`: `UNAUTHORIZED` bez sesji, `FORBIDDEN` bez `hasPanelAccess`; kontekst `{ user }`.
- `assertCanManageEvent(user: AuthenticatedUser, eventId: string): Promise<void>`: `FORBIDDEN`, gdy `!canManageEvent`. Dla mutacji punktu programu `eventId` pochodzi z wiersza punktu (`getAgendaItemEventId(itemId): Promise<string | null>` w `queries/agenda-items.ts`, `NOT_FOUND` przy `null`).
- `fetchAdminEventsServer` filtruje po `listManagedEventIds` (`EventFilters` dostaje `ids?: string[]`).
- `createAdminEventServer` wymaga `canCreateEvents` i przekazuje `organizerId: user.id`.
- Nowe server functions w `packages/api/src/admin/organizers.ts`: `fetchEventOrganizersServer({ eventId })`, `addEventOrganizerServer({ eventId, email })`, `removeEventOrganizerServer({ eventId, userId })` i `eventOrganizersQueryOptions(eventId)` z kluczem `["admin","event",eventId,"organizers"]`.

- [ ] **Krok 1: test e2e (najpierw)** `[F2] organizator tworzy wydarzenie, dodaje współorganizatora, obcy nie ma dostępu @organizator`:
  - organizator A (rola `organizer`, hasło) loguje się do panelu, widzi „Wydarzenia”, a nie widzi „Typy wydarzeń”;
  - tworzy wydarzenie i w karcie „Organizatorzy” dodaje e-mail zwykłego użytkownika B;
  - B loguje się do panelu, widzi tylko to wydarzenie, zmienia tytuł, a strona publiczna pokazuje nowy tytuł;
  - organizator C otwiera adres wydarzenia w panelu i widzi „Brak dostępu do tego wydarzenia”. Lista C nie zawiera wydarzenia;
  - zwykły użytkownik D bez wydarzeń widzi ekran `NoAccess`.
- [ ] **Krok 2:** `pnpm e2e:up && pnpm --filter e2e e2e -g "\[F2\] organizator tworzy"`. Oczekiwane: FAIL (A widzi `NoAccess`).
- [ ] **Krok 3: test Vitest** `event-access.test.ts`: dla każdej server function wydarzenia (lista eksportów z `admin/mutations.ts`, `admin/queries.ts` i `admin/organizers.ts`, poza słownikami) handler wywołany jako obcy organizator daje `FORBIDDEN`. Mockuje `getCurrentUser` tak jak w istniejących testach API. Patrz, jak pada.
- [ ] **Krok 4:** implementacja. Błąd `FORBIDDEN` na stronie wydarzenia renderuje `admin_error_forbidden` w treści strony, bez przekierowania.
- [ ] **Krok 5:** Vitest i e2e z kroku 2, potem `pnpm --filter e2e e2e -g "\[F3\]|\[F18\]"` (testy admina nadal przechodzą). Oczekiwane: PASS.
- [ ] **Krok 6:** commit `feat(admin): organizers manage their own events`.

### Task 3: Administrator nadaje role

**Pliki:**
- Utwórz: `apps/admin/src/routes/_authenticated/users.tsx`, `apps/admin/src/components/admin-users-page.tsx`, `packages/api/src/admin/users.ts`
- Modyfikuj: `packages/db/src/queries/roles.ts` (`searchUsers`, `setUserRole`), `admin-layout.tsx` (pozycja „Użytkownicy” tylko dla admina), messages
- Testy: `packages/db/test/roles.test.ts` (rozszerzenie), `e2e/tests/f2-organizatorzy.spec.ts`

**Interfejsy:**
- `UserListItem = { id: string; email: string; name: string; role: UserRole }`. `searchUsers(query: string, limit: number): Promise<UserListItem[]>` szuka po `email ILIKE` albo `name ILIKE`, sortuje po e-mailu. Pusty `query` daje pierwsze `limit`.
- `setUserRole(userId: string, role: UserRole): Promise<UserListItem | null>`.
- Server functions (`adminMiddleware`): `searchUsersServer({ query })` (limit 50), `setUserRoleServer({ userId, role })`. Admin nie może zmienić własnej roli: `FORBIDDEN`.

- [ ] **Krok 1: test e2e** `[F2] administrator nadaje rolę organizatora @organizator`: admin szuka użytkownika po e-mailu na stronie „Użytkownicy”, wybiera „Organizator” i widzi komunikat zapisu. Ta osoba loguje się do panelu i widzi przycisk „Dodaj” na liście wydarzeń.
- [ ] **Krok 2:** uruchom test. Oczekiwane: FAIL, brak strony.
- [ ] **Krok 3: Vitest:** `searchUsers` po fragmencie e-maila, `setUserRole`. Patrz, jak pada.
- [ ] **Krok 4:** implementacja. Na telefonie lista kart z `Select` roli, na komputerze tabela (`AdminEntityTable`). Wyszukiwanie z opóźnieniem 300 ms, zapamiętane w `?q=`.
- [ ] **Krok 5:** testy. Oczekiwane: PASS.
- [ ] **Krok 6:** commit `feat(admin): admins assign roles`.

### Task 4: Szkic i publikacja, link online i forma wydarzenia

**Pliki:**
- Modyfikuj: `packages/db/src/schema/events.ts`, `packages/db/src/queries/events.ts`, `packages/db/src/queries/event-registrations.ts` (`assertEventOpen`, którego używa też `createGroup`), `packages/api/src/events/schemas.ts`, `packages/api/src/events/queries.ts`, `packages/api/src/admin/mutations.ts`, `apps/admin/src/components/admin-events-page.tsx`, `event-summary-card.tsx`, `apps/web/src/components/event-details/event-summary.tsx`, `home-event-card.tsx`, messages
- Utwórz: migrację `0015_event_status.sql`
- Testy: `packages/db/test/event-status.test.ts`, `e2e/tests/f3-szkic-i-publikacja.spec.ts`; istniejący `f3-cykl-wydarzenia.spec.ts` dostaje krok „Opublikuj”

**Interfejsy:**
- Kolumny `events`:
  - `status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','cancelled'))`. Migracja ustawia `published` dla istniejących wierszy;
  - `published_at timestamptz` i `cancelled_at timestamptz`;
  - `online_url text` (`z.url()` z protokołem `https`, maks. 2000 znaków);
  - `attendance_mode text NOT NULL DEFAULT 'onsite' CHECK (attendance_mode IN ('onsite','online','hybrid'))`.
- `EventStatus = "draft" | "published" | "cancelled"`, `AttendanceMode = "onsite" | "online" | "hybrid"`. `EventWithRelations` dostaje `status`, `onlineUrl`, `attendanceMode`.
- `EventFilters` dostaje `audience: "public" | "manage"`. Dla `"public"` `queryEvents` pomija `draft`. `getEventById(id, audience)`, przy czym publiczne wywołania przekazują `"public"`.
- `publishEvent(eventId: string): Promise<EventWithRelations>`: blokuje wydarzenie. `EVENT_INCOMPLETE`, gdy brak `locationId` i `onlineUrl` (dla `online` wymagany `onlineUrl`, dla `onsite` `locationId`, dla `hybrid` oba). `EVENT_NOT_DRAFT`, gdy status nie jest `draft`.
- `assertEventOpen` rzuca `EVENT_NOT_FOUND` dla `draft` (przed sprawdzeniem końca).
- Link online widzą na stronie publicznej tylko osoby ze stanem `registered` (pole w `fetchEventDetailsServer` zerowane dla reszty).
- Server function `publishAdminEventServer({ id })` z `assertCanManageEvent`. Nowe kody: `EVENT_INCOMPLETE`, `EVENT_NOT_DRAFT`.

- [ ] **Krok 1: testy e2e:**
  - `[F3] szkic nie jest publiczny, publikacja go pokazuje @organizator`: organizator tworzy wydarzenie z tytułem, datą, typem i formą „Online” bez linku i widzi plakietkę „Szkic”. Uczestnik pod `/pl/events/<id>` dostaje 404, a lista go nie zawiera. „Opublikuj” pokazuje „Uzupełnij miejsce albo link online”. Po wpisaniu linku i „Opublikuj” plakietka znika, a uczestnik widzi wydarzenie na liście z oznaczeniem „Online”;
  - `[F3] link online widzą tylko zapisani @uczestnik`: niezapisany nie widzi linku, a po zapisie widzi link „Dołącz online”.
- [ ] **Krok 2:** uruchom testy. Oczekiwane: FAIL.
- [ ] **Krok 3: Vitest:** domyślny `draft`; publiczne `getEventPage` pomija szkic; `registerForEvent` na szkicu daje `EVENT_NOT_FOUND`; `publishEvent` bez miejsca i linku daje `EVENT_INCOMPLETE`; drugi `publishEvent` daje `EVENT_NOT_DRAFT`; migracja zostawia istniejące wydarzenia jako `published`. Patrz, jak pada.
- [ ] **Krok 4:** implementacja. Formularz: pole „Forma” (`Select`: Na miejscu, Online, Hybrydowo) i „Link online” widoczny dla `online` i `hybrid`. Typ wydarzenia i limit miejsc mają wartości domyślne (pierwszy typ, 50), więc wystarczy wpisać tytuł, datę i miejsce albo link. Fikstura `createTestEvent` tworzy wydarzenia jako `published` (opcja `status`).
- [ ] **Krok 5:** Vitest, e2e z kroku 1 i `pnpm e2e`. Oczekiwane: PASS.
- [ ] **Krok 6:** commit `feat: event drafts, publishing, online link`.

### Task 5: Odwołanie wydarzenia z e-mailem i stanem na żywo

**Pliki:**
- Modyfikuj: `packages/db/src/queries/events.ts` (`cancelEvent`), `event-registrations.ts` (`assertEventOpen`, `RegistrationChange.change` dostaje `"cancelled"`, `getRegistrationForEmail` bez filtra stanu), `packages/jobs/src/queues.ts` (`change` dostaje `cancelled`), `apps/worker/src/handlers/send-email.ts`, `packages/api/src/notifications/registration-email.tsx`, `packages/collections/src/shapes.ts` (`where?: string` w `ShapeDefinition`), `packages/collections/src/electric-proxy.ts` (przekazuje `where`), `packages/collections/package.json#exports`, `apps/web/src/components/event-details/*`, `home-event-card.tsx`, `apps/web/src/components/account/my-registrations.tsx`, panel (`event-summary-card.tsx`: przycisk „Odwołaj wydarzenie” z `AlertDialog`), messages
- Utwórz: `packages/collections/src/cancelled-events.ts`, `apps/web/src/routes/api/electric/cancelled-events.ts`, `apps/web/src/lib/events/use-event-cancelled.ts`
- Testy: `packages/db/test/event-cancel.test.ts`, `apps/worker/test/send-email.test.ts`, `packages/collections/test/electric-proxy.test.ts`, `e2e/tests/f3-odwolanie.spec.ts`

**Interfejsy:**
- `cancelEvent(eventId: string, hooks?: RegistrationHooks): Promise<{ txid: number }>`: blokuje wydarzenie, ustawia `status = 'cancelled'` i `cancelled_at = now()`. Woła `hooks.onChanged` ze zmianą `cancelled` dla każdego zapisu `registered` i `waitlisted`. Zamyka otwarte grupy wydarzenia jednym `UPDATE registration_groups SET status = 'closed' WHERE event_id = … AND status = 'open'` w tej samej transakcji, po blokadzie wydarzenia. `closeGroup` otwiera własną transakcję, więc się tu nie nadaje. Bez awansu z listy rezerwowej, bo wydarzenie jest odwołane. `EVENT_NOT_FOUND` dla szkicu (szkic się usuwa, a nie odwołuje), `EVENT_ALREADY_CANCELLED` drugi raz, `EVENT_ENDED` po końcu.
- `assertEventOpen` rzuca `EVENT_CANCELLED` dla `cancelled`, więc zapis, zapis na punkt, rezygnacja i grupa są zamknięte.
- E-mail `cancelled`: temat „Odwołano: <tytuł>” / „Cancelled: <title>”, data wydarzenia, link do strony wydarzenia, bez linku do biletu. Worker wysyła go niezależnie od stanu zapisu (`EXPECTED_STATE.cancelled = null`), ale tylko gdy wydarzenie ma `status = 'cancelled'`.
- Kształt `cancelledEvents = { path: "/api/electric/cancelled-events", table: "events", columns: ["id","status","cancelled_at"], where: "status = 'cancelled'" }`. `cancelledEventsCollection` z kluczem `id`.
- `useEventCancelled(eventId: string, initialStatus: EventStatus): boolean`: `true`, gdy status z serwera to `cancelled` albo kolekcja zawiera `eventId`.
- Server function `cancelAdminEventServer({ id })` z `assertCanManageEvent` i `registrationEmailHooks`. Nowy kod: `EVENT_ALREADY_CANCELLED`, `EVENT_CANCELLED`.

- [ ] **Krok 1: test e2e** `[F3] [F6] odwołanie zamyka zapisy, wysyła e-maile i zmienia stronę na żywo @organizator`:
  - wydarzenie ma 1 miejsce, osobę zapisaną X i osobę Y z listy rezerwowej. Uczestnik Z ma otwartą stronę wydarzenia;
  - organizator klika „Odwołaj wydarzenie” i potwierdza;
  - bez przeładowania strona Z pokazuje „Wydarzenie odwołane”, a przycisku „Zarejestruj się” nie ma;
  - X i Y mają w Mailpit wiadomość z „Odwołano” i tytułem w temacie oraz linkiem do wydarzenia;
  - lista publiczna pokazuje plakietkę „Odwołane”, a konto X pokazuje wydarzenie bez przycisku „Wypisz się”.
- [ ] **Krok 2:** uruchom test. Oczekiwane: FAIL.
- [ ] **Krok 3: Vitest:**
  - `cancelEvent` kolejkuje joby `cancelled` dla X i Y, a `registerForEvent` po odwołaniu daje `EVENT_CANCELLED`;
  - równoległe `registerForEvent` i `cancelEvent` (dwa połączenia, jak w `concurrency.test.ts`): nowy zapis ma job `cancelled` albo dostaje `EVENT_CANCELLED`;
  - worker: job `cancelled` wysyła e-mail bez linku do biletu, a dla wydarzenia, które nie jest `cancelled`, nic nie wysyła;
  - proxy: `where` z definicji kształtu trafia do Electric, a `where` od klienta jest ignorowane.
  Patrz, jak padają.
- [ ] **Krok 4:** implementacja. `useRegistrationActions` traktuje `EVENT_CANCELLED` jak każdy błąd domenowy (komunikat w `app-errors`).
- [ ] **Krok 5:** Vitest (`pnpm test`) i e2e z kroku 1. Oczekiwane: PASS.
- [ ] **Krok 6:** commit `feat: cancel an event with e-mails and live state`.

### Task 6: Duplikowanie wydarzenia

**Pliki:**
- Modyfikuj: `packages/db/src/queries/events.ts` (`duplicateEvent`), `packages/api/src/admin/mutations.ts`, `apps/admin/src/components/admin-event-detail/event-summary-card.tsx` (przycisk „Duplikuj” z dialogiem daty), messages
- Testy: `packages/db/test/event-duplicate.test.ts`, `e2e/tests/f3-duplikowanie.spec.ts`

**Interfejsy:**
- `duplicateEvent(input: { eventId: string; date: Date; actorId: string }): Promise<{ id: string }>`: nowe wydarzenie w stanie `draft` z tym samym tytułem, opisem, typem, miejscem, jednostką, limitem, terminem grup, linkiem i formą. `endsAt` i każdy punkt programu są przesunięte o `date - source.date`, z tymi samymi limitami, salami i `requiresRegistration`. Organizatorzy to organizatorzy źródła plus `actorId`. Zapisów, grup ani obecności nie kopiuje. Cała operacja to jedna transakcja.
- Server function `duplicateAdminEventServer({ id, date })` z `assertCanManageEvent(source)` i `canCreateEvents`. Po sukcesie panel przechodzi na nowe wydarzenie.

- [ ] **Krok 1: test e2e** `[F3] duplikat ma te same dane i nowy termin @organizator`: wydarzenie z opisem i dwoma punktami programu jest duplikowane na termin za 14 dni o 12:00. Panel otwiera kopię z plakietką „Szkic”, tym samym tytułem i opisem, datą za 14 dni 12:00 i dwoma punktami przesuniętymi o tę samą różnicę. Lista zapisanych kopii jest pusta.
- [ ] **Krok 2:** uruchom test. Oczekiwane: FAIL.
- [ ] **Krok 3: Vitest:** przesunięcie punktów o różnicę dat (także przez zmianę czasu letniego: źródło 20 marca 10:00, kopia 3 kwietnia 10:00 czasu warszawskiego); brak zapisów w kopii; organizatorzy skopiowani; kopia jest `draft`. Patrz, jak pada.
- [ ] **Krok 4:** implementacja. Różnica liczona w czasie ściennym strefy instalacji: dzień i godzinę każdego punktu przenosi się o liczbę dni między `toEventDateInput(source.date)` i `toEventDateInput(date)` oraz o różnicę godzin startu, przez `fromEventWallTime`. Dzięki temu 10:00 zostaje 10:00 po zmianie czasu.
- [ ] **Krok 5:** testy. Oczekiwane: PASS.
- [ ] **Krok 6:** commit `feat: duplicate an event`.

### Task 7: Wydarzenie tylko dla zalogowanych

**Pliki:**
- Modyfikuj: `packages/db/src/schema/events.ts` (`visibility`), `packages/db/src/queries/events.ts` (`audience` przyjmuje `{ kind: "public"; signedIn: boolean } | { kind: "manage" }`), `packages/api/src/events/queries.ts` (sesja z `getCurrentSession()`), `apps/web/src/routes/events/$eventId.tsx`, formularz w panelu, messages
- Utwórz: migrację `0016_event_visibility.sql`
- Testy: `packages/db/test/event-status.test.ts` (rozszerzenie), `e2e/tests/f2-widocznosc.spec.ts`

**Interfejsy:**
- `visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','authenticated'))`, `EventVisibility = "public" | "authenticated"`.
- `audience` z Task 4 zmienia typ na `{ kind: "public"; signedIn: boolean } | { kind: "manage" }`. Dla niezalogowanego publiczne zapytania pomijają `authenticated`.
- Strona wydarzenia `authenticated` dla niezalogowanego przekierowuje na `/login?redirect=<adres wydarzenia>` (nie 404, żeby link z ogłoszenia działał po zalogowaniu). Klucz zapytania listy zawiera `signedIn`.

- [ ] **Krok 1: test e2e** `[F2] wydarzenie tylko dla zalogowanych nie jest widoczne dla niezalogowanego @uczestnik`: niezalogowany nie widzi wydarzenia na liście, a jego adres prowadzi do logowania. Po zalogowaniu wraca na stronę wydarzenia i widzi je na liście.
- [ ] **Krok 2:** uruchom test. Oczekiwane: FAIL.
- [ ] **Krok 3: Vitest:** `getEventPage({ audience: { kind: "public", signedIn: false } })` pomija wydarzenie, a `signedIn: true` je zwraca. Patrz, jak pada.
- [ ] **Krok 4:** implementacja. W formularzu przełącznik „Tylko dla zalogowanych” (`Switch`).
- [ ] **Krok 5:** testy. Oczekiwane: PASS.
- [ ] **Krok 6:** commit `feat: events visible only to signed-in users`.

### Task 8: Lista zapisanych: wyszukiwanie, ręczne dodanie i usunięcie, CSV

**Pliki:**
- Modyfikuj: `packages/db/src/queries/event-registrations.ts` (`addRegistrantByEmail`, `removeRegistrant`), `apps/admin/src/components/admin-event-detail/registrants-list.tsx`, messages
- Utwórz: `packages/api/src/admin/registrants.ts`, `packages/api/src/admin/registrants-csv.ts`, `apps/admin/src/components/admin-event-detail/add-registrant-dialog.tsx`
- Testy: `packages/db/test/manage-registrants.test.ts`, `packages/api/test/registrants-csv.test.ts`, `e2e/tests/f7-zapisani.spec.ts`

**Interfejsy:**
- `addRegistrantByEmail(eventId: string, email: string, locale: "pl" | "en", hooks?: RegistrationHooks): Promise<{ registrationId: string; state: RegistrationState; txid: number }>`: konto po e-mailu (`USER_NOT_FOUND`) i te same reguły co `registerForEvent`, łącznie z listą rezerwową, gdy brak miejsc. E-mail `confirmed` albo `waitlisted` idzie przez hooki.
- `removeRegistrant(eventId: string, registrationId: string, hooks?: RegistrationHooks): Promise<{ txid: number }>`: jak `unregisterFromEvent` (blokada, kaskada punktów, `promoteAndNotify`, `assertEventOpen`), ale po `registrationId`. `NOT_REGISTERED`, gdy zapis nie należy do wydarzenia.
- `toRegistrantsCsv(registrants: EventRegistrant[], agenda: AgendaItem[], locale: "pl" | "en"): string`: BOM `﻿`, separator `;`, CRLF i nagłówki z messages: Imię i nazwisko; E-mail; Status; Data zapisu; Grupa; Punkty programu. Wartości w cudzysłowach z podwojonymi `"`. Komórka zaczynająca się od `= + - @ \t \r` dostaje prefiks `'`. Daty w strefie instalacji (`formatEventDateTime`).
- Server functions (z `assertCanManageEvent`): `addRegistrantServer({ eventId, email, locale })`, `removeRegistrantServer({ eventId, registrationId })`, `exportRegistrantsCsvServer({ eventId, locale }) → { filename: string; csv: string }`. `filename` to `zapisani-<slug tytułu>-<YYYY-MM-DD>.csv`.

- [ ] **Krok 1: test e2e** `[F7] organizator dodaje i usuwa osobę, szuka i pobiera CSV @organizator`:
  - organizator dodaje po e-mailu istniejącego użytkownika P, który pojawia się na liście ze statusem „Zarejestrowano” i dostaje e-mail potwierdzenia;
  - usuwa osobę Q (potwierdzenie w `AlertDialog`), a pierwsza osoba z listy rezerwowej awansuje (plakietka znika);
  - wpisanie fragmentu e-maila P w pole „Szukaj” zostawia na liście tylko P;
  - „Pobierz CSV” daje plik (`page.waitForEvent("download")`), którego pierwsza linia po BOM to nagłówki, a jeden z wierszy zawiera e-mail P i „Zarejestrowano”.
- [ ] **Krok 2:** uruchom test. Oczekiwane: FAIL.
- [ ] **Krok 3: Vitest:** `addRegistrantByEmail` na pełne wydarzenie daje `waitlisted`; `removeRegistrant` promuje pierwszą osobę z listy i kolejkuje e-mail `promoted`; `removeRegistrant` z `registrationId` innego wydarzenia daje `NOT_REGISTERED`. `toRegistrantsCsv`: BOM, `Zażółć`, cudzysłów w nazwie, prefiks `'` przed `=HYPERLINK("x")`. Patrz, jak pada.
- [ ] **Krok 4:** implementacja. Wyszukiwanie filtruje po stronie klienta (imię, e-mail) z filtrem stanu (Wszyscy, Zarejestrowani, Lista rezerwowa). Pobranie przez `Blob` i `<a download>`.
- [ ] **Krok 5:** testy. Oczekiwane: PASS.
- [ ] **Krok 6:** commit `feat(admin): manage registrants and export CSV`.

### Task 9: Wiadomość do zapisanych

**Pliki:**
- Modyfikuj: `packages/jobs/src/queues.ts` (nowy rodzaj joba), `apps/worker/src/handlers/send-email.ts`, `packages/api/src/notifications/email.tsx`, `packages/api/src/security/rate-limits.ts`, messages
- Utwórz: `packages/api/src/notifications/event-message-email.tsx`, `packages/api/src/admin/event-message.ts`, `packages/db/src/queries/event-message.ts`, `apps/admin/src/components/admin-event-detail/message-dialog.tsx`
- Testy: `packages/db/test/event-message.test.ts`, `apps/worker/test/send-email.test.ts`, `e2e/tests/f7-wiadomosc.spec.ts`

**Interfejsy:**
- `MessageAudience = "registered" | "waitlisted" | "all"`.
- Job `{ kind: "event-message"; registrationId: string; subject: string (1–200); body: string (1–5000); replyTo: z.email() }`.
- `queueEventMessage(input: { eventId: string; audience: MessageAudience; subject: string; body: string; replyTo: string }): Promise<{ recipients: number }>`: jedna transakcja wybiera zapisy wydarzenia według `audience` i kolejkuje joby przez `enqueueEmails(jobs, { tx })`.
- E-mail: temat `[<tytuł wydarzenia>] <subject>`, treść jako zwykły tekst (bez HTML od organizatora, w HTML każdy akapit to `<Text>`), stopka z linkiem do wydarzenia. `replyTo` to e-mail organizatora (`sendTransactionalEmail` dostaje opcjonalne `replyTo`).
- `EVENT_MESSAGE_LIMIT: RateLimit = { points: 5, durationSeconds: 3600 }` na klucz `event:<eventId>`.
- Server function `sendEventMessageServer({ eventId, audience, subject, body })` z `assertCanManageEvent` i limitem. Zwraca `{ recipients }`, a panel pokazuje „Wysłano do N osób”.

- [ ] **Krok 1: test e2e** `[F7] wiadomość dociera do wszystkich zapisanych @organizator`: wydarzenie ma dwie osoby zapisane i jedną na liście rezerwowej. Organizator wysyła „Zmiana sali” do odbiorców „Zarejestrowani”. Obie zapisane osoby mają w Mailpit wiadomość z tematem `[<tytuł>] Zmiana sali` i treścią, a osoba z listy rezerwowej jej nie ma.
- [ ] **Krok 2:** uruchom test. Oczekiwane: FAIL.
- [ ] **Krok 3: Vitest:** `queueEventMessage` z `audience` `registered`, `waitlisted` i `all` kolejkuje właściwą liczbę jobów. Worker: treść `<b>x</b>` trafia do HTML jako tekst (escapowana), a nagłówek `Reply-To` to e-mail organizatora. Patrz, jak pada.
- [ ] **Krok 4:** implementacja.
- [ ] **Krok 5:** testy. Oczekiwane: PASS.
- [ ] **Krok 6:** commit `feat: message registrants by e-mail`.

### Task 10: Skaner biletów i obecność

**Pliki:**
- Modyfikuj: `packages/db/src/schema/event-registrations.ts` (`checkedInAt`), `packages/db/src/queries/event-registrations.ts` (`EventRegistrant.checkedInAt`), `packages/api/src/admin/registrants-csv.ts` (kolumna „Obecność”), `registrants-list.tsx` (przełącznik obecności i licznik „Obecni: N / M”), `apps/admin/package.json` (`jsqr`), `e2e/playwright.config.ts`, `e2e/package.json` (`qrcode`), messages
- Utwórz: migrację `0017_checked_in_at.sql`, `packages/db/src/queries/check-in.ts`, `packages/api/src/admin/check-in.ts`, `apps/admin/src/routes/_authenticated/events.$eventId.scan.tsx`, `apps/admin/src/components/check-in/ticket-scanner.tsx`, `e2e/fixtures/fake-camera.ts`
- Testy: `packages/db/test/check-in.test.ts`, `e2e/tests/f11-skaner.spec.ts`

**Interfejsy:**
- Kolumna `checked_in_at timestamptz` (null to brak obecności). Awans ani rezygnacja jej nie zmieniają.
- `CheckInResult = { status: "checked-in" | "already-checked-in"; registrationId: string; name: string; email: string; checkedInAt: Date }`.
- `checkInByTicketCode(eventId: string, ticketCode: string): Promise<CheckInResult>`: `TICKET_NOT_FOUND`, gdy kod nie należy do zapisu tego wydarzenia; `TICKET_WAITLISTED` dla listy rezerwowej; `EVENT_CANCELLED` dla odwołanego. Drugi skan zwraca `already-checked-in` z pierwotnym czasem (`UPDATE … WHERE checked_in_at IS NULL`).
- `setCheckedIn(eventId: string, registrationId: string, checkedIn: boolean): Promise<void>` do ręcznego przełącznika.
- Skaner przyjmuje tylko treść `harmonogram-ticket:<kod>` (inna treść daje komunikat „To nie jest bilet”). Ten sam kod w ciągu 3 s nie wywołuje serwera drugi raz.
- Server functions z `assertCanManageEvent`: `checkInServer({ eventId, ticketCode })`, `setCheckedInServer({ eventId, registrationId, checkedIn })`.
- Fikstura `writeQrY4m(text: string, path: string): Promise<void>` zapisuje 30 klatek 640×480 YUV4MPEG2 (C420jpeg) z kodem QR (`qrcode.toBuffer` → `pngjs` → konwersja RGB na YCbCr BT.601). Projekt Playwright `skaner` (Chromium, 360 px) ma `launchOptions.args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--use-file-for-fake-video-capture=<e2e/.run/ticket.y4m>"]` i `permissions: ["camera"]`, uruchamia tylko testy `@skaner`, a plik powstaje w `globalSetup` dla stałej treści `harmonogram-ticket:e2e-skaner-0000…` (64 znaki).

- [ ] **Krok 1: test e2e** `[F11] skan biletu odhacza obecność @skaner`:
  - fikstura usuwa ewentualny stary zapis z kodem `e2e-skaner-…`, zapisuje uczestnika i ustawia jego `ticket_code` na tę stałą;
  - organizator otwiera „Skanuj bilety” i widzi „Obecny: <imię>”;
  - lista zapisanych pokazuje przełącznik obecności włączony i „Obecni: 1 / 1”;
  - po 3 s ten sam obraz pokazuje „Już odhaczono o <HH:MM>”.
  Drugi test `[F11] ręczne odhaczenie i obecność w CSV @organizator`: przełącznik przy osobie zapisanej ustawia obecność, a CSV ma w kolumnie „Obecność” wartość „tak”.
- [ ] **Krok 2:** uruchom testy. Oczekiwane: FAIL.
- [ ] **Krok 3: Vitest:** pierwszy skan `checked-in`, drugi `already-checked-in` z tym samym czasem; kod z innego wydarzenia daje `TICKET_NOT_FOUND`; osoba z listy rezerwowej daje `TICKET_WAITLISTED`; awans nie zmienia `checked_in_at`. Patrz, jak pada.
- [ ] **Krok 4:** implementacja. Skaner: `getUserMedia({ video: { facingMode: "environment" } })` w `<video>`, a co 250 ms klatka trafia przez `<canvas>` do `jsQR`. Wynik ma duży komunikat (zielony: obecny, żółty: już odhaczony, czerwony: błąd) i wibrację `navigator.vibrate(100)`, jeśli jest. Brak zgody na kamerę daje komunikat z instrukcją. Kamera zatrzymuje się po opuszczeniu strony.
- [ ] **Krok 5:** testy, potem `pnpm e2e`. Oczekiwane: PASS.
- [ ] **Krok 6:** commit `feat(admin): ticket scanner and attendance`.

### Task 11: Spec, dokumentacja i pełna weryfikacja

**Pliki:** `docs/superpowers/specs/2026-11-19-produkt-design.md`, `CLAUDE.md`

- [ ] **Krok 1: spec:**
  - statusy F2, F3, F7 i F11 na „gotowe” (z nazwami testów);
  - F6: trzy przypadki ze specu działają;
  - poprawka K4 (organizator w `apps/admin`, decyzja z 20.11) i wpis w historii zmian;
  - statusy F4 i F6, które są dziś nieaktualne, wyrównane z testami.
- [ ] **Krok 2: `CLAUDE.md`:** „Built and tested”, rola `organizer` i `event_organizers` w Architecture (Auth), kształt `cancelledEvents` w opisie Electric, Roadmap: plan 2 wykonany, następny plan 3.
- [ ] **Krok 3:** `pnpm lint && pnpm typecheck && pnpm test && pnpm e2e:up && pnpm e2e`. Oczekiwane: wszystko zielone.
- [ ] **Krok 4:** commit `docs: organizer plan done`. Bez pushowania.

---

## Następne (poza tym planem, kolejność propozycji)

Każdy punkt to przyszły plan albo jego część, zgodnie z zasadą „jeden aktywny plan”. Porównanie z Indico w nawiasach.

**Plan 3: istniejące funkcje uczestnika do poziomu Indico**
1. F9 RODO: klauzula przy zapisie, okres przechowywania zapisów (zadanie pg-boss), eksport i usunięcie własnych danych (Indico: polityka prywatności, retencja danych rejestracji). Bez tego uczelnia nie może ruszyć.
2. F1 język w profilu: e-maile i zaproszenia grupowe w języku osoby (naprawia znany błąd z linkiem `/en/`).
3. F4 kalendarz: subskrypcja ICS (wszystkie i moje zapisy), Open Graph na stronie wydarzenia, widok miesiąca, filtr terminu i formy (na miejscu, online) (Indico: iCal kategorii i wydarzeń).
4. F8 dostępność: skan axe na każdym ekranie, deklaracja dostępności, reguła lint na teksty spoza tłumaczeń, issue #25.
5. F18 prelegenci przy punktach programu (Indico: prelegenci i konwenerzy), razem z F19.

**Priorytet 2 (brak):** F10 własne pytania w formularzu (Indico: formularze z wieloma typami pól), F12 zaświadczenia PDF dla obecnych (wymaga obecności z Task 10), F13 przypomnienia i e-mail o zmianie terminu lub miejsca, F14 materiały (pliki i linki), F15 statystyki (zapisani, obecni, odsetek nieobecnych), F16 import z Indico, F17 goście bez konta.

**Priorytet 3 (brak):** F19 wystąpienia i prelegenci, F20 ankiety, F21 opłaty, F22 strona wydarzenia (logo, nagłówek, podstrony), F23 Teams, F24 API i widżet, F25 USOS.

**Drobne braki względem Indico, zauważone przy tym planie:** wydarzenie bez limitu miejsc (dziś limit jest wymagany), zatwierdzanie zapisów przez organizatora (moderacja w Indico), dziennik zmian wydarzenia (event log w Indico), wydarzenia cykliczne przy duplikowaniu (Indico klonuje serię).

**Później (w specu, bez planu):** abstrakty i recenzje, rezerwacja sal, identyfikatory do druku, treść w dwóch językach, odznaki, push, rekomendacje.

**Porządki:** zamknąć albo przypisać do funkcji otwarte issues (#5–#25). Część jest zrobiona (#11 bilet, #17 e-mail, #22 pg-boss, #6 lista), część wchodzi w ten plan (#14 kreator, #16 odwołanie).
