'use strict';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

function restURL(path, query) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

async function restGet(path, query) {
  const res = await fetch(restURL(path, query), {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

// Generic write helper (POST/PATCH/DELETE). `returning`: 'representation'
// (default, returns the rows) or 'minimal' (returns null).
async function restWrite(method, path, query, body, { returning = 'representation' } = {}) {
  const res = await fetch(restURL(path, query), {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: `return=${returning}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase ${method} ${path} ${res.status}: ${await res.text()}`);
  if (returning === 'minimal') return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
const restPost = (path, body, opts) => restWrite('POST', path, null, body, opts);
const restPatch = (path, query, body, opts) => restWrite('PATCH', path, query, body, opts);
const restDelete = (path, query) => restWrite('DELETE', path, query, undefined, { returning: 'minimal' });

// Column set for the list view — deliberately excludes the heavy jsonb arrays.
const LIST_COLUMNS =
  'id,user_id,chore_label,start_time,end_time,sample_count,floor_summary,notes,created_at';

async function listSessions({ chore, user, archived = false } = {}) {
  const query = {
    select: LIST_COLUMNS,
    order: 'start_time.desc',
    archived: archived ? 'is.true' : 'is.false',
  };
  if (chore) query.chore_label = `eq.${chore}`;
  if (user) query.user_id = `eq.${user}`;
  return restGet('sessions', query);
}

async function setArchived(id, archived) {
  const res = await fetch(restURL('sessions', { id: `eq.${id}` }), {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ archived }),
  });
  if (!res.ok) throw new Error(`archive ${res.status}: ${await res.text()}`);
}

async function getSession(id) {
  const rows = await restGet('sessions', { select: '*', id: `eq.${id}`, limit: 1 });
  const s = rows[0];
  if (!s) return null;

  // Newer sessions store samples as a file in Storage; older ones inline.
  const hasInline = Array.isArray(s.motion_samples) && s.motion_samples.length > 0;
  if (s.samples_path && !hasInline) {
    const url = `${SUPABASE_URL}/storage/v1/object/public/raw-sessions/${s.samples_path}`;
    try {
      const res = await fetch(url, { headers: { apikey: SUPABASE_KEY } });
      if (res.ok) {
        const raw = await res.json();
        s.motion_samples = raw.motion_samples || [];
        s.altitude_samples = raw.altitude_samples || [];
      }
    } catch (_) {
      s.motion_samples = s.motion_samples || [];
      s.altitude_samples = s.altitude_samples || [];
    }
  }
  return s;
}

// Distinct chore/user values for the filter dropdowns.
async function listFacets() {
  const rows = await restGet('sessions', { select: 'chore_label,user_id', archived: 'is.false' });
  const chores = [...new Set(rows.map((r) => r.chore_label).filter(Boolean))].sort();
  const users = [...new Set(rows.map((r) => r.user_id).filter(Boolean))].sort();
  return { chores, users };
}

// Lightweight metadata for every session (no heavy sample arrays).
async function listSessionsMeta() {
  return restGet('sessions', {
    select: 'id,chore_label,samples_path',
    order: 'created_at.desc',
    archived: 'is.false',
  });
}

async function listDevices() {
  return restGet('devices', { select: '*', order: 'created_at.asc' });
}

// Count sessions per user_id so the Devices view can show activity.
async function sessionCountsByUser() {
  const rows = await restGet('sessions', { select: 'user_id', archived: 'is.false' });
  const counts = {};
  for (const r of rows) counts[r.user_id] = (counts[r.user_id] || 0) + 1;
  return counts;
}

// ── Costing projects ─────────────────────────────────────────────────────────
async function listCostingProjects() {
  return restGet('costing_projects', {
    select: 'id,name,description,updated_at,created_at',
    order: 'created_at.asc',
  });
}

async function getCostingProject(id) {
  const rows = await restGet('costing_projects', { select: '*', id: `eq.${id}`, limit: 1 });
  return rows[0] || null;
}

async function createCostingProject({ name, description, data }) {
  const rows = await restPost('costing_projects', {
    name,
    description: description || null,
    data: data || {},
  });
  return rows && rows[0];
}

async function updateCostingProject(id, { name, description, data }) {
  const patch = { updated_at: new Date().toISOString() };
  if (name !== undefined) patch.name = name;
  if (description !== undefined) patch.description = description;
  if (data !== undefined) patch.data = data;
  const rows = await restPatch('costing_projects', { id: `eq.${id}` }, patch);
  return rows && rows[0];
}

async function deleteCostingProject(id) {
  await restDelete('costing_projects', { id: `eq.${id}` });
}

module.exports = {
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
};
