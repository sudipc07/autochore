# AutoChore — Project Overview

*An experiment to detect cleaning chores from wearable motion data.*

---

## 1. What this is

A throwaway experiment toward a future product: a **custom wearable band for janitorial staff** that automatically logs which chore they're doing (and where in a building — floors up/down) from motion sensors.

Before building hardware, we're collecting **labelled motion data** using devices we already have — Apple Watches and a friend's hardware IMU board — to answer one question:

> **Can we tell chores apart (mop vs vacuum vs dust…) from motion alone?**

Early answer: **yes, promising.** Chores separate clearly by motion rhythm (see Findings).

---

## 2. The pipeline

```
Apple Watch (watchOS app)  ─┐
                            ├──►  Supabase  ──►  Admin dashboard
Hardware IMU board (REST)  ─┘   (DB + Storage)   (autochore.bubbles.work)
```

- **Recording devices** capture accelerometer / gyroscope / magnetometer (+ more) while someone does a labelled chore.
- Each session is pushed to **Supabase** (Postgres for metadata, Storage for the raw sample stream).
- The **admin dashboard** lets us browse, chart, analyse, and download sessions.

---

## 3. Components

### a) watchOS app ("AutoChore")
- Standalone Apple Watch app (SwiftUI), bundle id `com.mobile80.AutoChore`.
- First launch: pick a character name (Phineas & Ferb pool) → becomes the `user_id`, locked to the device.
- Home screen: chore tiles (shared list from Supabase) + "Add" for new chores.
- Record flow: tap chore → 3-2-1 countdown → records sensors → hold-to-stop (auto-stops at 10 min).
- Captures at 50 Hz: user-accel, gravity, gyroscope, orientation (roll/pitch/yaw), quaternion, magnetometer, heading; plus relative altitude and floor counts (stairs).
- Uses a HealthKit **workout session** to keep recording at full rate with the screen off / wrist down.
- Failed uploads are saved locally and retried on next launch.
- Distributed via **TestFlight** (Internal).

### b) Hardware board (friend "L")
- A custom IMU board posts sessions directly to Supabase via REST (no app needed).
- Documented in `docs/HARDWARE_API.md`.
- Assigned device names: **Bender**, **Wall-E**.

### c) Backend — Supabase
- Project URL: `https://jehrccwdwrjybzzksgmr.supabase.co`
- Publishable (client) key is embedded in the app/board; **RLS is off** for the experiment.
- Tables: `chores`, `sessions`, `devices`.
- `raw-sessions` Storage bucket holds the raw sample stream as a file per session (so long sessions of any size upload reliably). The `sessions` row keeps metadata + a `samples_path` pointer.

### d) Admin dashboard
- **URL: https://autochore.bubbles.work**
- Login: shared password (**`delta-chores-2`**) — *internal only; rotate before any wider use.*
- Node/Express app on the EC2 box (`52.6.169.112`, pm2 process `autochore-admin`, port 3003, nginx + TLS).
- Pages:
  - **Sessions list** — filter by chore/user; **"Chore signatures"** comparison table at the top.
  - **Session detail** — per-session motion analysis (plain-English), charts (accel, gravity, gyro, orientation, magnetometer, heading, altitude), Download CSV, Copy JSON.
  - **Devices** — registered device names + session counts.
- The Supabase key stays server-side; the browser only talks to this app, gated by login.

### e) Analysis script
- `analysis/analyze_sessions.py` — pulls sessions, extracts features (stroke rate, intensity, spectrum), prints a table, saves comparison plots.
- Run: `python3 analysis/analyze_sessions.py --user Bender --plot out.png`

---

## 4. Data model

**`sessions`**

| Column | Notes |
|---|---|
| id (uuid) | |
| user_id (text) | device/person label, e.g. Perry, Bender |
| chore_label (text) | Mop, Vacuum, Dust, … |
| start_time / end_time | timestamps |
| sample_rate (int) | reported Hz |
| sample_count (int) | number of motion samples |
| notes (text) | optional |
| motion_samples (jsonb) | inline samples (older rows) OR null when stored as a file |
| altitude_samples (jsonb) | relative altitude stream |
| floor_summary (jsonb) | floors ascended / descended |
| samples_path (text) | file in `raw-sessions` Storage (newer rows) |

**Motion sample fields:** `t` (ms), `ax ay az` (accel), `gravx gravy gravz`, `gx gy gz` (gyro), `roll pitch yaw`, `qw qx qy qz`, `mx my mz` (+ `magacc`), `heading`. *(Hardware boards send the subset they have — typically `t, ax/ay/az, gx/gy/gz`, and optionally mag.)*

**`chores`** — shared chore list (label, sort_order). **`devices`** — name ↔ device_id registry.

---

## 5. Data collected so far (as of 2026-06-06)

| Source | Sessions | Notes |
|---|---|---|
| **Perry** (Apple Watch) | 5 | Cook, Mop, Break, Typing. Mostly throttled rate (see Issues). |
| **Bender** (L's board) | 30 | Vacuum, Mop, Dust. Two distinct hardware configs (see Issues). |
| Phineas / Sprout (test) | 2 | Early 0-sample test rows — junk. |

---

## 6. Findings so far

**Chores separate by motion rhythm.** On the reliable sessions, the dominant "stroke rate" cleanly orders the chores, consistently across devices and config changes:

| Chore | Stroke rate | Character |
|---|---|---|
| **Vacuum** | ~30–41 / min | slowest — long push-pull |
| **Mop** | ~58–64 / min | vigorous mid-tempo strokes |
| **Dust** | ~62–74 / min | fastest — quick bursty wipes |

The analysis uses **device-independent features** (stroke frequency, burstiness) so the watch (g-units) and the board (raw counts) can be compared without calibration.

**Conclusion:** the core hypothesis holds — motion alone distinguishes these chores. This justifies collecting more data and, later, training a proper classifier.

---

## 7. Known issues / data-quality notes

1. **Apple Watch sample rate was throttled** to 5–11 Hz on active chores (the OS suspends backgrounded apps). Fixed via a HealthKit workout session — *but not yet confirmed on a fresh active-chore recording.* One clean 50 Hz watch chore is the key outstanding validation.
2. **L's board sends two different configurations under one name ("Bender"):**
   - *Batch A (May 31):* 100 Hz, no magnetometer.
   - *Batch B (June 6):* ~228 Hz, magnetometer on, different sensor ranges.
   - Treat them as two sources. (Recommend L use a distinct name per physical board.)
3. **L's 228 Hz is really ~128 Hz** — ~44% of samples are exact duplicates (sensor output rate is slower than the transmit loop).
4. **Units not yet calibrated.** The board sends raw integer counts; the watch sends g / rad-s. Absolute magnitudes aren't comparable across devices until L provides the IMU model + full-scale ranges. (Rhythm-based features are unaffected.)
5. **Many tiny 1–3 s "Vacuum" bursts** from L's board (every 10 min) are too short to analyse and are excluded from the signature table (but kept in the raw data).

---

## 8. Open items / next steps

- [ ] Record a **clean 50 Hz active chore on the Apple Watch** (validate the HealthKit fix).
- [ ] Get from L: **IMU model + accel/gyro full-scale ranges**; fix the duplicate/ODR mismatch; use a **distinct device name** per board.
- [ ] Collect **≥10 sessions per chore** for meaningful clustering.
- [ ] Add a **second person** recording the same chores (tests whether one model generalises).
- [ ] Once calibrated + more data: train a simple **chore classifier** and report accuracy.

---

## 9. Quick reference

- **Admin dashboard:** https://autochore.bubbles.work (password: `delta-chores-2`)
- **Supabase:** https://jehrccwdwrjybzzksgmr.supabase.co
- **Code repo:** https://github.com/sudipc07/autochore
- **Hardware API guide:** `docs/HARDWARE_API.md` in the repo
- **Server:** EC2 `52.6.169.112`, pm2 process `autochore-admin` (port 3003), nginx vhost `autochore.bubbles.work`
