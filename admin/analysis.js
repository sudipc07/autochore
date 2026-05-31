'use strict';

// Per-session motion analysis + cross-chore comparison.
// Uses scale-invariant features (stroke rate, regularity, burstiness) so it
// works for any device/units without calibration.

function motionFeatures(session) {
  const m = Array.isArray(session.motion_samples) ? session.motion_samples : [];
  if (m.length < 200) return null;

  const MAX = 3000;
  const stride = m.length > MAX ? Math.ceil(m.length / MAX) : 1;
  const s = m.filter((_, i) => i % stride === 0);

  const t = s.map((x) => x.t / 1000);
  const amag = s.map((x) =>
    Math.sqrt((x.ax || 0) ** 2 + (x.ay || 0) ** 2 + (x.az || 0) ** 2)
  );
  const mean = amag.reduce((a, b) => a + b, 0) / amag.length;
  const ac = amag.map((v) => v - mean);

  const std = Math.sqrt(ac.reduce((a, b) => a + b * b, 0) / ac.length) || 1e-9;
  const peak = Math.max(...ac.map(Math.abs));
  const crest = peak / std;

  const durationSec = t[t.length - 1] - t[0];
  const fs = durationSec > 0 ? s.length / durationSec : 0;

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

  return {
    strokePerMin: Math.round(best.f * 60),
    crest,
    regularity: bandTotal > 0 ? best.p / bandTotal : 0,
    fs,
    durationSec,
  };
}

function rhythmWord(spm) {
  if (spm < 35) return 'Very slow';
  if (spm < 50) return 'Slow';
  if (spm <= 65) return 'Moderate-paced';
  if (spm <= 85) return 'Brisk';
  return 'Fast';
}
function textureWord(crest) {
  if (crest > 5) return 'sharp, bursty spikes';
  if (crest > 3.8) return 'spiky peaks';
  if (crest > 2.8) return 'moderate peaks';
  return 'smooth, even waves';
}

function analyzeMotion(session) {
  const f = motionFeatures(session);
  if (!f) return null;
  const rhythm = rhythmWord(f.strokePerMin);
  const texture = textureWord(f.crest);
  return {
    features: f,
    summary: `${rhythm} motion at about ${f.strokePerMin} strokes/min, with ${texture}.`,
    bullets: [
      `Rhythm: ~${f.strokePerMin} strokes/min (${rhythm.toLowerCase()})`,
      `Texture: ${texture} (crest ${f.crest.toFixed(1)}×)`,
      `Effective rate: ${f.fs.toFixed(0)} Hz over ${fmtDur(f.durationSec)}`,
    ],
  };
}

// Aggregate per chore across many sessions, with cross-chore superlatives.
function choreSummary(items) {
  // items: [{ chore, features }]
  const byChore = {};
  for (const it of items) {
    if (!it.features) continue;
    (byChore[it.chore] = byChore[it.chore] || []).push(it.features);
  }
  const rows = Object.entries(byChore).map(([chore, fs]) => {
    const avg = (k) => fs.reduce((a, f) => a + f[k], 0) / fs.length;
    return {
      chore,
      sessions: fs.length,
      strokePerMin: Math.round(avg('strokePerMin')),
      crest: avg('crest'),
    };
  });
  if (!rows.length) return [];

  const slowest = Math.min(...rows.map((r) => r.strokePerMin));
  const fastest = Math.max(...rows.map((r) => r.strokePerMin));
  const burstiest = Math.max(...rows.map((r) => r.crest));
  const smoothest = Math.min(...rows.map((r) => r.crest));

  for (const r of rows) {
    const tags = [];
    if (r.strokePerMin === slowest && rows.length > 1) tags.push('slowest');
    if (r.strokePerMin === fastest && rows.length > 1) tags.push('fastest');
    if (r.crest === burstiest && rows.length > 1) tags.push('burstiest');
    if (r.crest === smoothest && rows.length > 1) tags.push('smoothest');
    r.rhythm = rhythmWord(r.strokePerMin);
    r.texture = textureWord(r.crest);
    r.tags = tags;
    r.signature = `${r.rhythm.toLowerCase()}, ${r.texture}`;
  }
  rows.sort((a, b) => a.strokePerMin - b.strokePerMin);
  return rows;
}

function fmtDur(sec) {
  const m = Math.floor(sec / 60);
  const r = Math.round(sec % 60);
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

module.exports = { analyzeMotion, motionFeatures, choreSummary };
