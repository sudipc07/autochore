#!/usr/bin/env python3
"""
AutoChore session analysis.

Fetches sessions from Supabase, extracts motion features per session
(sampling rate, accel/gyro intensity, dominant stroke frequency, spectral
energy), prints a comparison table, and saves comparison plots.

Handles both inline sessions (motion_samples in the row) and Storage-based
sessions (samples_path -> file in the raw-sessions bucket).

Usage:
    python3 analyze_sessions.py                 # all sessions
    python3 analyze_sessions.py --user Bender   # one device
    python3 analyze_sessions.py --user Bender --plot out.png
"""
import argparse
import json
import urllib.request
import numpy as np

SUPABASE_URL = "https://jehrccwdwrjybzzksgmr.supabase.co"
KEY = "sb_publishable_i-TxVkO-__zmoCLyAEwDcA_DqSeeezA"


def _get(url):
    req = urllib.request.Request(url, headers={"apikey": KEY, "Authorization": f"Bearer {KEY}"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def fetch_sessions(user=None):
    q = "select=id,user_id,chore_label,sample_rate,sample_count,samples_path,motion_samples&order=start_time"
    if user:
        q += f"&user_id=eq.{user}"
    rows = _get(f"{SUPABASE_URL}/rest/v1/sessions?{q}")
    for s in rows:
        if s.get("samples_path") and not s.get("motion_samples"):
            raw = _get(f"{SUPABASE_URL}/storage/v1/object/public/raw-sessions/{s['samples_path']}")
            s["motion_samples"] = raw.get("motion_samples", [])
    return rows


def features(s):
    m = s["motion_samples"] or []
    if len(m) < 200:
        return None
    t = np.array([x["t"] for x in m], float) / 1000.0
    ax = np.array([x.get("ax", 0) or 0 for x in m], float)
    ay = np.array([x.get("ay", 0) or 0 for x in m], float)
    az = np.array([x.get("az", 0) or 0 for x in m], float)
    gx = np.array([x.get("gx", 0) or 0 for x in m], float)
    gy = np.array([x.get("gy", 0) or 0 for x in m], float)
    gz = np.array([x.get("gz", 0) or 0 for x in m], float)

    amag = np.sqrt(ax**2 + ay**2 + az**2)
    gmag = np.sqrt(gx**2 + gy**2 + gz**2)
    ac = amag - amag.mean()  # strip DC (gravity/bias)

    dur = t[-1] - t[0]
    fs = len(t) / dur if dur > 0 else 0.0

    # Dominant repetitive-motion frequency in the human band 0.3-4 Hz.
    f = np.fft.rfftfreq(len(ac), d=1.0 / fs) if fs > 0 else np.array([0.0])
    P = np.abs(np.fft.rfft(ac)) ** 2 if fs > 0 else np.array([0.0])
    band = (f >= 0.3) & (f <= 4.0)
    domf = float(f[band][np.argmax(P[band])]) if band.any() and P[band].size else 0.0

    return {
        "id": s["id"],
        "chore": s["chore_label"],
        "user": s["user_id"],
        "n": len(m),
        "fs": round(fs, 1),
        "accel_intensity": round(float(ac.std()), 1),
        "gyro_intensity": round(float((gmag - gmag.mean()).std()), 1),
        "stroke_hz": round(domf, 2),
        "stroke_per_min": round(domf * 60),
        "_freq": (f, P, band) if fs > 0 else None,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--user", default=None)
    ap.add_argument("--plot", default=None, help="path to save comparison PNG")
    args = ap.parse_args()

    sessions = fetch_sessions(args.user)
    feats = [f for f in (features(s) for s in sessions) if f]
    if not feats:
        print("No sessions with enough samples.")
        return

    print(f"{'chore':8} {'user':8} {'n':>6} {'fs':>6} {'accel_int':>10} {'gyro_int':>10} {'stroke/min':>11}")
    print("-" * 70)
    for r in sorted(feats, key=lambda r: (r["chore"], r["user"])):
        print(f"{r['chore'][:8]:8} {r['user'][:8]:8} {r['n']:>6} {r['fs']:>6} "
              f"{r['accel_intensity']:>10} {r['gyro_intensity']:>10} {r['stroke_per_min']:>11}")

    if args.plot:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        chores = sorted({r["chore"] for r in feats})
        cmap = {c: plt.cm.tab10(i) for i, c in enumerate(chores)}

        fig, (axb, axs) = plt.subplots(1, 2, figsize=(13, 5))

        # Left: stroke-rate vs accel-intensity scatter (per chore)
        for r in feats:
            axb.scatter(r["stroke_per_min"], r["accel_intensity"],
                        color=cmap[r["chore"]], s=90, edgecolor="k", linewidth=0.5)
        for c in chores:
            axb.scatter([], [], color=cmap[c], label=c, s=90)
        axb.set_xlabel("stroke rate (per min)")
        axb.set_ylabel("accel intensity (std)")
        axb.set_title("Chore signatures: rhythm vs intensity")
        axb.legend()
        axb.grid(alpha=0.3)

        # Right: averaged accel spectra per chore (0-4 Hz)
        for c in chores:
            curves = []
            for r in feats:
                if r["chore"] != c or not r["_freq"]:
                    continue
                f, P, band = r["_freq"]
                sel = (f >= 0.2) & (f <= 4.0)
                ff = f[sel]
                pp = P[sel] / (P[sel].max() or 1)
                curves.append((ff, pp))
            if curves:
                grid = np.linspace(0.2, 4.0, 200)
                stack = np.mean([np.interp(grid, ff, pp) for ff, pp in curves], axis=0)
                axs.plot(grid, stack, color=cmap[c], label=c, linewidth=2)
        axs.set_xlabel("frequency (Hz)")
        axs.set_ylabel("normalized power")
        axs.set_title("Motion frequency spectrum by chore")
        axs.legend()
        axs.grid(alpha=0.3)

        fig.tight_layout()
        fig.savefig(args.plot, dpi=110)
        print(f"\nsaved plot -> {args.plot}")


if __name__ == "__main__":
    main()
