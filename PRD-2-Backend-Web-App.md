# PRD 2 — Backend (Supabase + Web Admin UI)

**Project type.** Static web app (HTML / JS / CSS). Hosted on Vercel, Netlify, or Supabase's own static hosting.

**Purpose.** Receive sensor data directly from the Apple Watch app, store it in Supabase, and provide a lightweight admin interface for inspecting and downloading sessions for analysis.

**Supabase.** Existing account — add a new project/database for ChoresLog. No new account needed.

---

## Data model

### `sessions` table (Postgres via Supabase)

| Column             | Type      | Notes |
|--------------------|-----------|-------|
| id                 | uuid (pk) | auto-generated |
| user_id            | text      | device identifier |
| chore_label        | text      | Mop / Vacuum / Cook |
| start_time         | timestamptz | |
| end_time           | timestamptz | |
| sample_rate        | integer   | always 50 for now |
| sample_count       | integer   | derived from motion_samples length |
| notes              | text      | optional free-text from Watch |
| motion_samples     | jsonb     | array of {t, ax, ay, az, gx, gy, gz, mx, my, mz} |
| altitude_samples   | jsonb     | array of {t, relative_altitude} |
| floor_summary      | jsonb     | {floors_ascended, floors_descended} |
| created_at         | timestamptz | default now() |

**Indexes:** `chore_label`, `user_id`, `start_time` — added from day one.

Raw sensor streams stored as jsonb columns. Fine for this experiment volume. Revisit if sessions get very long (10+ minutes at 50 Hz = 30k rows).

---

## Auth

Single hardcoded Supabase anon key shared between Watch app and admin UI for now. The Watch posts using the REST API with this key. Replace with proper Supabase Auth in v2.

---

## API

No custom API needed. The Watch writes directly to Supabase via the Supabase REST API (PostgREST). Row-level security disabled for now — it's a private experiment.

---

## Web Admin UI

This is the only thing to build on the backend side. A simple static web app.

### Sessions list page (default view)

- Table: date/time, user, chore, duration, floor summary, sample count, notes
- Filter by: chore label, user
- Sort by: date (default newest first)
- Each row links to the session detail page

### Session detail page

- Session metadata at top (chore, user, duration, floors up/down, notes)
- **Chart 1:** Accelerometer magnitude over time ( √(ax²+ay²+az²) )
- **Chart 2:** Relative altitude over time (shows floor traversal visually)
- **Download CSV** button — exports motion_samples as flat CSV for analysis
- **Copy JSON** button — raw payload for feeding directly to an LLM

---

## Out of scope (v1)

- User management / login
- Analytics or classification
- Dashboards or aggregations
- Multi-tenant
- Anything beyond raw-data inspection and download
