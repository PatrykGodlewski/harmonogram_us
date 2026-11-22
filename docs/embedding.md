# Public API and embeddable widget (F24)

Read when another site (a faculty page, a portal, a digital sign) should show this installation's events. Both read only events that are published, open to everyone (not signed-in-only or invite-only), not cancelled and not over. Nothing needs a key: the data is already public on the site.

## JSON API

`GET /api/v1/events`

| Parameter | Values | Default |
| --- | --- | --- |
| `limit` | 1–50 | 20 |
| `faculty` | faculty slug: the value the site's faculty filter puts in `?facultyFilter=` | all |
| `type` | event type slug (`?eventTypeFilter=`) | all |
| `lang` | `pl`, `en`: the language of the `url` links | base locale |

Bad values answer `400` with `{ "error": [...] }`. Responses carry `access-control-allow-origin: *` (any site's JavaScript may read them) and `cache-control: public, max-age=60`.

```json
{
  "events": [
    {
      "id": "…",
      "title": "Seminarium fizyki",
      "startsAt": "2026-12-01T09:00:00.000Z",
      "endsAt": "2026-12-01T11:00:00.000Z",
      "place": "Aula · B105",
      "attendanceMode": "onsite",
      "faculty": { "slug": "wydzial-fizyki", "label": "Wydział Fizyki" },
      "type": { "slug": "seminarium", "label": "Seminarium" },
      "seatsRemaining": 12,
      "url": "https://events.example.edu/pl/events/…"
    }
  ]
}
```

Events are ordered by start time. `endsAt` is the end given by the organiser, else the end of the last agenda item, else one day after the start. `attendanceMode` is `onsite`, `online` or `hybrid`. The path is versioned: fields are only added within `v1`.

## Widget

An `<iframe>` with the next events as a list. Each title opens the event on this site in a new tab, and an "All events" link sits under the list. The host page runs none of this site's code.

```html
<iframe
  title="Najbliższe wydarzenia"
  src="https://events.example.edu/pl/widget?limit=3&faculty=wydzial-fizyki"
  width="100%" height="360" style="border:0"
></iframe>
```

Use `/en/widget` for English. Parameters: `limit` 1–10 (default 5), `faculty`, `type` (the same slugs as the API). Malformed values fall back to the defaults. The host sets the height: about 360 px fits three events on a phone.
