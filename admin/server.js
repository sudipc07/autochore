'use strict';

const path = require('path');
const express = require('express');
const cookieSession = require('cookie-session');

// Load .env (simple parser, no dependency) if present.
try {
  const fs = require('fs');
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
} catch (_) {
  /* ignore */
}

const {
  listSessions,
  getSession,
  listFacets,
  listDevices,
  sessionCountsByUser,
} = require('./supabase');
const { motionSamplesToCSV } = require('./csv');
const { analyzeMotion } = require('./analysis');
const { loginPage, listPage, detailPage, devicesPage } = require('./views');

const PORT = process.env.PORT || 3003;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-insecure-secret';

const app = express();
app.disable('x-powered-by');
app.use(express.urlencoded({ extended: false }));
app.use(
  cookieSession({
    name: 'autochore',
    secret: SESSION_SECRET,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  })
);
app.use(express.static(path.join(__dirname, 'public')));

function requireAuth(req, res, next) {
  if (req.session && req.session.authed) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'unauthorized' });
  return res.redirect('/login');
}

// --- Auth ---
app.get('/login', (req, res) => {
  if (req.session && req.session.authed) return res.redirect('/');
  res.send(loginPage(null));
});

app.post('/login', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    req.session.authed = true;
    return res.redirect('/');
  }
  res.status(401).send(loginPage('Wrong password.'));
});

app.post('/logout', (req, res) => {
  req.session = null;
  res.redirect('/login');
});

// --- Pages ---
app.get('/', requireAuth, async (req, res, next) => {
  try {
    const selected = { chore: req.query.chore || '', user: req.query.user || '' };
    const [sessions, facets] = await Promise.all([listSessions(selected), listFacets()]);
    res.send(listPage(sessions, facets, selected));
  } catch (err) {
    next(err);
  }
});

app.get('/devices', requireAuth, async (req, res, next) => {
  try {
    const [devices, counts] = await Promise.all([listDevices(), sessionCountsByUser()]);
    res.send(devicesPage(devices, counts));
  } catch (err) {
    next(err);
  }
});

app.get('/session/:id', requireAuth, async (req, res, next) => {
  try {
    const session = await getSession(req.params.id);
    if (!session) return res.status(404).send('Session not found');
    res.send(detailPage(session, analyzeMotion(session)));
  } catch (err) {
    next(err);
  }
});

// --- JSON / CSV API ---
app.get('/api/sessions', requireAuth, async (req, res, next) => {
  try {
    res.json(await listSessions({ chore: req.query.chore, user: req.query.user }));
  } catch (err) {
    next(err);
  }
});

app.get('/api/sessions/:id', requireAuth, async (req, res, next) => {
  try {
    const session = await getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'not found' });
    res.json(session);
  } catch (err) {
    next(err);
  }
});

app.get('/api/sessions/:id/csv', requireAuth, async (req, res, next) => {
  try {
    const session = await getSession(req.params.id);
    if (!session) return res.status(404).send('not found');
    const csv = motionSamplesToCSV(session);
    const fname = `${session.chore_label}_${session.user_id}_${session.id.slice(0, 8)}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

// --- Error handler ---
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).send('Server error — check logs.');
});

app.listen(PORT, () => {
  console.log(`AutoChore admin listening on :${PORT}`);
});
