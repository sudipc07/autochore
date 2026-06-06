# AutoChore — How the Motion Analysis Works

This explains the per-session "motion analysis" shown on each session in the dashboard, e.g.:

> **Mop — motion analysis**
> Moderate-paced motion at about 64 strokes/min, with sharp, bursty spikes.
> - Rhythm: ~64 strokes/min (moderate-paced)
> - Texture: sharp, bursty spikes (crest 5.6×)
> - Effective rate: 50 Hz over 43s

The goal is a plain-English read of *what the motion looks like*, computed only from the accelerometer — and in a way that works for any device without calibration.

---

## Why these features

Two questions describe most repetitive physical work:
1. **How fast is the repeating motion?** (rhythm)
2. **Is it smooth or jerky?** (texture)

Both can be measured in a **unit-independent** way, which matters because our devices report different units (the Apple Watch in g and rad/s; the IMU board in raw counts). Features that don't depend on units let us compare them directly.

---

## Step 1 — Build one "movement" signal

For each sample, the three accelerometer axes are combined into a single magnitude:

```
amag = sqrt(ax² + ay² + az²)
```

This makes the signal **orientation-independent** — it doesn't matter which way the device is tilted or mounted.

Then the average is subtracted, which removes the constant gravity/bias component and leaves just the *movement* (the wiggle).

---

## Step 2 — Rhythm (stroke rate)

This asks how often the motion repeats. We scan every candidate frequency from **0.3 Hz to 4 Hz** (the range of human repetitive motion) and measure how strongly the signal oscillates at each one — essentially correlating the movement signal against sine/cosine waves at that frequency (a periodogram / mini Fourier transform).

The frequency with the most energy is the **dominant stroke frequency**; multiplied by 60 it becomes **strokes per minute**.

That number is then bucketed into words:

| Strokes / min | Label |
|---------------|-------|
| under 35 | very slow |
| 35–50 | slow |
| 50–65 | moderate-paced |
| 65–85 | brisk |
| over 85 | fast |

(64/min → "moderate-paced".)

---

## Step 3 — Texture (burstiness)

The **crest factor** = peak amplitude ÷ standard deviation of the movement signal. It captures spikiness:

| Crest factor | Label |
|--------------|-------|
| under 2.8 | smooth, even waves |
| 2.8–3.8 | moderate peaks |
| 3.8–5.0 | spiky peaks |
| over 5.0 | sharp, bursty spikes |

A smooth back-and-forth (like vacuuming) sits low; sharp jerky movements (like dusting, or vigorous mopping) sit high. (5.6× → "sharp, bursty spikes".)

---

## Why it's device-independent

- **Stroke rate** is a frequency (Hz) — it doesn't change if the data is in g or raw counts.
- **Crest factor** is a ratio (peak ÷ spread) — also unitless.

So the same logic produces a meaningful description for both the Apple Watch and the IMU board, with no calibration step. It describes the *shape* of the motion, not absolute magnitudes.

---

## Reliability — when to trust it

The estimate needs enough signal to be meaningful:

- **Sample rate** must be high enough to capture the motion. Below ~25 Hz, fast strokes alias and the frequency estimate becomes unreliable.
- **Duration** must cover several stroke cycles. A 1–2 second clip can't measure a ~1 Hz rhythm (less than one full cycle), so very short sessions produce noise.

For this reason the dashboard's top-level **chore-signature comparison** only includes sessions above ~25 Hz and ~10 seconds. The per-session card still shows a value for any session, but treat short or low-rate clips with caution.

---

## What it is *not* (yet)

- It does **not** classify the chore — it describes the motion. (The chore label comes from whoever recorded it.)
- It uses **only the accelerometer**. Gyroscope, magnetometer, orientation, and altitude are captured and charted, but not yet folded into the summary.
- Absolute intensity ("gentle" vs "vigorous" in real units) needs calibration (device scale factors) and isn't reported yet.

These are natural next steps once there's more data and the device units are calibrated.
