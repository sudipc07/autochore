# CHARM Band — Device Requirements

Hardware/firmware requirements for the CHARM Band wearable. Derived from what the prototyping (Apple Watch + CEVA FSM300 board) has validated, plus the product workflow. Priorities use **MoSCoW** (Must / Should / Could).

---

## 1. Purpose

A screen-free, wrist-worn band that **passively** records a worker's motion through a shift so the system can verify what was done — which activities, where, and the route taken — with **zero worker interaction**. Data is uploaded when the band returns to base; analysis is offline (no real-time requirement).

---

## 2. Design principles (non-negotiable)

- **Zero touch.** The worker does nothing during the shift — no buttons, no app, no checkpoints to remember. Any required human action is a failure mode.
- **Passive + continuous.** The band records throughout the shift; intelligence lives offline, not on the device.
- **Graceful by default.** Missed pairing taps or brief gaps must degrade gracefully, never break the record.

---

## 3. Requirements

### 3.1 Sensors
| # | Requirement | Priority |
|---|-------------|----------|
| S1 | **6-axis IMU** — 3-axis accelerometer + 3-axis gyroscope | **Must** |
| S2 | **Magnetometer** (→ 9-axis) for heading/orientation | **Should** |
| S3 | **Barometric altimeter** for floor-change detection | **Should** |
| S4 | **On-board sensor fusion** output (quaternion + Euler roll/pitch/yaw) | **Should** |
| S5 | Accelerometer full-scale **±8 g or wider** | **Must** |
| S6 | Gyroscope full-scale **±1000–2000 °/s** | **Should** |

*Rationale: vigorous mopping/scrubbing nearly saturated a ±2 g range, so ≥±8 g is needed. On-board fusion is what made heading/path reconstruction (PDR) viable in testing — raw gyro alone drifted too fast.*

### 3.2 Sampling integrity
| # | Requirement | Priority |
|---|-------------|----------|
| R1 | Effective sample rate **50–100 Hz** of *genuinely new* samples | **Must** |
| R2 | **Sensor output rate (ODR) must match the log/transmit rate** — no duplicated samples | **Must** |
| R3 | **Fixed, documented configuration** (sample rate + full-scale ranges) for a deployment — do not change mid-fleet | **Must** |
| R4 | Each sample **timestamped** (ms resolution, monotonic per session) | **Must** |
| R5 | Per-axis values in **documented physical units** (g, °/s, µT) or with a published scale factor | **Should** |

*Rationale: a board config that logged ~228 Hz produced ~44% duplicate samples (ODR < transmit rate) — pure waste. Two different full-scale configs under one device also made data non-comparable. Lock the config; publish the units.*

### 3.3 Recording & storage
| # | Requirement | Priority |
|---|-------------|----------|
| D1 | **Continuous recording** for a full shift (target 8–10 h) | **Must** |
| D2 | **Motion-gated capture** — auto-pause logging when stationary to save space/power (automatic, never a worker action) | **Should** |
| D3 | **On-device storage** sufficient for a full offline shift (≈ 50–100 Hz × 8 h; ~tens–hundreds of MB depending on rate/format) | **Must** |
| D4 | No data loss across the shift; retry/persist if upload is interrupted | **Must** |

### 3.4 Power
| # | Requirement | Priority |
|---|-------------|----------|
| P1 | **One charge lasts a full shift** (8–10 h) of continuous sensing | **Must** |
| P2 | **Charge at base** between shifts (dock or contact/Qi charging) | **Must** |
| P3 | Radio **off/idle during the shift** (log locally; transmit only at base) to conserve power | **Should** |

### 3.5 Connectivity & upload
| # | Requirement | Priority |
|---|-------------|----------|
| C1 | **Bulk upload at base** (WiFi, BLE-to-gateway, or wired/dock) | **Must** |
| C2 | No live/cellular link required (batch model) | **Must** |
| C3 | WiFi capability (for future indoor-position anchoring / FTM) | **Could** |

### 3.6 Identity & pairing
| # | Requirement | Priority |
|---|-------------|----------|
| I1 | **RFID/NFC tap to pair** band ↔ worker at shift start | **Must** |
| I2 | Stable unique **device ID** in the data | **Must** |
| I3 | Read nearby RFID/NFC zone tags as location anchors during the shift | **Could** |

### 3.7 Physical & environmental
| # | Requirement | Priority |
|---|-------------|----------|
| E1 | **Wrist-worn**, lightweight, comfortable for a full shift, secure strap | **Must** |
| E2 | **Screen-free** (or minimal status LED only) | **Should** |
| E3 | **Water & chemical resistant** (IP67+), tolerant of cleaning fluids and sweat | **Must** |
| E4 | Drop/shock tolerant; hygienic, wipeable surface | **Should** |
| E5 | Status indicator (LED/haptic) for charging / recording / paired | **Could** |

### 3.8 Time
| # | Requirement | Priority |
|---|-------------|----------|
| T1 | On-board clock (RTC) or time-sync at base so session timestamps are meaningful | **Must** |

---

## 4. Data format (to plug into the existing pipeline)

Each session uploads as metadata + a per-sample stream. Per sample:
`t` (ms since session start), `ax ay az`, `gx gy gz`, `mx my mz`, and (if fusion) `qw qx qy qz` + `roll pitch yaw`. A separate **`gps_samples`** stream carries periodic GPS fixes (`[{t, lat, lon, alt?, speed?, fix?}]`, decimal degrees) for outdoor/transit context. Session metadata: device ID, worker (from RFID pairing), start/end time (UTC), sample rate, sample count, floor summary. *(Matches the documented ingestion API so board/watch/band all share one schema.)*

---

## 5. Out of scope (for the POC device)

- On-device machine learning / classification (analysis is offline).
- Real-time streaming or alerts.
- Display / interactive UI.
- Absolute indoor positioning hardware (UWB/beacons) — handled later via anchors + floor plan.

---

## 6. Open questions

- Final **sample rate** choice (50 vs 100 Hz) — trade-off of fidelity vs storage/battery.
- Charging method (dock vs Qi vs contact) and base-station design.
- White-label vs custom hardware for the first ISS pilot.
- Strap/enclosure for hygiene in healthcare/food environments.
