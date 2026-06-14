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
  listSessionsMeta,
  setArchived,
  listCostingProjects,
  getCostingProject,
  createCostingProject,
  updateCostingProject,
  deleteCostingProject,
} = require('./supabase');
const { motionSamplesToCSV } = require('./csv');
const { analyzeMotion, motionFeatures, choreSummary } = require('./analysis');
const { loginPage, listPage, detailPage, devicesPage } = require('./views');

// Sessions are immutable once uploaded, so cache computed features by id.
const featCache = new Map();
async function getFeatures(id) {
  if (featCache.has(id)) return featCache.get(id);
  const s = await getSession(id);
  const f = s ? motionFeatures(s) : null;
  featCache.set(id, f);
  return f;
}
// Reliability gates for the stroke-rhythm estimate:
//  - below this rate, low-freq strokes alias
//  - below this duration, there aren't enough stroke cycles to measure
const MIN_RELIABLE_HZ = 25;
const MIN_RELIABLE_SEC = 10;

async function computeChoreSummary() {
  const meta = await listSessionsMeta();
  const items = [];
  let excluded = 0;
  for (const r of meta) {
    const f = await getFeatures(r.id);
    if (f && f.fs >= MIN_RELIABLE_HZ && f.durationSec >= MIN_RELIABLE_SEC) {
      items.push({ chore: r.chore_label, features: f });
    } else if (f) {
      excluded++;
    }
  }
  return { rows: choreSummary(items), excluded };
}

const PORT = process.env.PORT || 3003;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me';
// Optional second code for view-only access (can present/toggle, can't edit/save).
// Leave unset to keep a single password = full access, exactly as before.
const VIEWER_PASSWORD = process.env.VIEWER_PASSWORD || '';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-insecure-secret';

const app = express();
app.disable('x-powered-by');
app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: '4mb' })); // costing project payloads (jsonb)
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

// Exec dashboard (static, public for now — mock data for the pitch).
app.get('/dashboard', (req, res) => res.redirect('/dashboard/'));

function requireAuth(req, res, next) {
  if (req.session && req.session.authed) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'unauthorized' });
  return res.redirect('/login');
}

// Role of the current session. Sessions created before roles existed (no role
// field) default to admin — same full access they had before.
const sessionRole = (req) => (req.session && req.session.role) || 'admin';

function requireAdmin(req, res, next) {
  if (req.session && req.session.authed && sessionRole(req) === 'admin') return next();
  if (req.path.startsWith('/api/')) return res.status(403).json({ error: 'forbidden' });
  return res.status(403).send('Forbidden — admin access required.');
}

// --- Auth ---
app.get('/login', (req, res) => {
  if (req.session && req.session.authed) return res.redirect('/');
  res.send(loginPage(null));
});

app.post('/login', (req, res) => {
  const pw = req.body.password;
  if (pw && pw === ADMIN_PASSWORD) {
    req.session.authed = true;
    req.session.role = 'admin';
    return res.redirect('/');
  }
  if (VIEWER_PASSWORD && pw === VIEWER_PASSWORD) {
    req.session.authed = true;
    req.session.role = 'viewer';
    return res.redirect('/');
  }
  res.status(401).send(loginPage('Wrong password.'));
});

app.post('/logout', (req, res) => {
  req.session = null;
  res.redirect('/login');
});

// Current role (so the costing client can hide edit controls for viewers).
app.get('/api/me', requireAuth, (req, res) => {
  res.json({ role: sessionRole(req) });
});

// --- Pages ---
app.get('/', requireAuth, async (req, res, next) => {
  try {
    const showArchived = req.query.show === 'archived';
    const selected = { chore: req.query.chore || '', user: req.query.user || '', archived: showArchived };
    const [sessions, facets, summary] = await Promise.all([
      listSessions(selected),
      listFacets(),
      showArchived ? Promise.resolve(null) : computeChoreSummary(),
    ]);
    res.send(listPage(sessions, facets, selected, summary, showArchived));
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

app.post('/session/:id/archive', requireAuth, async (req, res, next) => {
  try {
    const archive = req.body.archived !== 'false';
    await setArchived(req.params.id, archive);
    res.redirect(archive ? '/' : `/session/${req.params.id}`);
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

// --- Costing & Quoting module ---
// The shell is the static public/costing/index.html (served by express.static).
// Data is gated below; the client redirects to /login if /api/me is 401.
app.get('/api/costing/projects', requireAuth, async (req, res, next) => {
  try {
    res.json(await listCostingProjects());
  } catch (err) {
    next(err);
  }
});

app.get('/api/costing/projects/:id', requireAuth, async (req, res, next) => {
  try {
    const p = await getCostingProject(req.params.id);
    if (!p) return res.status(404).json({ error: 'not found' });
    res.json(p);
  } catch (err) {
    next(err);
  }
});

app.post('/api/costing/projects', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { name, description, data } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    res.status(201).json(await createCostingProject({ name, description, data }));
  } catch (err) {
    next(err);
  }
});

app.put('/api/costing/projects/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { name, description, data } = req.body || {};
    const updated = await updateCostingProject(req.params.id, { name, description, data });
    if (!updated) return res.status(404).json({ error: 'not found' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

app.delete('/api/costing/projects/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await deleteCostingProject(req.params.id);
    res.json({ ok: true });
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
