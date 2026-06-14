# CHARM Band — Costing Tool Quick Start

A live pricing tool for building the CHARM Band quote (and any future hardware). It's part of the AutoChore admin.

## Getting in
1. Go to **https://autochore.bubbles.work/costing/**
2. Log in with the **admin password** (Sudipto will send it separately).
3. The **CHARM Band** project is already there and selected.

## The three views (top bar)
- **Internal** – the working spreadsheet. Enter the BOM and costs here.
- **Presenter** – big, clean price cards for screen-sharing in the meeting.
- **Compare** – two or three configurations side by side.

## Build the quote (Internal view)
1. **Add line items** – click **+ Add line item** for each component (sensor module, MCU, GPS, battery, enclosure, strap, assembly, base-station bits, tooling/NRE…). Give each a name and optional category.
2. **Enter cost per volume tier** – each row has a cost box under **100 / 1,000 / 10,000 units** (bulk pricing, so they differ per tier). Tier volumes are editable in the header if you want different numbers.
3. **Set markup** – top-right **Markup %** box. (Tick "per-tier markup" if you want a different margin at each volume.)
4. Everything below updates **live**: unit BOM cost, sell price/unit, total project value, and margin per tier. No save button — it autosaves (watch the "Saved" chip).

## "What if we add X?" — Options & Variants
- **Options** (panel lower down): create a named feature like **BLE** and list the BOM changes it brings (add a BLE module, swap the MCU, bump the battery). Toggle it on/off → prices recompute instantly.
- **Variants**: save a combination of options as a named config — e.g. **Base spec**, **Base + BLE**, **Premium**.
- **Compare view**: pick 2–3 variants to see them side by side. This is how we answer Riyad's "what's the price difference if we add BLE?" — it shows the delta per tier (e.g. *+$4.20/unit at 1,000*).

## For the meeting
- **Scenarios**: save the current markup + volumes + notes as a named snapshot (e.g. "Riyad baseline") so you can switch instantly.
- Switch to **Presenter**, share your screen — per-unit price is the hero number, with total and margin per tier, plus an editable notes box per column (lead time, terms).

That's it — punch in the BOM and the numbers fall out.
