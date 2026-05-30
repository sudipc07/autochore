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

// Column set for the list view — deliberately excludes the heavy jsonb arrays.
const LIST_COLUMNS =
  'id,user_id,chore_label,start_time,end_time,sample_count,floor_summary,notes,created_at';

async function listSessions({ chore, user } = {}) {
  const query = {
    select: LIST_COLUMNS,
    order: 'start_time.desc',
  };
  if (chore) query.chore_label = `eq.${chore}`;
  if (user) query.user_id = `eq.${user}`;
  return restGet('sessions', query);
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
  const rows = await restGet('sessions', { select: 'chore_label,user_id' });
  const chores = [...new Set(rows.map((r) => r.chore_label).filter(Boolean))].sort();
  const users = [...new Set(rows.map((r) => r.user_id).filter(Boolean))].sort();
  return { chores, users };
}

async function listDevices() {
  return restGet('devices', { select: '*', order: 'created_at.asc' });
}

// Count sessions per user_id so the Devices view can show activity.
async function sessionCountsByUser() {
  const rows = await restGet('sessions', { select: 'user_id' });
  const counts = {};
  for (const r of rows) counts[r.user_id] = (counts[r.user_id] || 0) + 1;
  return counts;
}

module.exports = { listSessions, getSession, listFacets, listDevices, sessionCountsByUser };
