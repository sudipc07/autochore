# PRD 1 — watchOS App (ChoresLog)

**Project type.** Xcode project with a watchOS target. SwiftUI for watchOS.

**Purpose.** Capture Apple Watch sensor data while a janitor performs a chore. Label it by chore type, then push it to Supabase. Throwaway experiment — the goal is clean labelled data for pattern analysis, not a polished product.

**Developer account.** Paid Apple Developer account (same as Lumiglow). TestFlight available for distribution.

---

## Sensors captured (while recording)

| Sensor | Data | Notes |
|--------|------|-------|
| Accelerometer | ax, ay, az | 3-axis, continuous |
| Gyroscope | gx, gy, gz | 3-axis, continuous |
| Magnetometer | mx, my, mz | 3-axis, include if straightforward |
| Barometric altimeter | relative altitude (m) | floor-to-floor movement in building |
| Floor count | floors_ascended, floors_descended | via `CMPedometer`, counts stair traversal |

**Sample rate:** 50 Hz for motion sensors. Altimeter sampled at its native rate (~1 Hz) — stored as a separate stream or interpolated into samples.

---

## UX flow

1. **Home screen** — three large chore tiles: **Mop**, **Vacuum**, **Cook**.
2. Tap a tile → full-screen 3-second countdown ("3… 2… 1…").
3. **Recording screen** — chore name at top, elapsed timer in middle, Digital Crown or slide-to-stop at bottom.
4. On stop → spinner → POST session to Supabase → success or failure feedback → back to home.

Keep it minimal. watchOS screen is small — large text, big tap targets.

---

## Data architecture

```
Apple Watch
    │
    └── POST JSON → Supabase REST API
                         │
                         └── sessions table (Postgres)
```

The Watch posts directly to Supabase via its REST API (HTTPS). No phone intermediary needed for data — the Watch uses the paired iPhone's connection when off WiFi, transparently.

---

## Payload sent on stop

POST to Supabase REST endpoint as JSON:

```json
{
  "user_id": "<device constant, e.g. Watch serial or hardcoded name>",
  "chore_label": "Mop" | "Vacuum" | "Cook",
  "start_time": "<ISO 8601 timestamp>",
  "end_time": "<ISO 8601 timestamp>",
  "sample_rate": 50,
  "notes": "<optional free text, e.g. 'mopped 3rd floor quickly'>",
  "motion_samples": [
    {
      "t": <ms offset from start>,
      "ax": ..., "ay": ..., "az": ...,
      "gx": ..., "gy": ..., "gz": ...,
      "mx": ..., "my": ..., "mz": ...
    }
  ],
  "altitude_samples": [
    { "t": <ms offset from start>, "relative_altitude": <metres> }
  ],
  "floor_summary": {
    "floors_ascended": <int>,
    "floors_descended": <int>
  }
}
```

---

## Failure handling

If POST fails (no connection, timeout), save the session locally on the Watch and retry on next app open. No data loss.

---

## Notes field

After stopping, show a one-line optional text entry (watchOS scribble/dictation). Free text: "mopped fast", "vacuumed stairs", "cooking pasta". Annotations will be valuable when analysing patterns. Can be skipped.

---

## Out of scope (v1)

- Editable chore list
- Login screen
- In-app session history view
- On-device analysis or classification
- Background recording
- Any UI beyond home → countdown → record → stop
- Companion iPhone app
