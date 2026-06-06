# AutoChore — Product Concept & Workflow

This captures the product vision, workflow, and analysis approach (distinct from the experiment/pipeline, which is documented separately).

---

## The pitch: "Zero touch"

A wrist-worn band for janitorial/cleaning staff that automatically logs what work was done, where, and when — **with the worker doing nothing.** No app, no buttons, no "start/stop", no remembering. They wear it; the system figures out the rest.

This is the core differentiator. Every prior approach fails on human behaviour:
- Smartphone apps → workers forget to start/stop.
- Supervisor spot-checks → manual, partial, costly.
- Scanners / checkpoints → workers forget to scan; adds steps.

Zero touch removes the worker from the loop entirely.

---

## The device

- **No screen** (preferred). Nothing for the worker to interact with.
- **Continuous monitor** — records sensor data through the shift.
- **Motion-gated capture** — recording can auto start/stop based on movement (e.g. skip idle/charging) purely to save space/battery. This is automatic, never a worker action.
- Sensors: IMU (accelerometer, gyroscope, magnetometer) + barometric altimeter (for floor changes).

**Sourcing strategy (in progress, owned by L):**
1. **POC fast-track:** find a white-labelable device from China (e.g. Fitbit/smartwatch clones) that allows custom firmware and has the required sensors — use it to move fast.
2. **In parallel:** design a custom device and have it manufactured (also China).

---

## The workflow

1. **Shift start** — supervisor briefing; workers receive their shift directive. *(Mechanism for how directives/assignments are issued — to confirm with M.)*
2. **Pair** — worker collects a band and taps their **RFID ID card** on it. This pairs the band to the person for the shift.
3. **Work** — worker goes about the day. The band records continuously. No interaction.
4. **Return** — at end of shift, the band is taken off and returned to base (e.g. placed on charge).
5. **Upload** — back at base, the band uploads the day's data.
6. **Analysis** — done offline/batch. **No real-time requirement** — within a few hours, or even 24 hours, is fine.

---

## Context inputs

The analysis isn't blind — it's expected to have strong contextual priors that narrow the problem:
- **Roster / assignments** — who is assigned to what (a worker on toilets isn't vacuuming floors).
- **Floor plan** — building/zone layout.

These priors dramatically simplify classification: often the question becomes "does this motion match the *expected* task, and when did they switch?" rather than "which of all chores is this?"

---

## Analysis approach

Three **parallel** workstreams (not sequential — they develop concurrently and plug together):

**A) Activity state — idle / active / transit.** Pure algorithm, no ML.
- Idle: low motion. Active: sustained/rhythmic motion. Transit: walking gait + floor changes (altimeter).
- Valuable on its own (utilisation timeline) and naturally segments the day (transit/idle stretches bracket work episodes).

**B) Chore classification — labelling the active episodes.** Algorithm + roster context first; a **light** ML classifier (e.g. random forest) only where motions genuinely overlap (mop vs sweep). Heavy/deep ML is not expected for the POC.

**C) Reporting & interpretation — the LLM layer.** Operates only on the **structured timeline**, never raw sensor data.
- **Hard, factual flags** (missed zone, task too short, no activity in a window) → plain rules.
- **LLM** → high-level interpretation, plain-English shift summaries, supervisor Q&A, and explaining/prioritising flags. The LLM *reasons and narrates*; it does not *measure*.

Principle: **numbers → structured timeline (algorithm + light ML) → LLM for language.**

---

## The dashboard is the hero

For the target audience (facility execs and supervisors), **the dashboard matters more than the raw data.** It's what gets pitched and what sells the value. It must speak in outcomes — coverage, utilisation, exceptions — not sensor traces. (See the dashboard design brief for details.)

A pitch-ready dashboard can run on **sample/mocked data** — it needs to convey the vision, not be wired to live hardware.

---

## POC target

- **Client:** ISS (large facility-services company), via M.
- **Scale:** a real ISS engagement is significant and has a longer runway — so we prepare thoroughly but have time.
- **POC scope (working assumption):** batch (no real-time), demonstrate the zero-touch capture + the activity/coverage timeline + the exec dashboard, on the white-label device.

---

## Open questions

- How are shift directives / assignments issued today? (confirm with M)
- What roster / floor-plan data will actually be available, and in what form?
- Final chore set for the POC (the realistic building list).
- White-label device choice + which sensors it exposes (L).
