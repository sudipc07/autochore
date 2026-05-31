'use strict';

// Per-session motion analysis. Uses scale-invariant features (stroke rate,
// regularity, burstiness) so it works for any device/units without calibration.

function analyzeMotion(session) {
  const m = Array.isArray(session.motion_samples) ? session.motion_samples : [];
  if (m.length < 200) return null;

  // Downsample to keep the scan cheap.
  const MAX = 3000;
  const stride = m.length > MAX ? Math.ceil(m.length / MAX) : 1;
  const s = m.filter((_, i) => i % stride === 0);

  const t = s.map((x) => x.t / 1000);
  const amag = s.map((x) =>
    Math.sqrt((x.ax || 0) ** 2 + (x.ay || 0) ** 2 + (x.az || 0) ** 2)
  );
  const mean = amag.reduce((a, b) => a + b, 0) / amag.length;
  const ac = amag.map((v) => v - mean); // strip DC (gravity/bias)

  const std = Math.sqrt(ac.reduce((a, b) => a + b * b, 0) / ac.length) || 1e-9;
  const peak = Math.max(...ac.map(Math.abs));
  const crest = peak / std; // burstiness: spiky vs smooth

  const durationSec = t[t.length - 1] - t[0];
  const fs = durationSec > 0 ? s.length / durationSec : 0;

  // Scan the human-motion band 0.3–4 Hz for the dominant repetition frequency.
  let bandTotal = 0;
  let best = { f: 0, p: -1 };
  for (let f = 0.3; f <= 4.0; f += 0.02) {
    let c = 0;
    let si = 0;
    for (let i = 0; i < ac.length; i++) {
      const ang = 2 * Math.PI * f * t[i];
      c += ac[i] * Math.cos(ang);
      si += ac[i] * Math.sin(ang);
    }
    const p = c * c + si * si;
    bandTotal += p;
    if (p > best.p) best = { f, p };
  }
  const strokePerMin = Math.round(best.f * 60);
  const regularity = bandTotal > 0 ? best.p / bandTotal : 0; // how dominant the main rhythm is

  // ---- turn numbers into words (all scale-invariant) ----
  const rhythm =
    strokePerMin < 40 ? 'Slow' : strokePerMin <= 75 ? 'Moderate-paced' : 'Fast';
  const regWord =
    regularity > 0.012 ? 'highly rhythmic and repetitive'
      : regularity > 0.005 ? 'fairly regular'
      : 'irregular and varied';
  const texture =
    crest > 4.5 ? 'sharp, bursty spikes'
      : crest > 3 ? 'moderate peaks'
      : 'smooth, even waves';

  const summary =
    `${rhythm} motion at about ${strokePerMin} strokes/min — ` +
    `${regWord}, with ${texture}.`;

  return {
    summary,
    bullets: [
      `Rhythm: ~${strokePerMin} strokes/min (${rhythm.toLowerCase()})`,
      `Pattern: ${regWord}`,
      `Texture: ${texture} (crest ${crest.toFixed(1)}×)`,
      `Effective rate: ${fs.toFixed(0)} Hz over ${formatDur(durationSec)}`,
    ],
  };
}

function formatDur(sec) {
  const m = Math.floor(sec / 60);
  const r = Math.round(sec % 60);
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

module.exports = { analyzeMotion };
