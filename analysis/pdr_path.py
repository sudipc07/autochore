#!/usr/bin/env python3
"""
Pedestrian Dead Reckoning (PDR) — reconstruct a walking path from a session.

Counts steps from the accelerometer, takes heading from the fusion yaw (or
integrates gyro-z if no fusion), and dead-reckons a relative 2D path. Outputs
a path plot and a turn-by-turn description.

NOTE: this produces a RELATIVE path (shape + turns), not an absolute position
in a building. Heading drifts over time; anchor to known points / a floor plan
to correct it. Step length is assumed.

Usage:
    python3 pdr_path.py --chore movement --plot path.png
    python3 pdr_path.py --id <session-uuid> --step 0.7
"""
import argparse, json, urllib.request
import numpy as np

URL = "https://jehrccwdwrjybzzksgmr.supabase.co"
KEY = "sb_publishable_i-TxVkO-__zmoCLyAEwDcA_DqSeeezA"


def _get(u):
    req = urllib.request.Request(u, headers={"apikey": KEY, "Authorization": f"Bearer {KEY}"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def fetch(chore=None, sid=None):
    if sid:
        q = f"id=eq.{sid}&select=motion_samples,samples_path"
    else:
        q = f"chore_label=eq.{chore}&select=motion_samples,samples_path&order=created_at.desc&limit=1"
    row = _get(f"{URL}/rest/v1/sessions?{q}")[0]
    if row.get("samples_path") and not row.get("motion_samples"):
        row["motion_samples"] = _get(f"{URL}/storage/v1/object/public/raw-sessions/{row['samples_path']}").get("motion_samples", [])
    return row["motion_samples"]


def reconstruct(m, step_len=0.70):
    t = np.array([s["t"] for s in m], float) / 1000.0
    ax = np.array([s["ax"] for s in m], float)
    ay = np.array([s["ay"] for s in m], float)
    az = np.array([s["az"] for s in m], float)
    fs = len(t) / (t[-1] - t[0])

    # forward-fill fusion yaw if present, else integrate gyro-z
    yaw = np.array([s.get("yaw", np.nan) for s in m], float)
    if np.isfinite(yaw).any():
        ok = ~np.isnan(yaw); idx = np.where(ok, np.arange(len(yaw)), 0)
        np.maximum.accumulate(idx, out=idx); yaw = yaw[idx]; heading_src = "fusion yaw"
        head_series = np.deg2rad(yaw)
    else:
        gz = np.array([s["gz"] for s in m], float)
        head_series = np.cumsum(np.deg2rad(gz) / fs); heading_src = "integrated gyro-z"

    # step detection on accel magnitude
    ac = np.sqrt(ax**2 + ay**2 + az**2); ac = ac - ac.mean()
    acs = np.convolve(ac, np.ones(5) / 5, mode="same")
    thr = acs.std() * 0.6; gap = int(0.30 * fs)
    peaks = []
    for i in range(1, len(acs) - 1):
        if acs[i] > thr and acs[i] >= acs[i - 1] and acs[i] > acs[i + 1] and (not peaks or i - peaks[-1] >= gap):
            peaks.append(i)

    h = np.unwrap(head_series[peaks])
    x = np.concatenate([[0], np.cumsum(step_len * np.cos(h))])
    y = np.concatenate([[0], np.cumsum(step_len * np.sin(h))])
    return dict(t=t, fs=fs, peaks=peaks, heading=h, x=x, y=y, src=heading_src, step_len=step_len)


def turn_by_turn(h, step_len):
    out = []; seg = 0
    for k in range(1, len(h) + 1):
        turn = (k < len(h)) and abs(np.rad2deg(h[k] - h[seg])) > 45
        if turn or k == len(h):
            n = k - seg; line = f"straight ~{n} steps (~{n*step_len:.0f} m)"
            if k < len(h):
                d = np.rad2deg(h[k] - h[k - 1])
                line += f", turn {'right' if d < 0 else 'left'} ~{abs(d):.0f}°"
            out.append(line); seg = k
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--chore", default="movement")
    ap.add_argument("--id", default=None)
    ap.add_argument("--step", type=float, default=0.70, help="step length (m)")
    ap.add_argument("--plot", default=None)
    args = ap.parse_args()

    m = fetch(args.chore, args.id)
    r = reconstruct(m, args.step)
    print(f"{len(r['peaks'])} steps · {r['fs']:.0f} Hz · heading from {r['src']} · {args.step} m/step")
    for line in turn_by_turn(r["heading"], args.step):
        print("  •", line)

    if args.plot:
        import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
        fig, a = plt.subplots(figsize=(7, 7))
        a.plot(r["x"], r["y"], "-", color="#4b41e1", lw=1.6)
        a.scatter([r["x"][0]], [r["y"][0]], s=120, color="#10b981", zorder=5, label="Start")
        a.scatter([r["x"][-1]], [r["y"][-1]], s=120, color="#ef4444", zorder=5, label="End")
        a.set_aspect("equal"); a.grid(alpha=.3); a.legend()
        a.set_title(f"Reconstructed path (PDR) · {len(r['peaks'])} steps")
        a.set_xlabel("metres"); a.set_ylabel("metres")
        fig.tight_layout(); fig.savefig(args.plot, dpi=110)
        print("saved", args.plot)


if __name__ == "__main__":
    main()
