# AutoChore Admin UI — Design Spec

**Date:** 2026-05-29
**Status:** Approved for build
**Type:** Internal admin tool for inspecting collected sensor sessions.

---

## Purpose

A web admin interface for the team to browse, inspect, and download the chore sensor sessions stored in Supabase. Read-only inspection — no analytics yet.

---

## Architecture

A small **Node/Express** app (CommonJS, no build step). The browser talks only to this app; the app is the only thing that talks to Supabase.

```
Browser ──(login cookie)──> Express (port 3003) ──(publishable key, server-side)──> Supabase REST
```

**Why a server, not a static site:** keeps the Supabase key off the client and lets a single login gate all access. With RLS off, this is what keeps the data private.

**Security:**
- Supabase URL + key live in server-side env vars, never sent to the browser.
- Single shared password (env `ADMIN_PASSWORD`) → signed httpOnly session cookie (`cookie-session`).
- All data routes require a valid session; unauthenticated requests redirect to `/login`.

**Deployment:** `/home/ubuntu/autochore-admin` on EC2 `52.6.169.112`, pm2 process `autochore-admin`, port **3003**, nginx vhost `autochore.bubbles.work`, certbot TLS.

---

## Dependencies

- `express`
- `cookie-session`
- Node 18+ global `fetch` (no node-fetch needed)
- Frontend: Chart.js via CDN (no local build)

---

## Routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/login` | public | Login form |
| POST | `/login` | public | Check password, set cookie |
| POST | `/logout` | public | Clear cookie |
| GET | `/` | required | Sessions list page (HTML) |
| GET | `/session/:id` | required | Session detail page (HTML) |
| GET | `/api/sessions` | required | JSON list (supports `?chore=` `&user=`) |
| GET | `/api/sessions/:id` | required | JSON single session (raw row) |
| GET | `/api/sessions/:id/csv` | required | CSV of motion_samples (download) |

---

## Pages

### Login
Minimal centered form, single password field.

### Sessions list (`/`)
- Table: date/time, user, chore, duration (end−start), floors ↑/↓, sample count
- Filter dropdowns: chore, user (populated from the data)
- Newest first
- Each row links to detail
- Logout link

### Session detail (`/session/:id`)
- Header: chore, user, start/end, duration, floors ↑/↓, notes (if any)
- **Chart 1:** accelerometer magnitude `√(ax²+ay²+az²)` over time
- **Chart 2:** relative altitude over time
- **Download CSV** button → `/api/sessions/:id/csv`
- **Copy JSON** button → copies the raw session JSON to clipboard

---

## File structure

```
admin/
├── package.json
├── .env.example          # ADMIN_PASSWORD, SUPABASE_URL, SUPABASE_KEY, SESSION_SECRET, PORT
├── server.js             # express app, auth middleware, routes
├── supabase.js           # server-side Supabase REST helpers
├── csv.js                # motion_samples → CSV string
├── views.js              # HTML page templates (template strings)
└── public/
    └── styles.css
```

---

## Out of scope (v1)

- Editing or deleting sessions
- Analytics, aggregation, classification
- Per-user accounts (single shared password)
- Pagination (fine until session count is large; revisit later)
