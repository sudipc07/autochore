# AutoChore — Hardware Board API

How to push IMU sessions from a custom hardware board (Arduino / ESP32 / Raspberry Pi / etc.) into the same Supabase database the Apple Watch app uses.

No SDK needed — it's plain HTTPS POST to the Supabase REST API (PostgREST).

---

## Credentials

```
Base URL:  https://jehrccwdwrjybzzksgmr.supabase.co
API key:   sb_publishable_i-TxVkO-__zmoCLyAEwDcA_DqSeeezA
```

This is a **publishable** key — safe to embed in a device. Row-Level Security is off for this experiment, so the key grants read/write. Don't post it in a public repo.

### Required headers (on every request)

```
apikey: sb_publishable_i-TxVkO-__zmoCLyAEwDcA_DqSeeezA
Authorization: Bearer sb_publishable_i-TxVkO-__zmoCLyAEwDcA_DqSeeezA
Content-Type: application/json
```

---

## Your device names

You've been assigned **two** identities. Use these as `user_id` so your data is distinguishable from the watches:

- **`Bender`**
- **`Wall-E`**

(Use one per board. If you only have one board, just use `Bender`.)

### Optional: register your boards in the devices table

Lets them show up in the admin "Devices" view. Upserts on `device_id`, so re-running is safe.

```bash
curl -X POST "https://jehrccwdwrjybzzksgmr.supabase.co/rest/v1/devices?on_conflict=device_id" \
  -H "apikey: sb_publishable_i-TxVkO-__zmoCLyAEwDcA_DqSeeezA" \
  -H "Authorization: Bearer sb_publishable_i-TxVkO-__zmoCLyAEwDcA_DqSeeezA" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates,return=minimal" \
  -d '{"device_id":"esp32-board-01","name":"Bender"}'
```

`device_id` = any stable string unique to your board (MAC address, serial, etc.). `name` must be `Bender` or `Wall-E` (the `name` column is unique).

---

## Posting a session

One **POST per recording session** to `/rest/v1/sessions`. The whole IMU stream goes in `motion_samples` as a JSON array.

### Endpoint

```
POST https://jehrccwdwrjybzzksgmr.supabase.co/rest/v1/sessions
```

### Body schema

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `user_id` | string | ✅ | `"Bender"` or `"Wall-E"` |
| `chore_label` | string | ✅ | e.g. `"Mop"`, `"Vacuum"`, `"Cook"` — any label |
| `start_time` | string (ISO 8601 UTC) | ✅ | e.g. `"2026-05-30T10:00:00.000Z"` |
| `end_time` | string (ISO 8601 UTC) | ✅ | |
| `sample_rate` | integer | ✅ | Hz you sampled at, e.g. `50` |
| `sample_count` | integer | ✅ | length of `motion_samples` |
| `motion_samples` | array | ✅ | see below |
| `altitude_samples` | array | optional | omit if no barometer (defaults to `[]`) |
| `floor_summary` | object | optional | omit if no floor counting (defaults to `{}`) |
| `notes` | string | optional | free text |

### `motion_samples` element

The Watch records a rich per-sample set. Your board only needs to send what it has — **accelerometer + gyroscope are the core**; everything else is optional (send `null` or omit).

```json
{ "t": 0,
  "ax": 0.01, "ay": -0.02, "az": 0.98,
  "gx": 0.0, "gy": 0.1, "gz": -0.05,
  "mx": 12.3, "my": 8.1, "mz": -40.2,
  "gravx": 0.0, "gravy": 0.0, "gravz": 1.0,
  "roll": 0.1, "pitch": -0.2, "yaw": 1.3,
  "qw": 1.0, "qx": 0.0, "qy": 0.0, "qz": 0.0,
  "magacc": 2, "heading": 270.0 }
```

| Field | Meaning | Board guidance |
|-------|---------|----------------|
| `t` | ms since session start (first = 0) | **required** |
| `ax ay az` | accelerometer, 3 axes | **required** |
| `gx gy gz` | gyroscope, 3 axes | **required** if you have one |
| `mx my mz` | magnetometer, 3 axes | optional (`null` if none) |
| `gravx gravy gravz` | gravity vector (Apple splits this out) | optional — omit/`null` |
| `roll pitch yaw` | orientation (Euler, rad) | optional — only if you do sensor fusion |
| `qw qx qy qz` | orientation quaternion | optional |
| `magacc` | mag accuracy (-1..2) | optional |
| `heading` | compass degrees | optional |

**Just send `t`, `ax/ay/az`, `gx/gy/gz`** (and `mx/my/mz` if available) and leave the rest out — that's totally fine. The fields beyond those are values Apple's Watch fuses internally; a raw board won't have them.

**Units / comparability — important:**
- The Watch reports acceleration in **g** with **gravity already removed** (`ax/ay/az` is *linear* acceleration; the gravity component is in `gravx/gravy/gravz` separately). A raw IMU's accel **includes gravity** — so your raw accel ≈ the Watch's `ax+gravx`, etc. Keep that in mind when comparing.
- Watch rotation is in **radians/second**.
- If your IMU outputs m/s² or raw counts, that's fine — **just tell us the units** so we can normalize later.

### `altitude_samples` element (optional)

```json
{ "t": 1000, "relative_altitude": 2.7 }
```
Relative altitude in metres vs. the session start.

### `floor_summary` (optional)

```json
{ "floors_ascended": 1, "floors_descended": 0 }
```

---

## Example: curl

```bash
curl -X POST "https://jehrccwdwrjybzzksgmr.supabase.co/rest/v1/sessions" \
  -H "apikey: sb_publishable_i-TxVkO-__zmoCLyAEwDcA_DqSeeezA" \
  -H "Authorization: Bearer sb_publishable_i-TxVkO-__zmoCLyAEwDcA_DqSeeezA" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '{
    "user_id": "Bender",
    "chore_label": "Vacuum",
    "start_time": "2026-05-30T10:00:00.000Z",
    "end_time": "2026-05-30T10:00:01.000Z",
    "sample_rate": 50,
    "sample_count": 2,
    "notes": "esp32 bench test",
    "motion_samples": [
      {"t":0,"ax":0.01,"ay":-0.02,"az":0.98,"gx":0.0,"gy":0.1,"gz":-0.05,"mx":null,"my":null,"mz":null},
      {"t":20,"ax":0.03,"ay":-0.01,"az":1.01,"gx":0.2,"gy":0.0,"gz":-0.02,"mx":null,"my":null,"mz":null}
    ]
  }'
```

A `201 Created` (or `204` with `return=minimal`) means it's stored.

---

## Example: Python (Raspberry Pi etc.)

```python
import requests, time
from datetime import datetime, timezone

BASE = "https://jehrccwdwrjybzzksgmr.supabase.co"
KEY  = "sb_publishable_i-TxVkO-__zmoCLyAEwDcA_DqSeeezA"
HEADERS = {
    "apikey": KEY,
    "Authorization": f"Bearer {KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

def iso(dt): return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

# --- collect your samples however your board does it ---
start = datetime.now(timezone.utc)
samples = []
t0 = time.monotonic()
# ... in your sampling loop, append dicts:
# samples.append({"t": int((time.monotonic()-t0)*1000),
#                 "ax": ax, "ay": ay, "az": az,
#                 "gx": gx, "gy": gy, "gz": gz,
#                 "mx": mx, "my": my, "mz": mz})
end = datetime.now(timezone.utc)

payload = {
    "user_id": "Bender",
    "chore_label": "Mop",
    "start_time": iso(start),
    "end_time": iso(end),
    "sample_rate": 50,
    "sample_count": len(samples),
    "motion_samples": samples,
    # "altitude_samples": [...],          # optional
    # "floor_summary": {"floors_ascended": 0, "floors_descended": 0},  # optional
    # "notes": "board v2",
}

r = requests.post(f"{BASE}/rest/v1/sessions", headers=HEADERS, json=payload)
r.raise_for_status()
print("uploaded", len(samples), "samples")
```

---

## Reading the data back

Same key. Useful for verifying uploads:

```bash
# Recent sessions (metadata only, no heavy arrays)
curl "https://jehrccwdwrjybzzksgmr.supabase.co/rest/v1/sessions?select=id,user_id,chore_label,start_time,end_time,sample_count&order=created_at.desc&limit=10" \
  -H "apikey: sb_publishable_i-TxVkO-__zmoCLyAEwDcA_DqSeeezA"

# Only your boards
curl "https://jehrccwdwrjybzzksgmr.supabase.co/rest/v1/sessions?user_id=in.(Bender,Wall-E)&select=id,chore_label,sample_count" \
  -H "apikey: sb_publishable_i-TxVkO-__zmoCLyAEwDcA_DqSeeezA"
```

---

## Practical notes

- **Timestamps must be UTC ISO 8601** (`...Z`). If your board has no real-time clock, set `start_time`/`end_time` from whatever clock you have — relative `t` offsets are what matter most for the signal.
- **Payload size:** `motion_samples` is stored as one JSON blob per session. A 10-min session at 50 Hz ≈ 30k samples ≈ a few MB of JSON — fine, but if a board can't hold/send that much at once, keep sessions shorter or lower the rate. (One POST = one session; don't try to append to an existing row.)
- **Missing sensors:** no gyro? send `gx/gy/gz` as `0`. No magnetometer? send `mx/my/mz` as `null`. Just keep the keys present in each sample.
- **Errors:** a `4xx` returns a JSON body explaining what's wrong (bad column, type mismatch). `401/403` = key/header problem.
