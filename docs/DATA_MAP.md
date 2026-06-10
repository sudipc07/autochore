# AutoChore / CHARM Band — Data Map

A reference map of all collected IMU data: where it comes from, the schema, every field, and the full session inventory. Companion to the dataset dump (`exports/charm_imu_dataset.zip`).

> **Snapshot:** 43 sessions total — **17 active**, 26 archived (bad/superseded). 137,233 samples in the active set.

---

## 1. Sources

| Device | `user_id`(s) | Rate(s) | Sensors captured |
|--------|--------------|---------|------------------|
| **Apple Watch** (watchOS app) | character names (Perry, Phineas, Sprout…) | 50 Hz | accel, gravity, gyro, orientation (roll/pitch/yaw + quaternion), magnetometer, heading, altitude, floor count |
| **CEVA FSM300 board** | Bender (Wall-E reserved) | 100 Hz, ~228 Hz | accel, gyro, magnetometer; later firmware adds fusion (quaternion + roll/pitch/yaw) |

---

## 2. Storage model

- **`sessions`** table (Postgres): one row per recording — metadata + (for older rows) inline samples.
- **Storage bucket `raw-sessions`**: newer sessions store the sample stream as a JSON file; the row holds `samples_path` pointing to it.
- **`chores`** table: shared activity label list. **`devices`** table: name ↔ device-id registry.

### Session row fields
| Field | Meaning |
|-------|---------|
| `id` | uuid |
| `user_id` | device/person label |
| `chore_label` | activity label (Mop, Vacuum, Dust, Walk/movement, …) |
| `start_time` / `end_time` | timestamps (UTC) |
| `sample_rate` | reported Hz |
| `sample_count` | number of motion samples |
| `notes` | optional free text |
| `floor_summary` | `{floors_ascended, floors_descended}` |
| `motion_samples` | inline sample array (older rows) or null |
| `altitude_samples` | `[{t, relative_altitude}]` |
| `samples_path` | file in `raw-sessions` (newer rows) |
| `archived` | bad/superseded flag — filter `false` for clean data |

---

## 3. Motion sample dictionary

Each sample is one reading. **Units differ by device — see §5.**

| Field | Meaning | Watch | Board |
|-------|---------|:-----:|:-----:|
| `t` | ms since session start | ✅ | ✅ |
| `ax ay az` | accelerometer (Watch: gravity-removed) | ✅ | ✅ |
| `gx gy gz` | gyroscope | ✅ | ✅ |
| `mx my mz` | magnetometer | ✅ | ✅ (when enabled) |
| `gravx gravy gravz` | gravity vector | ✅ | — |
| `roll pitch yaw` | orientation (Euler, fusion) | ✅ | ✅ (later fw) |
| `qw qx qy qz` | orientation quaternion (fusion) | ✅ | ✅ (later fw) |
| `heading` | compass degrees | ✅ | — |

---

## 4. Label distribution

**Active sessions** — by label: Break (1) · Cook (2) · Dust (3) · Mop (5) · Typing (1) · Vacuum (3) · movement (1) · patrol (1)
**Active sessions** — by user: Bender (11) · Perry (6)

> Walking appears as both `Walk` (Watch) and `movement` (board) — same class.

---

## 5. Quirks & caveats (read before modelling)

1. **Units not consistent.** Watch = g / rad-s (gravity split into `gravx/y/z`). Board (Bender) = **raw integer counts**, and the full-scale ranges changed between batches — magnitudes are device-relative. Prefer **scale-invariant** features (rhythm, ratios) or **per-session normalisation**.
2. **Mixed sample rates** (50 / 100 / 228 Hz). Resample per session.
3. **Archived = bad.** The ~228 Hz board batch had ~44% **duplicate** samples (sensor ODR < transmit rate); plus tiny test bursts and 0-sample rows. All flagged `archived = true`. **Use `archived = false`.**
4. **FSM300 ran in ≥3 configs** under one name (Bender): 100 Hz no-mag → 228 Hz dup'd → 100 Hz clean + fusion. The active 100 Hz Bender data is the trustworthy board set.
5. **Validation:** use **leave-one-session-out** / **leave-one-user-out** so models generalise rather than memorise.

---

## 6. Full session inventory

| id | user | label | Hz | samples | fusion | mag | status |
|----|------|-------|----|---------|:------:|:---:|--------|
| d7cafde5 | Bender | Dust | 100 | 5,586 | — | — | active |
| 11be9271 | Bender | Dust | 100 | 1,867 | — | — | active |
| 7fcc60f3 | Bender | Dust | 100 | 9,260 | — | yes | active |
| a39c8e71 | Bender | Dust | 228 | 21,137 | — | yes | **archived** |
| fb64d630 | Bender | Mop | 103 | 217 | — | — | active |
| 3f12b774 | Bender | Mop | 100 | 2,406 | — | — | active |
| 19e66f58 | Bender | Mop | 100 | 3,787 | — | yes | active |
| a3ba45d5 | Bender | Mop | 227 | 8,627 | — | yes | **archived** |
| bb7c3f6b | Bender | Mop | 228 | 9,874 | — | yes | **archived** |
| a8c9dd09 | Bender | Mop | 100 | 4,314 | — | yes | active |
| a30a0aea | Bender | Vacuum | 100 | 5,004 | — | — | active |
| fdc7d943 | Bender | Vacuum | 100 | 2,777 | — | — | active |
| d05fe972 | Bender | Vacuum | 228 | 21,622 | — | yes | **archived** |
| 7f5fb144 | Bender | Vacuum | 100 | 9,469 | — | yes | active |
| 9edbe273 | Bender | Vacuum | 225 | 441 | — | yes | **archived** |
| 5a1fc8e1 | Bender | Vacuum | 227 | 1,177 | — | yes | **archived** |
| f0828e9f | Bender | Vacuum | 227 | 601 | — | yes | **archived** |
| 4bf9a8cd | Bender | Vacuum | 227 | 555 | — | yes | **archived** |
| 473acac0 | Bender | Vacuum | 234 | 139 | — | yes | **archived** |
| e8ced08f | Bender | Vacuum | 226 | 400 | — | yes | **archived** |
| 7c9af988 | Bender | Vacuum | 221 | 131 | — | yes | **archived** |
| 6bbc6022 | Bender | Vacuum | 222 | 284 | — | yes | **archived** |
| dc6dc1b9 | Bender | Vacuum | 223 | 155 | — | yes | **archived** |
| a822e79e | Bender | Vacuum | 226 | 179 | — | yes | **archived** |
| 57a91600 | Bender | Vacuum | 229 | 249 | — | yes | **archived** |
| a75878ac | Bender | Vacuum | 221 | 45 | — | yes | **archived** |
| ce4a4803 | Bender | Vacuum | 228 | 314 | — | yes | **archived** |
| 19574d27 | Bender | Vacuum | 225 | 118 | — | yes | **archived** |
| b60b5277 | Bender | Vacuum | 230 | 362 | — | yes | **archived** |
| 7f58287f | Bender | Vacuum | 227 | 135 | — | yes | **archived** |
| d9614f3c | Bender | Vacuum | 221 | 45 | — | yes | **archived** |
| dc84b21f | Bender | Vacuum | 225 | 46 | — | yes | **archived** |
| b2c94a52 | Bender | Vacuum | 226 | 206 | — | yes | **archived** |
| dfa9eb48 | Bender | Vacuum | 225 | 310 | — | yes | **archived** |
| 54e9e845 | Bender | movement | 100 | 8,728 | yes | yes | active |
| d05e3a98 | Perry | Break | 50 | 2,750 | — | yes | active |
| 038c9736 | Perry | Cook | 50 | 22,947 | — | — | active |
| 753a1762 | Perry | Cook | 50 | 10,266 | — | — | active |
| f949c304 | Perry | Mop | 50 | 8,737 | — | yes | active |
| 34d671f0 | Perry | Typing | 50 | 9,019 | — | yes | active |
| d1c9e468 | Perry | patrol | 50 | 30,099 | yes | yes | active |
| 1070cfc8 | Phineas | Mop | 50 | 0 | — | — | **archived** |
| 4d902f13 | Sprout | Mop | 50 | 0 | — | — | **archived** |

---

## 7. Where to get it

- **Dump:** `exports/charm_imu_dataset.zip` — `all_samples.csv` (tidy, labelled), `manifest.csv`, `sessions/*.json`, `README.md`.
- **Live:** Supabase REST (`/rest/v1/sessions`) + `raw-sessions` storage bucket. Dashboard: https://autochore.bubbles.work
