# AutoChore — Dashboard Design Brief (for Google Stitch)

A brief to generate the **executive/supervisor dashboard** UI. Paste the "Context" section first, then generate each screen from its prompt. The goal is a polished, pitch-ready design for facility-services executives.

---

## Context (give this to Stitch first)

AutoChore is a workforce-monitoring product for commercial cleaning / janitorial teams. Staff wear a screen-free wristband that automatically records what cleaning work they do, where, and when — with zero interaction ("zero touch"). At the end of a shift the band uploads its data, and this dashboard shows supervisors and facility executives what happened across the building.

Audience: facility-services **executives and supervisors** — not technical users. They care about outcomes: Is the building being cleaned? By whom? Where? What was missed? How well is the team utilised?

Show **outcomes, not raw sensor data.** No accelerometer charts, no signal plots, no engineering jargon. Think operations dashboard, not a science tool.

**Visual style:** clean, modern, professional, trustworthy. Light theme. Generous whitespace. Clear KPIs, simple charts (bars, donuts, timelines), and a building/floor map. A calm, corporate palette (one strong accent colour). Desktop-first (executives view on laptops), but tidy.

**Domain terms:** zones/areas, floors, chores (mop, vacuum, dust, clean toilets, wipe windows, empty trash), shift, roster/assignment, coverage, utilisation, transit (walking between areas), idle, exceptions/flags.

---

## Screen 1 — Building Overview (the landing / hero screen)

The at-a-glance daily picture for a facility manager.

Include:
- A header with the building name, date, and shift selector.
- A row of **KPI cards**: Coverage % (areas cleaned vs planned), Staff on shift, Active time vs idle %, Exceptions count.
- A **building coverage view**: a floor/zone map or floor list with a **heatmap** — green = cleaned/covered, amber = partial, red = missed.
- An **exceptions panel**: a short list of flagged items in plain English (e.g. "3rd-floor toilets not cleaned", "East stairwell skipped", "Worker idle 45 min").
- A small **team summary**: list of workers with a coverage/utilisation indicator each.

## Screen 2 — Worker Shift Timeline

A single worker's day, top to bottom.

Include:
- Worker name/photo, assigned zones (from roster), shift hours.
- A **horizontal timeline** across the shift showing coloured segments: **chore episodes** (each chore a colour), **transit** (walking between areas), and **idle**. Hovering a segment shows the activity + duration + location.
- Summary stats: total active time, time per chore, areas visited, floors changed.
- A **"vs assignment"** note: did they do what they were rostered to do (plain-English).

## Screen 3 — Coverage Map / Floor Plan

The spatial view of what got done.

Include:
- A **floor plan** (or stacked floor diagram) with zones shaded by coverage status (cleaned / partial / missed).
- A floor switcher.
- Per-zone detail on click: which chore, by whom, when, duration.
- A legend.

## Screen 4 — Exceptions & Daily Summary

The "what should I pay attention to" screen, with the AI narrative.

Include:
- A **plain-English daily summary** at the top (written paragraph): what was accomplished, what was missed, anything unusual. (This is the LLM-generated narrative.)
- A prioritised **list of exceptions/flags** with severity (missed areas, under-utilisation, anomalies vs roster), each with a short explanation.
- Filters by floor / worker / severity.

## Screen 5 (optional) — Team / Roster View

Comparison across the whole team for the shift.

Include:
- A table or card grid of workers: assigned zone, coverage %, active vs idle, exceptions.
- Sort/filter. A simple bar chart comparing utilisation across the team.

---

## Notes for whoever generates these

- Use **realistic sample content** (real-sounding worker names, floors, chores, times) so the screens read as a live product.
- Keep the same visual system across all screens (shared header, colours, components).
- Prioritise Screens 1, 2, and 4 — they carry the pitch. Screens 3 and 5 are supporting.
- Deliverable back to the dev: the generated **screen PNGs**, which will then be built as a web dashboard.
