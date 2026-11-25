# Event image with a random default (F22, image part) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline). Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Every event has an image: a randomly chosen app-made illustration by default (kept), or the organiser's upload; shown as the event page's banner and on list cards.

**Spec:** F22 „Logo, obraz nagłówka, własne podstrony” (this plan: the header image). User (23.11): "each event have to have a image by default there should be randomly selected image that serve a placeholder image"; chose app-made illustrations.

## Decisions

- `events.image_placeholder` text NOT NULL, CHECK `p01`…`p12`, DEFAULT a random one (`'p' || lpad((floor(random() * 12) + 1)::int::text, 2, '0')`), so every new event — and every existing one, by the migration — gets one, kept until changed.
- Upload: `events.image_key` (storage key, null = placeholder) and `events.image_alt` (≤ 200, required with an upload). PNG, JPEG or WebP, at most 5 MB (no SVG: images are shown inline). Key `events/{id}/image-{uuid}`; the replaced or removed object goes to `stored_file_deletions` (the worker deletes it).
- `/api/events/{id}/image` (web: event page rules, `canViewEvent`; admin: managers) answers 302 to a 60-second signed GET with `inline` disposition; 404 without an upload. Cards and banner use it.
- Placeholders: one `EventPlaceholder` component drawing 12 presets (two-colour gradient + shapes) as inline SVG, `aria-hidden`; uploaded images have the organiser's alt text.
- Panel: an „Obraz wydarzenia” card (preview; „Wgraj obraz” with alt text; „Usuń obraz” back to the illustration; „Inna ilustracja” draws another at random). Duplicating copies the illustration, not an upload.
- Public: banner on the event page (aspect 3:1), thumbnail on list cards (16:9). Widget unchanged.

## Tasks

### Task 1: Database
- [ ] Tests (`packages/db/test/event-image.test.ts`): a new event has a placeholder in p01–p12; `setEventImage` stores key and alt and returns the previous key; replacing/clearing records the old key for deletion; `shuffleEventPlaceholder` sets another valid one; duplicate copies the placeholder only. Fail, implement (migration via `db:generate` + custom default), pass.

### Task 2: Server
- [ ] Tests (`packages/api/test/event-image.test.ts`): upload refuses other types and > 5 MB before storing; the image response is 404 without an upload and for events the visitor may not open, 302 inline otherwise. Fail, implement (`storeEventImage`, server functions with `assertCanManageEvent`, routes in web and admin), pass.

### Task 3: Pages
- [ ] e2e first: `[F22] nowe wydarzenie ma ilustrację, a organizator wgrywa własny obraz @organizator` (placeholder on page and card; upload with alt → `img` with that alt on page and card; remove → placeholder again). Fail, implement, pass; pl/en; docs; full checks; review; push.
