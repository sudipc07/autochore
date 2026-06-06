# AutoChore — Project Overview

> **In one line:** an experiment to find out whether cleaning chores (mop, vacuum, dust…) can be recognised from wearable motion data — as a stepping stone to a custom wearable band for janitorial staff.
>
> **Status:** Pipeline live end-to-end. Early result is positive — chores separate clearly by motion rhythm. Now collecting more data.

---

## Contents
1. Goal & status
2. How it works
3. Data sources (devices)
4. System components
5. Data model
6. Findings so far
7. Data-quality issues & actions
8. Roadmap
9. Access & links

---

## 1. Goal & status

**Goal.** The eventual product is a wrist/band device for janitorial staff that auto-logs which chore is being performed and movement through a building (floors up/down). Before committing to hardware, we collect **labelled motion data** from devices we already have and test the core question:

> **Can chores be told apart from motion alone?**

**Status.** Yes — promising. Across multiple sessions and two different devices, chores order consistently by their motion rhythm. The full data pipeline (capture → store → inspect → analyse) is running.

---

## 2. How it works

```
Apple Watch app  ─┐
                  ├──►  Supabase (database + file storage)  ──►  Web dashboard
IMU sensor board ─┘
```

A device records motion sensors while a person performs a **labelled** chore. Each recording ("session") is uploaded to Supabase. A web dashboard is used to browse, chart, analyse, and export the data.

---

## 3. Data sources (devices)

| Source | Description | Sample rate | Sensors |
|--------|-------------|-------------|---------|
| **Apple Watch** | Standalone watchOS app ("AutoChore") | 50 Hz | accel, gravity, gyro, orientation, magnetometer, altitude, floor count |
| **CEVA FSM300 IMU board** | Custom hardware, posts directly over the API | ~228 Hz reported (≈128 Hz effective — see issues) | accel, gyro, magnetometer |

Each session is tagged with a device/person label (the `user_id`). Watch users pick a character name on first launch; the board sends a fixed label.

> **Note:** the FSM300 board has been run in more than one configuration. Its full-scale ranges and native output rate should be recorded from the datasheet so its raw readings can be converted to physical units (see Issues §7).

---

## 4. System components

**a) watchOS app ("AutoChore")**
Standalone Apple Watch app. Flow: pick a name → choose a chore → 3-2-1 countdown → record → hold-to-stop (auto-stops after 10 minutes). Records all motion channels at 50 Hz and keeps recording with the screen off via a HealthKit workout session. Uploads each session; retries automatically if offline. Distributed to testers via TestFlight.

**b) IMU board integration**
The hardware board posts sessions to the same backend over a simple REST API — no app required. Integration guide is in the code repository (see §9).

**c) Backend — Supabase**
Hosted Postgres + file storage. Holds the chore list, session metadata, and a device registry; the raw sample stream for each session is stored as a file so recordings of any length upload reliably. Access is via a client key embedded in the devices (row-level security is intentionally off for the experiment).

**d) Web dashboard**
Internal site for the team:
- **Sessions list** with filters and a top-level **"Chore signatures"** comparison table.
- **Session detail** — a plain-English motion analysis, charts for every sensor channel, and CSV / JSON export.
- **Devices** — registered device names and their session counts.
The dashboard talks to Supabase server-side (the key never reaches the browser) and is gated by a shared login.

**e) Analysis tooling**
A script in the repository extracts motion features (stroke rate, intensity, frequency spectrum) and produces comparison plots. Re-runnable as data grows.

---

## 5. Data model

**Session** — one recording:
`user_id`, `chore_label`, `start_time`, `end_time`, `sample_rate`, `sample_count`, optional `notes`, `floor_summary` (floors up/down), and the raw motion stream (stored as a file, referenced by `samples_path`).

**Motion sample** — one reading in the stream:
`t` (ms since start), accelerometer `ax/ay/az`, gravity `gravx/gravy/gravz`, gyroscope `gx/gy/gz`, orientation `roll/pitch/yaw`, quaternion `qw/qx/qy/qz`, magnetometer `mx/my/mz`, heading. *Hardware boards send the subset they support (typically accel + gyro, plus magnetometer when enabled).*

**Supporting tables** — a shared **chore list** and a **device registry** (name ↔ device id).

---

## 6. Findings so far

On the reliable sessions, the dominant **stroke rate** (how often the motion repeats) orders the chores consistently — across both devices and configuration changes:

| Chore | Stroke rate | Motion character |
|-------|-------------|------------------|
| **Vacuum** | ~30–41 / min | slowest — long, smooth push-pull |
| **Mop** | ~58–64 / min | vigorous mid-tempo strokes |
| **Dust** | ~62–74 / min | fastest — quick, bursty wipes |

The analysis uses **device-independent features** (rhythm and burstiness, which don't depend on units), so the Watch and the board can be compared directly without calibration.

**Takeaway:** the core hypothesis holds — motion alone distinguishes these chores. This justifies collecting more data and, later, training a classifier.

---

## 7. Data-quality issues & actions

| # | Issue | Action |
|---|-------|--------|
| 1 | **Apple Watch throttled** to 5–11 Hz on active chores (OS suspends background apps). Fixed via a HealthKit workout session, but **not yet re-validated** on a fresh active chore. | Record one clean 50 Hz active chore on the Watch. |
| 2 | **The FSM300 board has run in two configurations** under one label — an earlier 100 Hz / no-magnetometer setup and a later ~228 Hz / magnetometer-on setup. They behave like two different sources. | Use a **distinct device name per physical board / config**; register devices. |
| 3 | **Reported 228 Hz is really ~128 Hz** — about 44% of samples are exact duplicates (the sensor's output rate is slower than the board's transmit loop). | Raise the FSM300 output data rate to match, or lower the transmit rate. |
| 4 | **Units not calibrated.** The board sends raw counts; the Watch sends g / rad-s. Absolute magnitudes aren't comparable across devices yet. | Record the FSM300 model + accelerometer & gyroscope full-scale ranges; add a conversion step. |
| 5 | **Many 1–3 second burst sessions** from the board are too short to analyse. | Already excluded from analysis; kept in raw data. |

---

## 8. Roadmap

- [ ] Validate the Apple Watch at a clean 50 Hz on an active chore.
- [ ] Lock the FSM300 configuration; capture its datasheet specs; fix the duplicate-sample rate.
- [ ] Collect **≥10 sessions per chore**.
- [ ] Add a **second person** recording the same chores (tests whether one model generalises).
- [ ] Train a simple **chore classifier** and report accuracy.

---

## 9. Access & links

| | |
|---|---|
| **Web dashboard** | https://autochore.bubbles.work *(team login required)* |
| **Code repository** | https://github.com/sudipc07/autochore |
| **Hardware API guide** | https://github.com/sudipc07/autochore/blob/main/docs/HARDWARE_API.md |
| **Backend** | Supabase (hosted) |

*Credentials (dashboard login, API keys) are shared separately, not in this page.*
