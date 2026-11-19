# Moje zapisy, bilety z kodem QR i dwa widoki programu: plan implementacji

> **Dla wykonawcy:** wymagany skill `superpowers:executing-plans` (wykonanie inline). Kroki mają składnię checkboxów (`- [ ]`).

**Cel:** uczestnik widzi na koncie wszystkie swoje zapisy, otwiera bilet z kodem QR i przegląda program wydarzenia jako listę albo siatkę godzin.

**Architektura:**
- *Moje zapisy:* jedno zapytanie `listMyRegistrations` w `@repo/db` i jedna server function. Na stronie konta jest sekcja z zapisami nadchodzącymi i minionymi. Rezygnacja przechodzi przez istniejący hook `useRegistrationActions`.
- *Bilet:* każdy zapis dostaje niezgadywalny `ticket_code` (migracja 0013). Bilet otwiera się pod `/tickets/$registrationId` i może go zobaczyć tylko właściciel. Kod QR koduje `harmonogram-ticket:<ticket_code>` i jest generowany biblioteką `qrcode`, której używa już `apps/web`. E-mail potwierdzenia i awansu linkuje do biletu.
- *Program:* nowa funkcja `layoutAgenda` w `@repo/ui/agenda` dzieli punkty na dni i kolumny dla równoległych sesji. Na stronie wydarzenia jest przełącznik Lista / Kalendarz zapamiętywany w URL (`?agenda=calendar`). Kliknięcie punktu w siatce otwiera dialog z obecnym `AgendaItemRow`, więc zapis działa tak samo w obu widokach.

**Stos:** TanStack Start/Router/Query, Drizzle + Postgres, Paraglide, shadcn (`dialog`, `button`, `badge`), `qrcode`, Playwright, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-19-produkt-design.md`: F5 (zapisy), F11 (bilety i obecność, tu tylko bilet), F18 (program wydarzenia).

## Decyzje użytkownika (19.11)

- Najpierw krótki plan, potem wykonanie inline.
- F11 w tym planie obejmuje tylko bilet z kodem QR: stronę biletu, link z konta i link z e-maila. Skanowanie i odhaczanie obecności wchodzą do planu 2 razem z panelem organizatora.
- Dwa widoki programu są tylko na publicznej stronie wydarzenia, bez panelu admina.
- „Moje zapisy" pokazuje zapisy nadchodzące i minione. Każdy ma status (zapisany albo pozycja na liście rezerwowej), wybrane punkty programu, link do wydarzenia i do biletu. Przy nadchodzących jest przycisk rezygnacji.
- Commity tylko lokalnie na `next`, bez pushowania, dopóki użytkownik nie zdecyduje inaczej.

## Ograniczenia globalne

- Funkcja jest gotowa, gdy przechodzi jej test e2e. Nazwa testu zaczyna się od numeru funkcji (`[F5]`, `[F11]`, `[F18]`), a test piszemy najpierw i patrzymy, jak pada.
- Bez rozwiązań tymczasowych i bez kodu „na przyszłość": skaner i obecność nie dostają w tym planie żadnych zalążków.
- UI po polsku i angielsku: każdy tekst idzie do `packages/i18n/messages/{pl,en}.json`, a potem `pnpm messages:compile`.
- Widoki projektujemy najpierw na telefon (360 px), potem na komputer. Testy e2e stron uczestnika mają tag `@uczestnik`.
- Bez nowych zależności w aplikacjach. W testach e2e dochodzą tylko `jsqr` i `pngjs` do odczytu QR ze zrzutu ekranu.
- Konwencje z `CLAUDE.md`: bez barrel files, `env` z `@repo/env`, `appError(CODE)` z kodem w `domain-errors` i komunikatem w `app-errors`, Biome.

## Na co uważać przy przeglądzie

1. Cudzy bilet: `/tickets/<id cudzego zapisu>` daje „nie znaleziono", a nie dane innej osoby. Test w Task 3.
2. Bilet osoby z listy rezerwowej: strona pokazuje, że bilet pojawi się po awansie, i nie pokazuje kodu QR. Test w Task 3.
3. Kod biletu nie zmienia się przy awansie z listy rezerwowej ani przy zapisie na punkt programu. Test w Task 2.
4. Siatka programu na telefonie (360 px) z dwiema równoległymi sesjami: obie są widoczne obok siebie i żadna nie wychodzi poza ekran. Test w Task 6.
5. Program wielodniowy dzieli się na dni w strefie czasowej instalacji, a nie w UTC. Unit test w Task 5 dla punktu o 23:30 czasu warszawskiego.

---

### Task 1: Moje zapisy na koncie

**Pliki:**
- Modyfikuj: `packages/db/src/queries/event-registrations.ts` (nowe `listMyRegistrations`)
- Utwórz: `packages/api/src/events/my-registration-list.ts` (server function i `myRegistrationListQueryOptions`); dopisz go do `package.json#exports`, jeśli pakiet je wylicza
- Utwórz: `apps/web/src/components/account/my-registrations.tsx`
- Modyfikuj: `apps/web/src/routes/account.tsx`, `packages/i18n/messages/{pl,en}.json`
- Testy: `packages/db/test/my-registrations.test.ts`, `e2e/tests/f5-moje-zapisy.spec.ts`

**Interfejsy:**
- Tworzy `listMyRegistrations(userId: string): Promise<MyRegistrationListItem[]>`, gdzie `MyRegistrationListItem = { registrationId, eventId, title, date: Date, effectiveEndsAt: Date, locationLabel: string | null, state: RegistrationState, waitlistPosition: number | null, items: { id, title, startsAt: Date, endsAt: Date }[] }`. Sortowanie po `date` rosnąco. Podział na nadchodzące i minione robi UI według `effectiveEndsAt`.
- Tworzy klucz `myRegistrationListQueryOptions.queryKey`. Dodaj go do `refreshKeys` w `use-registration-actions.ts`.

- [ ] **Krok 1: test e2e (najpierw)** `[F5] konto pokazuje moje nadchodzące i minione zapisy @uczestnik`:
  - dany jest użytkownik zapisany na wydarzenie za 7 dni z jednym punktem programu, na liście rezerwowej pełnego wydarzenia i zapisany na wydarzenie zakończone wczoraj (zapis wstawiony fiksturą przed przesunięciem daty);
  - na `/pl/account` sekcja „Nadchodzące" pokazuje oba przyszłe wydarzenia, z tekstem „Zarejestrowano" i nazwą punktu przy pierwszym oraz „Lista rezerwowa (pozycja 1)" przy drugim;
  - sekcja „Minione" pokazuje zakończone wydarzenie bez przycisku rezygnacji;
  - kliknięcie „Wypisz się" przy pierwszym i potwierdzenie usuwa je z listy.
- [ ] **Krok 2:** `pnpm e2e:up && pnpm --filter e2e e2e -g "\[F5\] konto"`. Oczekiwane: FAIL, brak sekcji „Nadchodzące".
- [ ] **Krok 3: test Vitest** `listMyRegistrations`: zwraca zapisy tylko tego użytkownika, z `state` i `waitlistPosition` (1), z punktami programu i posortowane po dacie. Uruchom go i patrz, jak pada.
- [ ] **Krok 4: implementacja.**
  - Zapytanie składa `getMyRegistrationStates` z danymi wydarzeń (`events` + `getEffectiveEventEnd` jako jedno zapytanie z `max(agenda_items.ends_at)`) i punktami programu.
  - Server function to `publicQueryFn`/GET z sesją; bez sesji zwraca `[]`.
  - Komponent dostaje sekcje „Nadchodzące" i „Minione", a każdy wpis jest kartą z linkiem do wydarzenia.
  - Rezygnacja idzie przez istniejący `UnregisterEventDialog` i `useRegistrationActions().unregister`.
- [ ] **Krok 5:** `pnpm --filter @repo/db exec vitest run test/my-registrations.test.ts`, potem e2e z kroku 2. Oczekiwane: PASS.
- [ ] **Krok 6:** commit `feat(web): my registrations on the account page`.

### Task 2: Kod biletu przy każdym zapisie

**Pliki:**
- Modyfikuj: `packages/db/src/schema/event-registrations.ts` (`ticketCode`)
- Utwórz: migrację `packages/db/src/migrations/0013_ticket_code.sql` (`pnpm db:generate`, a potem ręcznie default i backfill)
- Test: `packages/db/test/ticket-code.test.ts`

**Interfejsy:**
- Tworzy kolumnę `ticket_code text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')` (64 znaki hex, wbudowane w Postgres 13+, bez pgcrypto). Istniejące wiersze dostają kod z defaultu w tej samej migracji.

- [ ] **Krok 1: testy Vitest:**
  - każdy zapis ma 64-znakowy kod hex, a dwa zapisy mają różne kody;
  - awans z listy rezerwowej nie zmienia kodu;
  - zapis na punkt programu nie zmienia kodu.
- [ ] **Krok 2:** uruchom testy. Oczekiwane: FAIL, brak kolumny.
- [ ] **Krok 3:** schemat, `pnpm db:generate` i dopisanie defaultu do migracji.
- [ ] **Krok 4:** testy z kroku 1 oraz `pnpm --filter @repo/db test`. Oczekiwane: PASS.
- [ ] **Krok 5:** commit `feat(db): unguessable ticket code per registration`.

### Task 3: Strona biletu z kodem QR

**Pliki:**
- Modyfikuj: `packages/db/src/queries/event-registrations.ts` (`getMyTicket`)
- Utwórz: `packages/api/src/events/ticket.ts` (server function i `ticketQueryOptions(registrationId)`)
- Utwórz: `apps/web/src/routes/tickets/$registrationId.tsx` (`beforeLoad: requireAuthenticatedUser`), `apps/web/src/components/tickets/ticket-card.tsx`
- Modyfikuj: `apps/web/src/components/account/my-registrations.tsx` (link „Bilet"), messages
- Testy: `packages/db/test/ticket-code.test.ts` (rozszerzenie), `e2e/tests/f11-bilety.spec.ts`; `e2e/package.json` dostaje `jsqr` i `pngjs`

**Interfejsy:**
- Tworzy `getMyTicket(registrationId: string, userId: string): Promise<Ticket | null>`, gdzie `Ticket = { registrationId, ticketCode, state, eventId, title, date, effectiveEndsAt, locationLabel, holderName, holderEmail }`. Zwraca `null`, gdy zapis nie należy do użytkownika.
- Treść QR: `harmonogram-ticket:<ticketCode>`.

- [ ] **Krok 1: testy e2e:**
  - `[F11] bilet z kodem QR na koncie @uczestnik`: zapisany użytkownik klika na koncie „Bilet". Strona biletu pokazuje tytuł, datę, imię i e-mail. Zrzut `img[alt="Kod QR biletu"]` odczytany przez `jsqr` daje `harmonogram-ticket:<ticket_code z bazy>`.
  - `[F11] cudzy bilet i bilet z listy rezerwowej`: cudzy `registrationId` daje „Nie znaleziono biletu". Osoba z listy rezerwowej widzi „Bilet pojawi się po awansie z listy rezerwowej" i nie widzi obrazka QR.
- [ ] **Krok 2:** uruchom oba testy. Oczekiwane: FAIL, brak linku „Bilet" i trasy.
- [ ] **Krok 3: test Vitest** `getMyTicket`: zwraca bilet właściciela, a dla innego użytkownika `null`. Patrz, jak pada.
- [ ] **Krok 4: implementacja.**
  - QR jako `<img>` z `QRCode.toDataURL(text, { margin: 1, width: 280 })`, tak jak w `join-link-card.tsx`.
  - Karta jest pełnej szerokości na telefonie. Przycisk „Drukuj" wywołuje `window.print()`, a style druku ukrywają nawigację.
- [ ] **Krok 5:** Vitest i e2e z kroku 1. Oczekiwane: PASS.
- [ ] **Krok 6:** commit `feat(web): ticket page with QR code`.

### Task 4: Link do biletu w e-mailu potwierdzenia i awansu

**Pliki:**
- Modyfikuj: `packages/api/src/notifications/registration-email.tsx` (`ticketUrl?: string` dla `confirmed` i `promoted`), `apps/worker/src/handlers/send-email.ts` (adres `${BETTER_AUTH_URL}/<locale>/tickets/<registrationId>`), messages
- Testy: `apps/worker/test/send-email.test.ts`, `e2e/tests/f6-powiadomienia.spec.ts`

- [ ] **Krok 1: testy:**
  - worker: e-mail `confirmed` zawiera `/pl/tickets/<registrationId>` w tekście i HTML, a e-mail `waitlisted` go nie zawiera;
  - e2e `[F11] e-mail potwierdzenia linkuje do biletu`: link z Mailpit otwiera stronę biletu (po zalogowaniu).
- [ ] **Krok 2:** uruchom testy. Oczekiwane: FAIL.
- [ ] **Krok 3:** implementacja. Adres budowany jest w workerze, który zna `locale` zapisu.
- [ ] **Krok 4:** `pnpm --filter worker test` i e2e. Oczekiwane: PASS.
- [ ] **Krok 5:** commit `feat(worker): ticket link in confirmation and promotion e-mails`.

### Task 5: Układ programu na dni i kolumny

**Pliki:**
- Modyfikuj: `packages/ui/src/agenda.ts`
- Test: `packages/ui/test/agenda.test.ts`

**Interfejsy:**
- Tworzy `layoutAgenda<T extends AgendaTimed>(items: T[], timeZone: string): AgendaDay<T>[]`, gdzie `AgendaDay<T> = { day: string /* YYYY-MM-DD w timeZone */, startMinute: number, endMinute: number, lanes: number, items: Array<T & { lane: number; startMinute: number; endMinute: number }> }`.
- Minuty liczone są od północy dnia w `timeZone`. `startMinute` i `endMinute` dnia są zaokrąglone do pełnej godziny.
- Kolumny przydzielane są zachłannie: punkt dostaje najniższą kolumnę, której ostatni punkt już się skończył. Stykające się punkty mieszczą się w jednej kolumnie.

- [ ] **Krok 1: testy:**
  - dwie równoległe sesje dają `lanes: 2` z kolumnami 0 i 1;
  - punkt stykający się z poprzednim dostaje kolumnę 0;
  - punkt o 23:30 czasu warszawskiego trafia do swojego dnia, a nie do następnego dnia w UTC;
  - program na dwa dni daje dwa elementy `AgendaDay`;
  - zakres dnia jest od pełnej godziny do pełnej godziny.
- [ ] **Krok 2:** `pnpm --filter @repo/ui test`. Oczekiwane: FAIL.
- [ ] **Krok 3:** implementacja. Do dnia i minut w strefie służy `Intl.DateTimeFormat` z `timeZone`.
- [ ] **Krok 4:** testy. Oczekiwane: PASS.
- [ ] **Krok 5:** commit `feat(ui): agenda layout by day and parallel lanes`.

### Task 6: Program jako lista albo kalendarz

**Pliki:**
- Utwórz: `apps/web/src/components/event-details/agenda-view-toggle.tsx`, `apps/web/src/components/event-details/agenda-calendar.tsx`
- Modyfikuj:
  - `agenda-timeline.tsx`: lista zostaje bez zmian, a komponent wybiera widok;
  - `agenda-item-row.tsx`: prop `as: "li" | "div"` dla dialogu;
  - `routes/events/$eventId.tsx`: `validateSearch` dostaje `agenda: z.enum(["list","calendar"]).optional().catch(undefined)`;
  - messages.
- Test: `e2e/tests/f18-program.spec.ts`; `createTestEvent` w fiksturach przyjmuje `startHour` i `durationMinutes` punktu.

- [ ] **Krok 1: test e2e (oba projekty)** `[F18] program w widoku listy i kalendarza @uczestnik`:
  - wydarzenie ma trzy punkty: otwarcie 0–60 min oraz dwa równoległe warsztaty 90–180 min z limitem;
  - domyślnie widać listę (`listitem` z „Otwarcie");
  - po kliknięciu „Kalendarz" URL zawiera `agenda=calendar`, a dwa warsztaty mają ten sam `y` i różne `x` w `boundingBox`. Oba mieszczą się w szerokości okna, także 360 px;
  - kliknięcie warsztatu otwiera dialog z „Wolne miejsca: 2 / 2" i przyciskiem „Zarejestruj się". Zapis z dialogu zmienia licznik na „1 / 2";
  - przeładowanie strony zostawia widok kalendarza.
- [ ] **Krok 2:** uruchom test. Oczekiwane: FAIL, brak przełącznika.
- [ ] **Krok 3: implementacja.**
  - Przełącznik to dwa przyciski z `aria-pressed`, a wybór zmienia `search.agenda` (`replace: true`).
  - Kalendarz: dla każdego dnia z `layoutAgenda(items, EVENT_TIME_ZONE)` jest nagłówek dnia (tylko gdy program ma więcej niż jeden dzień) i siatka z kolumną godzin. Każdy punkt to `button` pozycjonowany `top/height` (1,2 px na minutę, minimum 44 px) i `left/width` z `lane/lanes`.
  - Blok pokazuje godzinę, tytuł i licznik miejsc na żywo (ten sam `itemCounts`). Pełny punkt i punkt, na który jestem zapisany, mają wyróżnienie.
  - Dialog (`@repo/ui/components/dialog`) renderuje `AgendaItemRow as="div"`.
- [ ] **Krok 4:** test z kroku 1 oraz `pnpm e2e`. Oczekiwane: PASS.
- [ ] **Krok 5:** commit `feat(web): agenda as list or calendar`.

### Task 7: Dokumentacja i pełna weryfikacja

**Pliki:** `docs/superpowers/specs/2026-11-19-produkt-design.md` (statusy F11: częściowo, bilet z QR; F18: dwa widoki), `CLAUDE.md` (sekcja „Built and tested")

- [ ] **Krok 1:** aktualizacja spec i `CLAUDE.md`.
- [ ] **Krok 2:** `pnpm lint && pnpm typecheck && pnpm test && pnpm e2e:up && pnpm e2e`. Oczekiwane: wszystko zielone.
- [ ] **Krok 3:** commit `docs: my registrations, tickets and agenda views`. Bez pushowania.
