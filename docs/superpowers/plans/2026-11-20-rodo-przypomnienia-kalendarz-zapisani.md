# Plan 3: RODO, przypomnienia, kalendarz, akcje grupowe, pomocnik od wejścia

> **Dla wykonawcy:** `superpowers:executing-plans` (inline), jeden przegląd całości na końcu, a po każdej większej funkcji przegląd i uproszczenie z Context7 (AGENTS.md). Kroki mają składnię checkboxów (`- [ ]`).

**Cel:** brakujące funkcje z `docs/indico-comparison.md` priorytetu 1–2, każda co najmniej na poziomie Indico i wygodniejsza na telefonie: F9, F13, reszta F4, F28, F29.

**Architektura:**
- *RODO (F9):* klauzula pod przyciskiem zapisu (tekst z linkiem do pełnej informacji, bez dodatkowego kliknięcia). Okres przechowywania `REGISTRATION_RETENTION_DAYS` w `@repo/env` (domyślnie 365); codzienne zadanie pg-boss `prune-old-registrations` usuwa zapisy wydarzeń zakończonych dawniej niż ten okres. Eksport własnych danych (JSON) i usunięcie konta na stronie konta; usunięcie najpierw wycofuje przyszłe zapisy z awansem listy rezerwowej, potem kasuje konto.
- *Przypomnienia i zmiany (F13):* `events.reminder_hours_before` (domyślnie 24, `null` = wyłączone) i `events.reminder_sent_at`. `queueDueReminders(now, hooks)` w `@repo/db` wybiera wydarzenia do przypomnienia; zadanie pg-boss co 5 minut. `updateEvent` porównuje termin i miejsce opublikowanego wydarzenia i zgłasza zmianę wszystkim zapisanym i rezerwowym (e-mail ze starą i nową wartością).
- *Kalendarz (F4):* generator ICS w `packages/api/src/calendar/ics.ts` (RFC 5545: escapowanie, zawijanie linii, UTC). Trasy: `/api/calendar/events.ics` (nadchodzące publiczne), `/api/calendar/event/$eventId.ics` („Dodaj do kalendarza”), `/api/calendar/my/$token.ics` (moje zapisy; `user.calendar_token`). Open Graph w `head` trasy wydarzenia. Filtry „Kiedy” (dziś, ten tydzień, ten miesiąc) i „Forma”.
- *Akcje grupowe (F28):* zaznaczanie na liście zapisanych, pasek akcji przyklejony na dole ekranu telefonu: odhacz obecność, wiadomość do zaznaczonych, usuń. Eksport XLSX w przeglądarce (biblioteka wybrana po sprawdzeniu w Context7, bez zależności serwerowych).
- *Pomocnik od wejścia (F29):* `event_organizers.role` `manager | checkin`. `assertCanManageEvent` wymaga `manager`, nowy `assertCanCheckIn` przepuszcza oba. Szczegóły wydarzenia dla pomocnika zawierają tylko skaner i listę obecności.

**Stos:** Drizzle, pg-boss, TanStack Start/Router/Query, Better Auth, react-email, Paraglide, Playwright, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-19-produkt-design.md`: F9, F13, F4, F28, F29.

## Ograniczenia globalne

- Test e2e `[Fn] …` najpierw i patrz, jak pada; ekrany najpierw na 360 px; teksty pl/en; migracje przez `pnpm db:generate`; e-maile kolejkowane w transakcji danych; kolejność blokad z `docs/data-flows.md`; każda nowa funkcja panelu sprawdza dostęp w handlerze (lista plików w `packages/api/test/event-access.test.ts`).
- Czas w testach: zadania okresowe mają funkcję z parametrem `now` (wywoływaną w testach bezpośrednio), a cron tylko ją woła.

## Na co uważać przy przeglądzie

1. Usunięcie konta osoby zapisanej na pełne wydarzenie awansuje pierwszą osobę z listy rezerwowej (nie tylko kasuje wiersz). Test w Task 2.
2. Przypomnienie nie idzie dwa razy (dwa przebiegi crona), nie idzie dla odwołanego wydarzenia ani do osób z listy rezerwowej. Test w Task 3.
3. ICS: przecinki, średniki i nowe linie w tytule są escapowane, długie linie zawinięte; plik „moje zapisy” z cudzym albo zmyślonym tokenem daje 404. Testy w Task 5.
4. Akcje grupowe na zaznaczonych, gdy część już zniknęła (usunięta w innej karcie): pozostałe się wykonują, komunikat mówi, ile się udało. Test w Task 7.
5. Pomocnik wywołujący bezpośrednio edycję wydarzenia albo usuwanie zapisów dostaje `FORBIDDEN`. Test w Task 8.

---

### Task 1: Klauzula przy zapisie i okres przechowywania (F9)

**Pliki:** `packages/env/src/index.ts` (`REGISTRATION_RETENTION_DAYS`), `packages/db/src/queries/retention.ts`, `packages/jobs/src/queues.ts`, `apps/worker/src/index.ts` + handler, `apps/web/src/components/event-details/event-summary.tsx` (klauzula), strona `apps/web/src/routes/privacy.tsx` (pełna informacja), messages. Testy: `packages/db/test/retention.test.ts`, `e2e/tests/f9-rodo.spec.ts`.

**Interfejsy:** `pruneOldRegistrations(now: Date, retentionDays: number): Promise<{ deleted: number }>` — usuwa zapisy (i zapisy na punkty) wydarzeń, których efektywny koniec był ponad `retentionDays` temu.

- [ ] e2e `[F9] klauzula jest widoczna przy zapisie @uczestnik`: na stronie wydarzenia pod przyciskiem zapisu jest tekst klauzuli z linkiem „Informacja o danych osobowych”, który otwiera stronę z pełną treścią.
- [ ] Vitest: zapis wydarzenia zakończonego 400 dni temu znika przy `retentionDays = 365`, zakończonego 100 dni temu zostaje; lista zapisanych w panelu i CSV go nie zawierają.
- [ ] Implementacja, testy zielone, commit `feat: privacy notice and registration retention`.

### Task 2: Eksport i usunięcie własnych danych (F9)

**Pliki:** `packages/db/src/queries/account-data.ts`, `packages/api/src/auth/account-data.ts` (server functions), `packages/api/src/auth/better-auth.ts` (`user.deleteUser` z `beforeDelete`), `apps/web/src/routes/account.tsx` (sekcja „Twoje dane”), messages. Testy: `packages/db/test/account-data.test.ts`, `e2e/tests/f9-rodo.spec.ts`.

**Interfejsy:** `exportAccountData(userId): Promise<AccountDataExport>` (profil, zapisy z punktami, grupy, obecność); `withdrawBeforeAccountDeletion(userId, hooks): Promise<void>` (wycofuje przyszłe zapisy z awansem, zamyka własne grupy).

- [ ] e2e `[F9] eksport zawiera moje zapisy, a po usunięciu konta logowanie nie działa @uczestnik`: pobrany JSON zawiera tytuł wydarzenia; po potwierdzeniu usunięcia (wpisanie e-maila) logowanie linkiem pokazuje błąd albo zakłada nowe, puste konto bez starych zapisów.
- [ ] Vitest: usunięcie konta osoby zapisanej na pełne wydarzenie awansuje pierwszą osobę z listy (e-mail `promoted` w hookach).
- [ ] Implementacja, testy, commit `feat: export and delete my data`.

### Task 3: Przypomnienia (F13)

**Pliki:** schemat + migracja (`reminder_hours_before int default 24`, `reminder_sent_at`), `packages/db/src/queries/reminders.ts`, job `event-reminders` (cron `*/5 * * * *`), e-mail `reminder` w workerze, pole „Przypomnienie” w formularzu wydarzenia (Wyłączone / 1 h / 24 h / 48 h przed), messages. Testy: `packages/db/test/reminders.test.ts`, `apps/worker/test/send-email.test.ts`, `e2e/tests/f13-przypomnienia.spec.ts`.

**Interfejsy:** `queueDueReminders(now: Date, onRecipients: (tx, registrationIds: string[], eventId: string) => Promise<void>): Promise<{ events: number }>`.

- [ ] Vitest: wydarzenie za 23 h z przypomnieniem 24 h zgłasza zapisanych (bez rezerwowych) i ustawia `reminder_sent_at`; drugi przebieg nic nie zgłasza; odwołane i szkic nic.
- [ ] e2e `[F13] przypomnienie przychodzi o ustalonej godzinie`: fikstura woła `queueDueReminders` z „teraz” 23 h przed startem; w Mailpit jest „Przypomnienie: <tytuł>” z datą i linkiem.
- [ ] Implementacja, testy, commit `feat: event reminders`.

### Task 4: Informacja o zmianie terminu lub miejsca (F13)

**Pliki:** `packages/db/src/queries/events.ts` (`updateEvent` zwraca i zgłasza zmianę), job `event-changed`, e-mail w workerze, messages. Testy: `packages/db/test/event-change.test.ts`, `e2e/tests/f13-przypomnienia.spec.ts`.

**Interfejsy:** `RegistrationHooks` dostaje opcjonalne `onEventChanged(tx, change: { eventId; registrationIds; before: { date; place }; after: { date; place } })`.

- [ ] e2e `[F13] zmiana terminu daje e-mail ze starą i nową datą @organizator`: organizator zmienia datę opublikowanego wydarzenia; zapisany dostaje e-mail z obiema datami.
- [ ] Vitest: zmiana sali na szkicu nic nie wysyła; zmiana tylko opisu nic; zmiana terminu opublikowanego zgłasza zapisanych i rezerwowych.
- [ ] Implementacja, testy, commit `feat: tell registrants when date or place changes`.

### Task 5: Subskrypcja ICS i „Dodaj do kalendarza” (F4)

**Pliki:** `packages/api/src/calendar/ics.ts`, trasy w `apps/web/src/routes/api/calendar/`, `user.calendar_token` (migracja), przyciski na stronie wydarzenia i koncie („Dodaj do kalendarza”, „Subskrybuj moje zapisy” z kopiowaniem linku), messages. Testy: `packages/api/test/ics.test.ts`, `e2e/tests/f4-kalendarz.spec.ts`.

- [ ] Vitest: tytuł `Wykład, część 1; sala B` jest escapowany; linia > 75 bajtów zawinięta; `DTSTART` w UTC; `URL` wskazuje stronę wydarzenia.
- [ ] e2e `[F4] plik ICS zawiera wydarzenie z poprawnym terminem i linkiem @uczestnik`: „Dodaj do kalendarza” pobiera plik z `SUMMARY`, `DTSTART` i adresem; plik „moje zapisy” zawiera wydarzenie, na które jestem zapisany; zmyślony token daje 404.
- [ ] Implementacja, testy, commit `feat: calendar files and subscriptions`.

### Task 6: Open Graph i filtry „Kiedy” i „Forma” (F4)

**Pliki:** `apps/web/src/routes/events/$eventId.tsx` (`head`), `packages/api/src/events/schemas.ts` (`when`, `mode`), `packages/db/src/queries/events.ts` (`EventFilters`), filtry w `@repo/ui/composed/events/event-filters.tsx`, messages. Testy: `e2e/tests/f4-lista-wydarzen.spec.ts`.

- [ ] e2e `[F4] HTML strony wydarzenia ma og:title i og:description`, `[F4] filtry kiedy i forma zawężają listę @uczestnik`.
- [ ] Implementacja, testy, commit `feat: link previews and date/format filters`.

### Task 7: Akcje grupowe i eksport XLSX (F28)

**Pliki:** `registrants-list.tsx` (zaznaczanie, pasek akcji), `packages/db/src/queries/check-in.ts` (`setCheckedInMany`), `event-registrations.ts` (`removeRegistrants`), `event-message.ts` (odbiorcy po id), `packages/api/src/admin/registrants.ts`, eksport XLSX w `@repo/ui/registrants-xlsx.ts`, messages. Testy: Vitest dla nowych zapytań, `e2e/tests/f28-akcje-grupowe.spec.ts`.

- [ ] e2e: zaznaczenie dwóch osób i „Odhacz obecność” zmienia obie; „Wiadomość do zaznaczonych” trafia tylko do nich; „Usuń zaznaczonych” awansuje listę rezerwową; XLSX ma nagłówki i wiersze.
- [ ] Vitest: `removeRegistrants` z jednym nieistniejącym id usuwa resztę i zwraca liczbę.
- [ ] Implementacja, testy, commit `feat(admin): bulk actions and XLSX export`.

### Task 8: Pomocnik od wejścia (F29)

**Pliki:** `event_organizers.role` (migracja), `event-organizers.ts`, `packages/api/src/auth/event-access.ts` (`assertCanCheckIn`), check-in i lista obecności przechodzą na `assertCanCheckIn`, karta organizatorów (wybór roli), widok wydarzenia dla pomocnika, messages. Testy: `packages/api/test/event-access.test.ts`, `e2e/tests/f29-pomocnik.spec.ts`.

- [ ] e2e: pomocnik dodany po e-mailu widzi „Skanuj bilety” i obecność, nie widzi „Edytuj wydarzenie”, „Usuń” ani „Wyślij wiadomość”.
- [ ] Vitest: pomocnik — `assertCanCheckIn` przechodzi, `assertCanManageEvent` daje `FORBIDDEN`.
- [ ] Implementacja, testy, commit `feat(admin): check-in helpers`.

### Task 9: Dokumentacja, porównanie z Indico i weryfikacja

- [ ] Spec: statusy F4, F9, F13, F28, F29; `docs/indico-comparison.md` zaktualizowane (z dowodami); `docs/architecture.md` i `docs/data-flows.md` (nowe zadania, role).
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm e2e:up && pnpm e2e`, przegląd całości świeżym recenzentem, podsumowanie weryfikacji w tym planie.
