# Sala jako tekst, edycja na stronie wydarzenia, jaśniejsza publikacja: plan implementacji

> **Dla wykonawcy:** `superpowers:executing-plans` (inline). Kroki mają składnię checkboxów (`- [ ]`).

**Cel:** organizator wpisuje salę („B105”), publikuje wydarzenie bez zgadywania, czego brakuje, i edytuje je ze strony wydarzenia.

**Architektura:** kolumna `events.room` (tekst, opcjonalna) przechodzi przez `createEvent`/`updateEvent`/`duplicateEvent`, schematy API i formularz. Warunek publikacji (`isComplete` w `queries/events.ts`) traktuje salę jak miejsce i jest wystawiony jako `missingForPublish(event)`, którego używa też UI. Formularz wydarzenia z `admin-events-page.tsx` przechodzi do `components/event-form-dialog.tsx` i jest używany na liście i w karcie wydarzenia.

**Stos:** Drizzle, TanStack Start/Form/Query, Paraglide, Playwright, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-20-sala-edycja-publikacja-design.md` (F3).

## Ograniczenia globalne

- `[F3]` w nazwach testów e2e, test najpierw. Teksty w `pl.json` i `en.json`. Migracja przez `pnpm db:generate`. Sala: maks. 100 znaków, przycięta, pusta = `null`.
- Po zielonych testach: przegląd i uproszczenie (AGENTS.md), potem ponowne testy.

## Na co uważać przy przeglądzie

1. Sala z samych spacji nie liczy się jako miejsce przy publikacji. Vitest w Task 1.
2. Duplikat kopiuje salę. Vitest w Task 1.
3. Wydarzenie online nie potrzebuje sali; hybrydowe potrzebuje (miejsca albo sali) i linku. Vitest w Task 1.

---

### Task 1: Sala jako tekst i warunek publikacji

**Pliki:** `packages/db/src/schema/events.ts`, migracja `0018_event_room.sql`, `packages/db/src/queries/events.ts`, `packages/db/src/queries/event-duplicate.ts`, `packages/api/src/events/schemas.ts`, formularz w `apps/admin/src/components/admin-events-page.tsx`, `apps/web/src/components/event-details/event-summary.tsx`, `home-event-card.tsx`, messages. Testy: `packages/db/test/event-status.test.ts`, `event-duplicate.test.ts`, `e2e/tests/f3-szkic-i-publikacja.spec.ts`.

**Interfejsy:**
- `events.room text` (null), `EventWithRelations.room: string | null`, `CreateEventInput/UpdateEventInput.room?: string | null`.
- `missingForPublish(event: { attendanceMode; locationId; room; onlineUrl }): ("place" | "link")[]` w `queries/events.ts`; `publishEvent` rzuca `EVENT_INCOMPLETE`, gdy lista nie jest pusta.

- [x] Vitest (najpierw): sala `"B105"` bez miejsca pozwala opublikować wydarzenie na miejscu; sala `"   "` nie; online bez sali i z linkiem przechodzi; hybrydowe z salą bez linku zwraca `["link"]`; duplikat ma `room: "B105"`. Patrz, jak pada.
- [x] e2e (najpierw) `[F3] sala wpisana ręcznie wystarcza do publikacji @organizator`: organizator tworzy wydarzenie na miejscu z salą „B105”, publikuje; strona publiczna pokazuje „sala B105”.
- [x] Implementacja, testy zielone, commit `feat: free-text room for events`.

### Task 2: Jaśniejsza publikacja

**Pliki:** `apps/admin/src/components/admin-event-detail/event-summary-card.tsx`, messages. Test: `e2e/tests/f3-szkic-i-publikacja.spec.ts` (istniejący test zmienia oczekiwanie).

- [x] e2e (najpierw): przy szkicu online bez linku karta pokazuje „Aby opublikować, dodaj link online.”, a „Opublikuj” jest nieaktywny; po dodaniu linku przycisk działa.
- [x] Implementacja: karta liczy `missingForPublish` z danych wydarzenia (funkcja z Task 1, importowana jako czysty helper bez dostępu do bazy — przenieś ją do `packages/db/src/queries/event-completeness.ts`, żeby UI nie importował klienta bazy).
- [x] Testy zielone, commit `feat(admin): say what's missing before publishing`.

### Task 3: Edycja ze strony wydarzenia

**Pliki:** utwórz `apps/admin/src/components/event-form-dialog.tsx` (formularz z `admin-events-page.tsx`), zmodyfikuj `admin-events-page.tsx`, `event-summary-card.tsx`. Test: `e2e/tests/f3-edycja.spec.ts`.

**Interfejsy:** `EventFormDialog({ open, onOpenChange, event: EventWithRelations | null, onSaved: () => Promise<unknown> })`.

- [x] e2e (najpierw) `[F3] organizator edytuje wydarzenie ze strony wydarzenia @organizator`: „Edytuj” w karcie, zmiana tytułu i sali, zapis; nagłówek i sala w karcie się zmieniają.
- [x] Implementacja, pełne e2e, commit `feat(admin): edit an event from its page`.

## Verification summary

- Verified 2026-11-20 on `next`. Scope: all three parts of the design (room, publish hint, edit from the event page).
- Evidence: `e2e/tests/f3-szkic-i-publikacja.spec.ts` ("[F3] sala wpisana ręcznie wystarcza do publikacji", draft test now checks the hint and the disabled button), `e2e/tests/f3-edycja.spec.ts`; Vitest `packages/db/test/event-status.test.ts` (room counts as place, blank doesn't, missing list per format), `event-duplicate.test.ts` (room copied).
- Final checks: `pnpm typecheck`, `pnpm lint`, `pnpm test` green; `pnpm e2e` 73/73.
- Decisions: what's missing is computed on the server (`missingForPublish` in `@repo/db/queries/event-completeness`, returned with the admin event details as `missingForPublish`) because `apps/admin` doesn't depend on `@repo/db`; the event form moved to `apps/admin/src/components/event-form-dialog.tsx` and resets with one `form.reset(values)`.
- Review: self-review (small change).
- Status: complete.
