'use strict';

function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function layout(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} · AutoChore</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <header class="topbar">
    <a class="brand" href="/">AutoChore</a>
    <nav class="nav">
      <a href="/">Sessions</a>
      <a href="/devices">Devices</a>
    </nav>
    <form method="post" action="/logout" class="logout"><button type="submit">Log out</button></form>
  </header>
  <main>${body}</main>
</body>
</html>`;
}

function loginPage(error) {
  const body = `
  <section class="login">
    <h1>AutoChore Admin</h1>
    ${error ? `<p class="error">${esc(error)}</p>` : ''}
    <form method="post" action="/login">
      <input type="password" name="password" placeholder="Password" autofocus required>
      <button type="submit">Enter</button>
    </form>
  </section>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Login · AutoChore</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body class="centered">${body}</body>
</html>`;
}

function durationStr(start, end) {
  const ms = new Date(end) - new Date(start);
  if (!isFinite(ms) || ms < 0) return '—';
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return m > 0 ? `${m}m ${rem}s` : `${rem}s`;
}

function fmtDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return esc(iso);
  return d.toLocaleString('en-AU', { timeZone: 'Australia/Sydney' }) + ' AEST/AEDT';
}

function listPage(sessions, facets, selected) {
  const choreOpts = facets.chores
    .map((c) => `<option value="${esc(c)}"${c === selected.chore ? ' selected' : ''}>${esc(c)}</option>`)
    .join('');
  const userOpts = facets.users
    .map((u) => `<option value="${esc(u)}"${u === selected.user ? ' selected' : ''}>${esc(u)}</option>`)
    .join('');

  const rows = sessions
    .map((s) => {
      const f = s.floor_summary || {};
      return `<tr onclick="location.href='/session/${esc(s.id)}'">
        <td>${fmtDate(s.start_time)}</td>
        <td>${esc(s.user_id)}</td>
        <td>${esc(s.chore_label)}</td>
        <td>${durationStr(s.start_time, s.end_time)}</td>
        <td>↑${esc(f.floors_ascended ?? 0)} ↓${esc(f.floors_descended ?? 0)}</td>
        <td>${esc(s.sample_count)}</td>
        <td class="notes">${esc(s.notes || '')}</td>
      </tr>`;
    })
    .join('');

  const body = `
  <h1>Sessions <span class="count">${sessions.length}</span></h1>
  <form class="filters" method="get" action="/">
    <select name="chore" onchange="this.form.submit()">
      <option value="">All chores</option>${choreOpts}
    </select>
    <select name="user" onchange="this.form.submit()">
      <option value="">All users</option>${userOpts}
    </select>
    ${(selected.chore || selected.user) ? '<a class="clear" href="/">Clear</a>' : ''}
  </form>
  ${
    sessions.length === 0
      ? '<p class="empty">No sessions yet.</p>'
      : `<table class="sessions">
    <thead><tr>
      <th>Started</th><th>User</th><th>Chore</th><th>Duration</th>
      <th>Floors</th><th>Samples</th><th>Notes</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`
  }`;
  return layout('Sessions', body);
}

function detailPage(session, analysis) {
  const f = session.floor_summary || {};
  const analysisCard = analysis
    ? `<section class="analysis">
         <div class="analysis-head">${esc(session.chore_label)} — motion analysis</div>
         <p class="analysis-summary">${esc(analysis.summary)}</p>
         <ul>${analysis.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
         <p class="analysis-note">Inferred from the accelerometer signal (device-independent features).</p>
       </section>`
    : `<section class="analysis"><p class="analysis-note">Not enough samples to analyze.</p></section>`;
  const body = `
  <a class="back" href="/">← All sessions</a>
  <h1>${esc(session.chore_label)} · ${esc(session.user_id)}</h1>
  ${analysisCard}
  <dl class="meta">
    <div><dt>Started</dt><dd>${fmtDate(session.start_time)}</dd></div>
    <div><dt>Ended</dt><dd>${fmtDate(session.end_time)}</dd></div>
    <div><dt>Duration</dt><dd>${durationStr(session.start_time, session.end_time)}</dd></div>
    <div><dt>Sample rate</dt><dd>${esc(session.sample_rate)} Hz</dd></div>
    <div><dt>Samples</dt><dd>${esc(session.sample_count)}</dd></div>
    <div><dt>Floors</dt><dd>↑${esc(f.floors_ascended ?? 0)} ↓${esc(f.floors_descended ?? 0)}</dd></div>
    ${session.notes ? `<div><dt>Notes</dt><dd>${esc(session.notes)}</dd></div>` : ''}
  </dl>

  <div class="actions">
    <a class="btn" href="/api/sessions/${esc(session.id)}/csv">Download CSV</a>
    <button class="btn" id="copyJson">Copy JSON</button>
  </div>

  <h2>Accelerometer (g) — X / Y / Z</h2>
  <canvas id="accelChart" height="120"></canvas>

  <h2>Accelerometer magnitude</h2>
  <canvas id="accelMagChart" height="110"></canvas>

  <h2>Gravity (g) — X / Y / Z</h2>
  <canvas id="gravChart" height="120"></canvas>
  <p id="gravNote" class="empty" style="display:none">No gravity data in this session.</p>

  <h2>Gyroscope (rad/s) — X / Y / Z</h2>
  <canvas id="gyroChart" height="120"></canvas>

  <h2>Orientation (rad) — Roll / Pitch / Yaw</h2>
  <canvas id="oriChart" height="120"></canvas>
  <p id="oriNote" class="empty" style="display:none">No orientation data in this session.</p>

  <h2>Magnetometer (µT) — X / Y / Z</h2>
  <canvas id="magChart" height="120"></canvas>
  <p id="magNote" class="empty" style="display:none">No magnetometer data in this session.</p>

  <h2>Heading (°)</h2>
  <canvas id="headingChart" height="110"></canvas>
  <p id="headingNote" class="empty" style="display:none">No heading data in this session.</p>

  <h2>Relative altitude (m)</h2>
  <canvas id="altChart" height="110"></canvas>

  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <script id="session-data" type="application/json">${JSON.stringify({
    motion: session.motion_samples || [],
    altitude: session.altitude_samples || [],
    raw: session,
  })}</script>
  <script src="/detail.js"></script>`;
  return layout(`${session.chore_label} session`, body);
}

function devicesPage(devices, counts) {
  const rows = devices
    .map(
      (d) => `<tr>
        <td>${esc(d.name)}</td>
        <td>${counts[d.name] || 0}</td>
        <td class="mono">${esc(d.device_id)}</td>
        <td>${fmtDate(d.created_at)}</td>
      </tr>`
    )
    .join('');

  const body = `
  <h1>Devices <span class="count">${devices.length}</span></h1>
  ${
    devices.length === 0
      ? '<p class="empty">No devices registered yet.</p>'
      : `<table class="sessions">
    <thead><tr><th>Name</th><th>Sessions</th><th>Device ID</th><th>Registered</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
  }`;
  return layout('Devices', body);
}

module.exports = { esc, layout, loginPage, listPage, detailPage, devicesPage };
