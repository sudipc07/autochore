# CHARM — Dashboard Design Brief (for Google Stitch)

CHARM = **Continuous Human Activity Recognition Module**.

A brief to generate the **executive/supervisor dashboard** UI for an enterprise facilities product. Paste the "Context" section into Stitch first, then generate each screen from its prompt. Goal: a polished, pitch-ready design for facility-services executives.

---

## Context (paste this into Stitch first)

CHARM is an **enterprise B2B operations dashboard** for **commercial cleaning and facilities management** — used by supervisors and executives at large facility-services companies that clean offices, hospitals, malls, and airports.

**How the data is captured:** each cleaning staff member wears a **screen-free wrist band** (a wearable, like a fitness tracker) for their shift. The band has motion and altitude sensors and automatically records their activity — the worker does nothing, taps no buttons. At the end of the shift the band is returned to base and **uploads the day's data**, which is processed and shown in this dashboard. (Data arrives per shift, not live.)

**What it detects** from the band's motion data: the worker's **activity** through the shift — active work, walking between areas (transit), idle time — and which **cleaning task** they were performing (mopping, vacuuming, dusting, restroom cleaning, window cleaning, waste removal), in which **zone/floor** of the building.

**Audience:** facility **executives and supervisors** — non-technical. They care about outcomes: Is the building being cleaned? By whom? Where? What was missed? How well is the team utilised?

**Show outcomes, not raw sensor data.** No motion/accelerometer charts, no signal plots, no engineering jargon. This is an operations dashboard, not an analytics or science tool.

**Visual style:** clean, modern, professional, trustworthy enterprise SaaS. Light theme, generous whitespace, clear KPI cards, simple charts (bars, donuts, horizontal timelines), and a building/floor map. Calm corporate palette with one strong accent colour. Desktop-first (viewed on laptops).

**Domain terms to use:** cleaning task, activity, zone/area, floor, shift, roster/assignment, coverage, utilisation, transit, idle, exception/flag. **Do not use the word "chore."**

---

## Screen 1 — Building Overview (landing / hero screen)

The at-a-glance daily picture for a facility manager.

- Header: building name, date, shift selector.
- Row of **KPI cards**: Coverage % (areas cleaned vs planned), Staff on shift, Active vs idle time, Exceptions count.
- **Building coverage view**: a floor/zone map or floor list with a **heatmap** — green = covered, amber = partial, red = missed.
- **Exceptions panel**: short list of flagged items in plain English (e.g. "3rd-floor restrooms not cleaned", "East stairwell skipped", "Worker idle 45 min").
- **Team summary**: workers listed with a coverage/utilisation indicator each.

## Screen 2 — Worker Shift Timeline

One worker's day, top to bottom.

- Worker name/photo, assigned zones (from roster), shift hours.
- A **horizontal timeline** across the shift with coloured segments: **task episodes** (each cleaning task a colour), **transit** (walking between areas), and **idle**. Hover shows activity + duration + location.
- Summary stats: total active time, time per task, areas visited, floors changed.
- A **"vs assignment"** line: did they do what they were rostered to do (plain English).

## Screen 3 — Coverage Map / Floor Plan

The spatial view of what got done.

- A **floor plan** (or stacked floor diagram) with zones shaded by status (covered / partial / missed).
- Floor switcher.
- Per-zone detail on click: which task, by whom, when, duration.
- Legend.

## Screen 4 — Exceptions & Daily Summary

The "what should I pay attention to" screen, with the AI narrative.

- A **plain-English daily summary** paragraph at the top: what was accomplished, what was missed, anything unusual (AI-generated narrative).
- A prioritised **list of exceptions/flags** with severity (missed areas, under-utilisation, anomalies vs roster), each with a short explanation.
- Filters by floor / worker / severity.

## Screen 5 (optional) — Team / Roster View

Comparison across the whole team for the shift.

- Table or card grid of workers: assigned zone, coverage %, active vs idle, exceptions.
- Sort/filter; a simple bar chart comparing utilisation across the team.

---

## Notes for whoever generates these

- Use **realistic enterprise sample content** (real-sounding worker names, building floors, cleaning tasks, times) so screens read as a live product.
- Keep one consistent visual system across all screens (shared header, colours, components).
- Prioritise Screens 1, 2, and 4 — they carry the pitch. Screens 3 and 5 are supporting.
- Deliverable: the generated **screen PNGs**, which will be built into a web dashboard.
