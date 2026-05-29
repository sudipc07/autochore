# ChoresLog watchOS App — Design Spec

**Date:** 2026-05-29
**Status:** Approved for planning
**Type:** Throwaway experiment — clean sensor data collection, no polish required.

---

## Purpose

Capture Apple Watch sensor data while a janitor performs a chore, label it by chore type, and push it directly to Supabase. Goal is clean labelled motion data for pattern analysis (and eventually training a model for a custom janitorial band device). This watch app is a direct proxy for the future custom hardware.

---

## Architecture

Standalone **watchOS app** (no iPhone companion). SwiftUI + `CoreMotion`. On stop, serialize the session to JSON and POST directly to the Supabase REST API. On network failure, persist to local disk and retry on next launch.

```
[Watch sensors] → [SensorRecorder] → [Session JSON] → POST → [Supabase /rest/v1/sessions]
                                            │ (on failure)
                                            ▼
                                      [local disk] → retry queue flushed on next launch
```

---

## Supabase

- **Project URL:** `https://jehrccwdwrjybzzksgmr.supabase.co`
- **Publishable key:** `sb_publishable_i-TxVkO-__zmoCLyAEwDcA_DqSeeezA` (client-embeddable; not a secret)
- **RLS:** OFF for the experiment. Table reachable via Data API with the publishable key.
- **Auth headers on POST:** `apikey: <publishable key>` and `Authorization: Bearer <publishable key>`
- **Note:** Do not commit the key to a public repo. Turn on RLS + Supabase Auth when this graduates to the real product (v2).

### `chores` table (shared chore list, created via Supabase SQL Editor)

| Column     | Type        | Notes |
|------------|-------------|-------|
| id         | uuid (pk)   | default gen_random_uuid() |
| label      | text unique | chore name (e.g. "Mop") |
| sort_order | integer     | display order, presets first |
| created_at | timestamptz | default now() |

Seeded presets: Mop, Vacuum, Sweep, Dust, Clean Toilets, Wipe Windows, Wipe Surfaces, Empty Trash, Mop Stairs, Cook.

The Watch fetches this list on launch (`GET /rest/v1/chores?order=sort_order`) and caches it locally for offline use. Adding a custom chore POSTs a new row; it then appears on all Watches on their next fetch.

### `sessions` table (created via Supabase SQL Editor)

| Column           | Type        | Notes |
|------------------|-------------|-------|
| id               | uuid (pk)   | default gen_random_uuid() |
| user_id          | text        | character name chosen on first launch |
| chore_label      | text        | Mop / Vacuum / Cook |
| start_time       | timestamptz | |
| end_time         | timestamptz | |
| sample_rate      | integer     | 50 |
| sample_count     | integer     | length of motion_samples |
| notes            | text        | optional free text |
| motion_samples   | jsonb       | [{t, ax, ay, az, gx, gy, gz, mx, my, mz}] |
| altitude_samples | jsonb       | [{t, relative_altitude}] |
| floor_summary    | jsonb       | {floors_ascended, floors_descended} |
| created_at       | timestamptz | default now() |

Indexes on `chore_label`, `user_id`, `start_time`.

---

## Screens / Flow

1. **Name picker** (first launch only) — "Who are you?" with 4 random character names as large tappable buttons + a shuffle option. Selection saved to `UserDefaults` and **locked** for the life of the install (one Watch = one identity). Funny/original character names (avoid trademarked Disney names if anything is ever shared publicly).
2. **Home** — scrollable grid of chore tiles loaded from the shared `chores` list (cached locally), plus an **"+ Add"** tile. Character name shown small at top. "+ Add" → dictation/scribble entry → saved to Supabase `chores` table → appears on all Watches.
3. **Countdown** — full-screen 3-2-1.
4. **Recording** — chore name at top, elapsed timer in middle, **tap-and-hold-to-stop** control at bottom (hold avoids accidental taps; easier than slide on a tiny screen).
5. **Stop** → optional one-line notes (dictation/scribble, skippable) → spinner → POST → success/failure feedback → back to Home.

---

## Components (files)

- `ChoresLogApp.swift` — entry point; routes to NamePicker (if no saved name) or Home.
- `Models/Session.swift` — `Codable` session + sample structs (the JSON payload).
- `Sensors/SensorRecorder.swift` — `CoreMotion` wrapper. Starts/stops accel+gyro+mag at 50 Hz via `CMMotionManager`, relative altitude via `CMAltimeter`, floor count via `CMPedometer`. Buffers samples in memory.
- `Network/SupabaseClient.swift` — POSTs session JSON; GETs/POSTs chores; holds URL + publishable key + headers.
- `Storage/SessionStore.swift` — saves failed sessions to disk; reloads + retries pending on launch.
- `Storage/ChoreStore.swift` — fetches shared chore list, caches locally for offline use, posts new custom chores.
- `Views/NamePickerView.swift`
- `Views/HomeView.swift` — chore tile grid + "+ Add" tile.
- `Views/AddChoreView.swift` — dictation/scribble entry for a new chore.
- `Views/CountdownView.swift`
- `Views/RecordingView.swift`

---

## Data captured (while recording)

- Accelerometer, gyroscope, magnetometer (3-axis each) at **50 Hz** via `CMMotionManager`.
- Relative altitude via `CMAltimeter` (native ~1 Hz) — captures floor-to-floor movement.
- Floors ascended/descended via `CMPedometer` — summary computed on stop.
- Each motion sample: `t` (ms offset from start), ax/ay/az, gx/gy/gz, mx/my/mz.

---

## Error handling

- **Sensor unavailable** (e.g. magnetometer absent on a model) → record available sensors, leave missing fields null, never crash.
- **POST fails** (offline/timeout) → save JSON to disk, show "Saved — will retry", flush retry queue on next launch.
- **Motion permission denied** → prompt explaining why, with a path to Settings.
- **Duplicate-submit guard** → mark a local session as uploaded only after a confirmed 2xx response; keep on disk until then.

---

## Out of scope (v1)

- In-app session history view
- Background recording
- On-device analysis or classification
- iPhone companion app
- Deleting or renaming chores (add-only for v1)
- Changeable character name after first pick

---

## Open considerations (noted, not blocking)

- A 10-minute session at 50 Hz ≈ 30k motion samples → large JSON payload. Acceptable for the experiment; revisit storage (e.g. Supabase Storage file per session) only if it becomes unwieldy.
- watchOS may throttle/relaunch the app; keep recording foreground-only (background out of scope).
