# CHARM Band — AutoChore

**CHARM Band** (Continuous Human Activity Recognition Module) is a screen-free, wrist-worn wearable for janitorial / facilities staff. It passively records wrist motion through a shift so the system can verify what was done — which activities, where, and the route taken — with **zero worker interaction** (no buttons, no app, no checkpoints). Data is uploaded when the band returns to base; analysis is offline.

This repo holds the experiment that proves activities are separable from IMU motion, plus the supporting apps and tooling.

## Repository layout

| Path | What it is |
|------|------------|
| `AutoChore/` | watchOS data-collection app (SwiftUI + CoreMotion). Records accel/gyro/magnetometer at 50 Hz plus altitude/floors, labels the activity, and uploads each session to Supabase. |
| `admin/` | Node/Express admin at **autochore.bubbles.work** — see below. |
| `analysis/` | Pedestrian dead-reckoning (PDR) + feature-extraction scripts. |
| `db/` | Supabase SQL (`sessions`, `chores`, `devices`, storage, `costing_projects`). |
| `docs/` | Device requirements, data map, hardware API, dashboard brief, and the [Costing quick start](docs/COSTING_QUICKSTART.md). |
| `exports/` | Labelled IMU dataset dump for modelling. |

## The admin app (`admin/`)

A small Express app (port 3003) that serves three things behind a shared password:

- **Session inspector** — browse uploaded sessions with per-axis charts, a reconstructed movement path (PDR), chore-signature summaries, and the ability to archive bad data.
- **Costing & Quoting module** (`/costing/`) — multi-project, volume-tiered hardware pricing. Internal (spreadsheet) + Presenter (screen-share) + Compare views, with **Options** (BOM diffs like "add BLE"), **Variants** (saved option combos), and **Scenarios** (pricing snapshots). See the [quick start](docs/COSTING_QUICKSTART.md).
- **Exec dashboard** (`/dashboard/`) — static, pitch-ready facilities dashboard.

Auth is a single shared password (`ADMIN_PASSWORD`); an optional `VIEWER_PASSWORD` adds a read-only role (can present/toggle, can't edit/save).

### Run locally
```bash
cd admin
cp .env.example .env        # set SUPABASE_URL/KEY, ADMIN_PASSWORD, SESSION_SECRET
npm install
npm start                   # http://localhost:3003
```

### Deploy
The admin runs on an EC2 host as a pm2 process (`autochore-admin`) behind nginx. It is **not** auto-deployed from GitHub — deploy by rsyncing the `admin/` files to the host (excluding `node_modules` and `.env`) and running `pm2 restart autochore-admin`. There is no build step; new dependencies require `npm install` on the host. (Host, key, and credentials are kept in internal notes.)

## Backend

Supabase (Postgres + PostgREST + Storage, bucket `raw-sessions`). The watch app writes directly with the publishable key; the admin reads/writes server-side. RLS is currently off. Table SQL lives in `db/`.

## Data

`exports/dataset/` contains a labelled IMU dump (~204k samples across mop / vacuum / dust / walk, two devices). **Note:** units are not uniformly calibrated across devices and sample rates vary — see `exports/dataset/README.md` before modelling.
