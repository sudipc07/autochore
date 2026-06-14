'use strict';
/*
 * CHARM Costing & Quoting — single-page client.
 * Vanilla JS. All persistence goes through the role-gated /api/costing API.
 *
 * Data model (project.data jsonb):
 *   { tiers:[{id,label,volume}], markup:Number, tierMarkups:{tierId:%}|null,
 *     notes:{tierId:text},
 *     bom:[{id,name,notes,qty,parentId,costs:{tierId:unitCost},override:{tierId:cost}}],  // tree; parent override per tier
 *     options:[{id,name,notes,mods:[ {type:'add',line:{...}}
 *                                   | {type:'swap',targetBomId,line:{...}}
 *                                   | {type:'remove',targetBomId}
 *                                   | {type:'modify',targetBomId,costs:{tierId:cost}} ]}],
 *     variants:[{id,name,optionIds:[]}],
 *     scenarios:[{id,name,markup,tierMarkups,tierVolumes:{tierId:vol},notes:{tierId:text}}] }
 *
 * Options are diffs applied to the base BOM at compute time. Variants snapshot
 * which options are enabled. Scenarios snapshot pricing (markup/volumes/notes)
 * into the live working state.
 */
(function () {
  // ---------- helpers ----------
  const app = document.getElementById('app');
  const uid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2, 10));
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
  const money = (n) => (isFinite(n) ? '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—');
  const money0 = (n) => (isFinite(n) ? '$' + Math.round(Number(n)).toLocaleString('en-US') : '—');
  const pct = (n) => (isFinite(n) ? (n * 100).toFixed(1) + '%' : '—');
  const clone = (o) => JSON.parse(JSON.stringify(o));

  // ---------- state ----------
  const state = {
    me: null,
    projects: [],
    project: null,
    view: 'internal',
    enabled: new Set(),
    activeVariantId: null,
    scenarioId: null,
    compareIds: [],
    showMargin: true,
    saveState: 'saved',
    collapsed: new Set(),
  };
  const isAdmin = () => !!(state.me && state.me.role === 'admin');
  const D = () => state.project.data;
  const tier = (id) => D().tiers.find((t) => t.id === id);
  const line = (id) => D().bom.find((l) => l.id === id);

  // ---------- data normalize ----------
  function blankData() {
    return {
      tiers: [
        { id: 't100', label: '100 units', volume: 100 },
        { id: 't1000', label: '1,000 units', volume: 1000 },
        { id: 't10000', label: '10,000 units', volume: 10000 },
      ],
      markup: 40, tierMarkups: null, notes: {},
      bom: [], options: [], variants: [], scenarios: [],
    };
  }
  function normalize(d) {
    d = d && typeof d === 'object' ? d : {};
    if (!Array.isArray(d.tiers) || !d.tiers.length) d.tiers = blankData().tiers;
    d.tiers.forEach((t) => { if (!t.id) t.id = uid(); if (t.volume == null) t.volume = 0; if (!t.label) t.label = t.volume + ' units'; });
    if (typeof d.markup !== 'number') d.markup = 40;
    if (d.tierMarkups === undefined) d.tierMarkups = null;
    d.notes = d.notes && typeof d.notes === 'object' ? d.notes : {};
    d.bom = Array.isArray(d.bom) ? d.bom : [];
    d.bom.forEach((l) => {
      if (!l.id) l.id = uid();
      if (!l.costs || typeof l.costs !== 'object') l.costs = {};
      if (l.qty == null) l.qty = 1;                       // qty per line (shared across tiers)
      if (l.parentId === undefined) l.parentId = null;    // hierarchy
      if (!l.override || typeof l.override !== 'object') l.override = {}; // per-tier parent overrides
    });
    d.options = Array.isArray(d.options) ? d.options : [];
    d.options.forEach((o) => { if (!o.id) o.id = uid(); if (!Array.isArray(o.mods)) o.mods = []; });
    d.variants = Array.isArray(d.variants) ? d.variants : [];
    d.variants.forEach((v) => { if (!v.id) v.id = uid(); if (!Array.isArray(v.optionIds)) v.optionIds = []; });
    d.scenarios = Array.isArray(d.scenarios) ? d.scenarios : [];
    d.scenarios.forEach((s) => { if (!s.id) s.id = uid(); });
    return d;
  }

  // ---------- compute (hierarchical BOM, per-tier roll-up / override) ----------
  function effectiveBom(data, enabled) {
    let bom = data.bom.map((l) => ({
      id: l.id, name: l.name, category: l.category, notes: l.notes,
      qty: l.qty == null ? 1 : num(l.qty),
      parentId: l.parentId || null,
      costs: Object.assign({}, l.costs),
      override: Object.assign({}, l.override || {}),
      base: true,
    }));
    const descIds = (id) => {
      const out = []; const stack = [id];
      while (stack.length) { const cur = stack.pop(); for (const x of bom) if (x.parentId === cur) { out.push(x.id); stack.push(x.id); } }
      return out;
    };
    for (const opt of data.options) {
      if (!enabled.has(opt.id)) continue;
      for (const mod of opt.mods) {
        if (mod.type === 'add' && mod.line) {
          bom.push({ id: mod.line.id || uid(), name: mod.line.name, category: mod.line.category, notes: mod.line.notes, qty: mod.line.qty == null ? 1 : num(mod.line.qty), parentId: mod.line.parentId || null, costs: Object.assign({}, mod.line.costs || {}), override: {}, via: opt.name });
        } else if (mod.type === 'remove') {
          const kill = new Set([mod.targetBomId, ...descIds(mod.targetBomId)]);
          bom = bom.filter((l) => !kill.has(l.id));
        } else if (mod.type === 'swap' && mod.line) {
          const kill = new Set(descIds(mod.targetBomId)); // replacement is self-contained — drop old children
          bom = bom.filter((l) => !kill.has(l.id)).map((l) => (l.id === mod.targetBomId
            ? { id: l.id, name: mod.line.name, category: mod.line.category != null ? mod.line.category : l.category, notes: mod.line.notes, qty: l.qty, parentId: l.parentId, costs: Object.assign({}, mod.line.costs || {}), override: {}, via: opt.name }
            : l));
        } else if (mod.type === 'modify') {
          bom = bom.map((l) => {
            if (l.id !== mod.targetBomId) return l;
            // diffing a parent updates its override price, not its children (per Addendum 2)
            const hasKids = bom.some((c) => c.parentId === l.id);
            if (hasKids) return Object.assign({}, l, { override: Object.assign({}, l.override, mod.costs || {}), via: opt.name });
            return Object.assign({}, l, { costs: Object.assign({}, l.costs, mod.costs || {}), via: opt.name });
          });
        }
      }
    }
    return bom;
  }

  function descendantIds(bom, id) {
    const out = []; const stack = [id];
    while (stack.length) { const cur = stack.pop(); for (const x of bom) if ((x.parentId || null) === cur) { out.push(x.id); stack.push(x.id); } }
    return out;
  }
  // Move a line's entry to sit right after `anchorId`'s whole subtree, so it
  // renders in the expected spot after a re-parent (indent/outdent).
  function moveAfterSubtree(id, anchorId) {
    const entry = D().bom.find((x) => x.id === id);
    if (!entry) return;
    const rest = D().bom.filter((x) => x.id !== id);
    const sub = new Set([anchorId, ...descendantIds(rest, anchorId)]);
    let lastIdx = -1;
    rest.forEach((x, k) => { if (sub.has(x.id)) lastIdx = k; });
    rest.splice(lastIdx + 1, 0, entry);
    D().bom = rest;
  }

  const childrenOf = (bom, id) => bom.filter((l) => (l.parentId || null) === id);
  const isParent = (bom, l) => bom.some((c) => (c.parentId || null) === l.id);
  // Unit cost of a line at a tier: a parent rolls up from children unless that
  // tier has an override; a leaf (or overridden parent) uses its own number.
  function lineUnit(bom, l, tierId, depth) {
    depth = depth || 0;
    const ov = l.override ? l.override[tierId] : null;
    const kids = childrenOf(bom, l.id);
    if (kids.length && (ov == null || ov === '') && depth < 60) {
      const total = kids.reduce((s, k) => s + lineTotal(bom, k, tierId, depth + 1), 0);
      const q = num(l.qty) || 1;
      return total / q;
    }
    return ov != null && ov !== '' ? num(ov) : num(l.costs[tierId]);
  }
  function lineTotal(bom, l, tierId, depth) {
    return num(l.qty) * lineUnit(bom, l, tierId, depth);
  }
  // Project per-unit BOM cost at a tier = sum of TOP-LEVEL line totals.
  const sumCost = (bom, tierId) => bom.filter((l) => !l.parentId).reduce((s, l) => s + lineTotal(bom, l, tierId), 0);
  const markupFor = (data, tierId) => (data.tierMarkups && data.tierMarkups[tierId] != null ? data.tierMarkups[tierId] : data.markup);
  function metrics(data, bom, t) {
    const unitCost = sumCost(bom, t.id);
    const mk = num(markupFor(data, t.id));
    const sell = unitCost * (1 + mk / 100);
    const volume = num(t.volume);
    return { unitCost, markup: mk, sell, volume, total: sell * volume, totalCost: unitCost * volume, marginAbs: sell - unitCost, marginPct: sell > 0 ? (sell - unitCost) / sell : 0 };
  }

  // ---------- persistence ----------
  let saveTimer = null;
  function markDirty() {
    if (!isAdmin()) return;
    state.saveState = 'dirty';
    paintSaveState();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveProject, 700);
  }
  async function saveProject() {
    if (!isAdmin() || !state.project) return;
    state.saveState = 'saving';
    paintSaveState();
    try {
      const r = await fetch('/api/costing/projects/' + state.project.id, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: state.project.name, description: state.project.description, data: state.project.data }),
      });
      if (!r.ok) throw new Error(await r.text());
      state.saveState = 'saved';
    } catch (e) {
      console.error('save failed', e);
      state.saveState = 'error';
    }
    paintSaveState();
  }
  function paintSaveState() {
    const el = document.getElementById('saveState');
    if (!el) return;
    el.textContent = { saved: 'Saved', saving: 'Saving…', dirty: 'Unsaved…', error: 'Save failed' }[state.saveState];
    el.className = 'savestate ' + state.saveState;
  }

  // ---------- API ----------
  async function api(method, path, body) {
    const r = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) throw new Error((await r.text()) || r.status);
    return r.status === 204 ? null : r.json();
  }

  async function boot() {
    try {
      state.me = await api('GET', '/api/me');
    } catch (_) { location.href = '/login'; return; }
    try {
      await loadProjects();
    } catch (e) {
      app.className = '';
      app.innerHTML = `<div class="wrap"><div class="empty-state">
        <p style="font-size:17px;font-weight:600;color:var(--text)">Couldn't load costing data.</p>
        <p class="muted" style="font-size:13px;margin-top:8px">If this is the first run, make sure the <code>costing_projects</code> table exists (run <code>db/costing.sql</code> in Supabase).</p>
        <p class="muted" style="font-size:12px;margin-top:8px">${esc(String((e && e.message) || e))}</p>
      </div></div>`;
      return;
    }
    render();
  }
  async function loadProjects(selectId) {
    state.projects = await api('GET', '/api/costing/projects');
    const pick = selectId || (state.project && state.project.id) || (state.projects[0] && state.projects[0].id);
    if (pick) await selectProject(pick);
    else state.project = null;
  }
  async function selectProject(id) {
    const full = await api('GET', '/api/costing/projects/' + id);
    full.data = normalize(full.data);
    state.project = full;
    state.enabled = new Set();
    state.activeVariantId = null;
    state.scenarioId = null;
    state.compareIds = [];
    state.collapsed = new Set();
  }

  // ================= RENDER =================
  function render() {
    if (!state.project) return renderEmpty();
    app.className = '';
    app.innerHTML = topbar() + `<div class="wrap" id="wrap">${viewBody()}</div>`;
    paintSaveState();
  }
  function renderEmpty() {
    app.className = '';
    app.innerHTML = topbar() + `<div class="wrap"><div class="empty-state">
      <p style="font-size:17px;font-weight:600;color:var(--text)">No costing projects yet.</p>
      <p>${isAdmin() ? 'Create your first project to start building a quote.' : 'Ask an admin to create a project.'}</p>
      ${isAdmin() ? '<button class="b" data-act="newProject" style="margin-top:8px">+ New project</button>' : ''}
    </div></div>`;
  }

  function topbar() {
    const opts = state.projects.map((p) => `<option value="${esc(p.id)}"${state.project && p.id === state.project.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
    const views = ['internal', 'presenter', 'compare']
      .map((v) => `<button class="vbtn${state.view === v ? ' active' : ''}" data-act="view" data-view="${v}">${v[0].toUpperCase() + v.slice(1)}</button>`)
      .join('');
    return `<header class="cbar">
      <div class="cbrand">CHARM <b>Costing</b></div>
      <div class="cproj">
        <select id="projectSelect">${opts || '<option>(no projects)</option>'}</select>
        ${isAdmin() ? '<button class="b ghost sm" data-act="newProject">+ New</button>' : ''}
      </div>
      <div class="cviews">${views}</div>
      <div class="spacer"></div>
      ${isAdmin() ? `<span class="savestate ${state.saveState}" id="saveState">Saved</span>` : ''}
      <div class="cuser">
        <span class="role-badge ${state.me.role}">${esc(state.me.role)}</span>
        <a href="/">← Admin</a>
        <form method="post" action="/logout" style="display:inline"><button class="b ghost sm" type="submit">Log out</button></form>
      </div>
    </header>`;
  }

  function viewBody() {
    if (state.view === 'presenter') return presenterView();
    if (state.view === 'compare') return compareView();
    return internalView();
  }

  // ---------- Internal ----------
  function internalView() {
    const data = D();
    const p = state.project;
    const tiers = data.tiers;
    const ro = isAdmin() ? '' : 'disabled';
    const baseBom = effectiveBom(data, new Set());
    const effBom = effectiveBom(data, state.enabled);
    const anyOpt = state.enabled.size > 0;

    const tierHeads = tiers.map((t) => `<th class="num tier-h">
        <div class="th-row">
          <input class="lbl" data-edit="tierLabel" data-tier="${t.id}" value="${esc(t.label)}" ${ro} title="Tier label (shown in Presenter)">
          ${isAdmin() && tiers.length > 1 ? `<button class="icon-x" data-act="delTier" data-id="${t.id}" title="Remove tier">×</button>` : ''}
        </div>
        <input class="vol num" type="number" min="0" step="1" data-edit="tierVol" data-tier="${t.id}" value="${esc(t.volume)}" ${ro} title="Tier volume (units)">
      </th>`).join('');

    // depth-first order, honouring collapsed parents
    const ordered = [];
    (function walk(pid, depth) {
      effBom.filter((l) => (l.parentId || null) === pid).forEach((l) => {
        ordered.push({ l, depth });
        if (!state.collapsed.has(l.id)) walk(l.id, depth + 1);
      });
    })(null, 0);

    const tierCell = (l, t) => {
      const unit = lineUnit(effBom, l, t.id);
      const totTxt = num(l.qty) !== 1 ? '= ' + money(lineTotal(effBom, l, t.id)) : '';
      const tot = `<div class="cell-tot" data-tot="${l.id}-${t.id}">${totTxt}</div>`;
      if (l.via) return `<td class="num">${money(unit)}${tot}</td>`;          // option-injected, read-only
      if (isParent(effBom, l)) {
        const overridden = l.override && l.override[t.id] != null;
        if (!overridden) return `<td class="num">
          <span class="mode" data-act="toggleMode" data-id="${l.id}" data-tier="${t.id}" title="Rolls up from children — click to set a fixed price">Σ</span>
          <span class="roll-val" data-roll="${l.id}-${t.id}">${money(unit)}</span>${tot}</td>`;
        return `<td class="num">
          <span class="mode active" data-act="toggleMode" data-id="${l.id}" data-tier="${t.id}" title="Fixed price — click to roll up from children">✎</span>
          <input class="num cost ov" type="text" inputmode="decimal" data-edit="override" data-id="${l.id}" data-tier="${t.id}" value="${esc(l.override[t.id])}" ${ro} placeholder="—">${tot}</td>`;
      }
      return `<td class="num">
        <input class="num cost" type="text" inputmode="decimal" data-edit="lineCost" data-id="${l.id}" data-tier="${t.id}" value="${l.costs[t.id] != null ? esc(l.costs[t.id]) : ''}" ${ro} placeholder="—">${tot}</td>`;
    };

    const bomRows = ordered.map(({ l, depth }) => {
      const isP = isParent(effBom, l);
      const caret = isP
        ? `<span class="caret${state.collapsed.has(l.id) ? ' collapsed' : ''}" data-act="toggleCollapse" data-id="${l.id}" title="Collapse / expand">▾</span>`
        : '<span class="caret-sp"></span>';
      const nameInner = l.via
        ? `<span class="opt-line">${esc(l.name)}<span class="via-tag">${esc(l.via)}</span></span>`
        : `<input data-edit="lineName" data-id="${l.id}" value="${esc(l.name)}" placeholder="${isP ? 'Sub-assembly' : 'Component'}" ${ro}>`;
      const qtyCell = l.via
        ? `<td class="num qty">${esc(l.qty)}</td>`
        : `<td class="num qty"><input class="num" type="number" min="0" step="1" data-edit="qty" data-id="${l.id}" value="${esc(l.qty)}" ${ro}></td>`;
      const addBtn = isAdmin() && !l.via ? `<button class="add-child" data-act="addChild" data-id="${l.id}" title="Add a component under this">+</button>` : '';
      let moveBtns = '';
      let acts = '<td class="col-act"></td>';
      if (isAdmin() && !l.via) {
        const baseSibs = D().bom.filter((x) => (x.parentId || null) === (l.parentId || null));
        const canIndent = baseSibs.findIndex((x) => x.id === l.id) > 0;   // has a sibling above to nest under
        const canOutdent = !!l.parentId;
        const out = canOutdent
          ? `<button class="icon-x move" data-act="outdent" data-id="${l.id}" title="Outdent — move up a level">←</button>`
          : '<span class="act-sp"></span>';
        const ind = canIndent
          ? `<button class="icon-x move" data-act="indent" data-id="${l.id}" title="Indent — nest under the row above">→</button>`
          : '<span class="act-sp"></span>';
        moveBtns = `<span class="move-group">${out}${ind}</span>`;
        acts = `<td class="col-act"><button class="icon-x" data-act="delLine" data-id="${l.id}" title="Delete (with children)">×</button></td>`;
      }
      return `<tr class="${isP ? 'parent' : ''}${l.via ? ' muted-row' : ''}">
        <td class="name-cell" style="padding-left:${6 + depth * 18}px">${moveBtns}${caret}${nameInner}${addBtn}</td>
        ${qtyCell}
        ${tiers.map((t) => tierCell(l, t)).join('')}
        ${acts}
      </tr>`;
    }).join('');

    // computed footer
    const cell = (key, t, txt) => `<td class="num" data-c="${key}-${t.id}">${txt}</td>`;
    const baseRow = tiers.map((t) => cell('baseunit', t, money(metrics(data, baseBom, t).unitCost))).join('');
    const deltaRow = tiers.map((t) => { const d = metrics(data, effBom, t).unitCost - metrics(data, baseBom, t).unitCost; return cell('optdelta', t, d ? '+' + money(d) : '—'); }).join('');
    const unitRow = tiers.map((t) => cell('unitcost', t, money(metrics(data, effBom, t).unitCost))).join('');
    const markupRow = tiers.map((t) => {
      if (data.tierMarkups) return `<td class="num markup-cell"><input class="num" type="number" step="1" data-edit="tierMarkup" data-tier="${t.id}" value="${esc(markupFor(data, t.id))}" ${ro}>%</td>`;
      return `<td class="num" data-c="mk-${t.id}">${pct(metrics(data, effBom, t).markup / 100)}</td>`;
    }).join('');
    const sellRow = tiers.map((t) => cell('sell', t, money(metrics(data, effBom, t).sell))).join('');
    const totalRow = tiers.map((t) => cell('total', t, money0(metrics(data, effBom, t).total))).join('');
    const marginRow = tiers.map((t) => { const m = metrics(data, effBom, t); return cell('marginpct', t, pct(m.marginPct) + ' · ' + money(m.marginAbs)); }).join('');

    const colspan = tiers.length + 3;

    return `
    <div class="page-head">
      <div>
        <h1>${esc(p.name)}</h1>
        ${p.description ? `<p class="desc">${esc(p.description)}</p>` : ''}
      </div>
      <div class="head-actions">
        ${isAdmin() ? '<button class="b ghost" data-act="renameProject">Rename</button>' : ''}
        ${isAdmin() ? '<button class="b danger" data-act="delProject">Delete project</button>' : ''}
      </div>
    </div>

    <div class="card pad">
      <div class="section-flag">
        <div><div class="card-title">Bill of materials</div><div class="card-sub">Unit cost per tier · nest with ＋ · parents roll up (Σ) or take a fixed price (✎)${anyOpt ? ' · totals include enabled options' : ''}</div></div>
        <div class="markup-bar">
          <label>Markup</label>
          ${data.tierMarkups ? '<span class="muted" style="font-size:13px">per-tier (below)</span>' : `<input class="mk" type="number" step="1" data-edit="markup" value="${esc(data.markup)}" ${ro}>%`}
          <label class="checkline"><input type="checkbox" data-toggle="perTier" ${data.tierMarkups ? 'checked' : ''} ${ro}> per-tier markup</label>
        </div>
      </div>
      <table class="bom">
        <thead><tr><th>Component</th><th class="num qty-h">Qty</th>${tierHeads}<th class="col-act"></th></tr></thead>
        <tbody>${bomRows || `<tr><td colspan="${colspan}" class="muted" style="padding:18px;text-align:center">No line items yet.${isAdmin() ? ' Add the first below.' : ''}</td></tr>`}</tbody>
        <tfoot>
          ${anyOpt ? `<tr class="compute"><td class="rowlabel">Base unit cost</td><td></td>${baseRow}<td></td></tr>
          <tr class="compute"><td class="rowlabel">+ Options</td><td></td>${deltaRow}<td></td></tr>` : ''}
          <tr class="compute"><td class="rowlabel big">Unit BOM cost</td><td></td>${unitRow}<td></td></tr>
          <tr class="compute"><td class="rowlabel">Markup</td><td></td>${markupRow}<td></td></tr>
          <tr class="hero"><td class="rowlabel big">Sell price / unit</td><td></td>${sellRow}<td></td></tr>
          <tr class="compute"><td class="rowlabel big">Total project</td><td></td>${totalRow}<td></td></tr>
          <tr class="compute"><td class="rowlabel">Margin</td><td></td>${marginRow}<td></td></tr>
        </tfoot>
      </table>
      ${isAdmin() ? '<div class="toolbar"><button class="b ghost" data-act="addLine">+ Add line item</button><button class="b ghost" data-act="addTier">+ Add tier</button></div>' : ''}
    </div>

    ${optionsCard()}
    ${scenariosCard()}
    ${variantsCard()}
    `;
  }

  function optionsCard() {
    const data = D();
    const rows = data.options.map((o) => {
      const on = state.enabled.has(o.id);
      const summary = o.mods.length ? o.mods.map(modSummary).join(' · ') : 'no changes';
      return `<div class="opt-row${on ? ' on' : ''}">
        <label class="switch"><input type="checkbox" data-toggle="opt" data-id="${o.id}" ${on ? 'checked' : ''}><span class="slider"></span></label>
        <div class="opt-main">
          <div class="opt-name">${esc(o.name)}</div>
          <div class="opt-meta">${esc(summary)}${o.notes ? ' — ' + esc(o.notes) : ''}</div>
        </div>
        ${isAdmin() ? `<div class="opt-actions"><button class="b ghost sm" data-act="editOption" data-id="${o.id}">Edit</button><button class="b danger sm" data-act="delOption" data-id="${o.id}">Delete</button></div>` : ''}
      </div>`;
    }).join('');
    return `<div class="card pad">
      <div class="section-flag">
        <div><div class="card-title">Options</div><div class="card-sub">Toggle design decisions (e.g. “add BLE”). Applied as diffs to the base BOM — totals update live.</div></div>
        ${isAdmin() ? '<button class="b indigo" data-act="addOption">+ Add option</button>' : ''}
      </div>
      <div class="opt-list">${rows || '<p class="muted" style="margin:0">No options defined.</p>'}</div>
    </div>`;
  }
  function modSummary(m) {
    if (m.type === 'add') return 'add ' + (m.line && m.line.name ? m.line.name : 'line');
    if (m.type === 'remove') return 'remove ' + lineName(m.targetBomId);
    if (m.type === 'swap') return 'swap ' + lineName(m.targetBomId) + ' → ' + (m.line && m.line.name ? m.line.name : '?');
    if (m.type === 'modify') return 'modify ' + lineName(m.targetBomId);
    return m.type;
  }
  const lineName = (id) => { const l = line(id); return l ? l.name || '(unnamed)' : '(removed)'; };

  function scenariosCard() {
    const data = D();
    const chips = data.scenarios.map((s) => `<div class="opt-row${state.scenarioId === s.id ? ' on' : ''}">
        <div class="opt-main"><div class="opt-name">${esc(s.name)}</div><div class="opt-meta">markup ${esc(s.markup)}% · ${Object.keys(s.tierVolumes || {}).length} tiers</div></div>
        <div class="opt-actions"><button class="b ghost sm" data-act="loadScenario" data-id="${s.id}">Load</button>${isAdmin() ? `<button class="b danger sm" data-act="delScenario" data-id="${s.id}">×</button>` : ''}</div>
      </div>`).join('');
    return `<div class="card pad">
      <div class="section-flag">
        <div><div class="card-title">Scenarios</div><div class="card-sub">Saved pricing snapshots (markup + tier volumes + presenter notes).</div></div>
        ${isAdmin() ? '<button class="b ghost" data-act="saveScenario">Save current as scenario</button>' : ''}
      </div>
      <div class="opt-list">${chips || '<p class="muted" style="margin:0">No saved scenarios.</p>'}</div>
    </div>`;
  }

  function variantsCard() {
    const data = D();
    const chips = data.variants.map((v) => {
      const names = v.optionIds.map((id) => { const o = data.options.find((x) => x.id === id); return o ? o.name : null; }).filter(Boolean);
      return `<div class="opt-row${state.activeVariantId === v.id ? ' on' : ''}">
        <div class="opt-main"><div class="opt-name">${esc(v.name)}</div><div class="opt-meta">${names.length ? esc(names.join(', ')) : 'no options'}</div></div>
        <div class="opt-actions"><button class="b ghost sm" data-act="loadVariant" data-id="${v.id}">Load</button>${isAdmin() ? `<button class="b danger sm" data-act="delVariant" data-id="${v.id}">×</button>` : ''}</div>
      </div>`;
    }).join('');
    return `<div class="card pad">
      <div class="section-flag">
        <div><div class="card-title">Variants</div><div class="card-sub">Saved option combinations (hardware configs). Compare them in the Compare view.</div></div>
        ${isAdmin() ? '<button class="b ghost" data-act="saveVariant">Save current as variant</button>' : ''}
      </div>
      <div class="opt-list">${chips || '<p class="muted" style="margin:0">No saved variants.</p>'}</div>
    </div>`;
  }

  // ---------- Presenter ----------
  function presenterView() {
    const data = D();
    const ro = isAdmin() ? '' : 'disabled';
    const enabledNames = [...state.enabled].map((id) => { const o = data.options.find((x) => x.id === id); return o ? o.name : null; }).filter(Boolean);
    const bom = effectiveBom(data, state.enabled);
    const cols = data.tiers.map((t) => {
      const m = metrics(data, bom, t);
      const dollars = Math.floor(m.sell);
      const cents = Math.round((m.sell - dollars) * 100).toString().padStart(2, '0');
      const noteVal = data.notes[t.id] || '';
      const noteEl = isAdmin()
        ? `<textarea class="note" data-edit="note" data-tier="${t.id}" placeholder="Lead time, terms, notes…">${esc(noteVal)}</textarea>`
        : `<div class="note-static">${esc(noteVal) || '<span class="muted">—</span>'}</div>`;
      const volLine = Number(t.volume).toLocaleString('en-US') + ' units';
      const showVol = String(t.label).trim() !== volLine;
      return `<div class="pres-col">
        <div class="tier-name">${esc(t.label)}</div>
        ${showVol ? `<div class="tier-vol">${volLine}</div>` : '<div class="tier-vol">&nbsp;</div>'}
        <div class="hero-label">Price per unit</div>
        <div class="hero">$${dollars.toLocaleString('en-US')}<span class="cents">.${cents}</span></div>
        <div class="kv"><span class="k">Total project</span><span class="v">${money0(m.total)}</span></div>
        ${state.showMargin ? `<div class="kv"><span class="k">Margin</span><span class="v">${pct(m.marginPct)}</span></div>` : ''}
        <div class="note-label">Notes</div>
        ${noteEl}
      </div>`;
    }).join('');
    return `
    <div class="pres-head">
      <h1>${esc(state.project.name)}</h1>
      <div class="sub">${enabledNames.length ? 'Configuration: ' + esc(enabledNames.join(' + ')) : 'Base configuration'}</div>
    </div>
    <div class="pres-toggles">
      <label class="checkline"><input type="checkbox" data-toggle="margin" ${state.showMargin ? 'checked' : ''}> Show margin</label>
    </div>
    <div class="pres-grid">${cols}</div>`;
  }

  // ---------- Compare ----------
  function compareView() {
    const data = D();
    const picks = [{ id: '__base__', name: 'Base (no options)', optionIds: [] }].concat(data.variants);
    const chips = picks.map((v) => {
      const on = state.compareIds.includes(v.id);
      return `<label class="cmp-chip${on ? ' on' : ''}"><input type="checkbox" data-toggle="compare" data-id="${v.id}" ${on ? 'checked' : ''}>${esc(v.name)}</label>`;
    }).join('');

    const selected = state.compareIds.map((id) => picks.find((p) => p.id === id)).filter(Boolean).slice(0, 3);
    let grid = '<p class="muted">Pick up to three variants above to compare side by side.</p>';
    if (selected.length) {
      const baseRef = picks[0];
      grid = `<div class="cmp-grid" style="grid-template-columns:repeat(${selected.length},1fr)">` + selected.map((v) => {
        const bom = effectiveBom(data, new Set(v.optionIds));
        const baseBom = effectiveBom(data, new Set(baseRef.optionIds));
        const names = v.optionIds.map((id) => { const o = data.options.find((x) => x.id === id); return o ? o.name : null; }).filter(Boolean);
        const rows = data.tiers.map((t) => {
          const m = metrics(data, bom, t);
          const mb = metrics(data, baseBom, t);
          const d = m.sell - mb.sell;
          const delta = v.id !== '__base__' && d ? `<span class="cmp-delta"> (${d > 0 ? '+' : ''}${money(d)})</span>` : '';
          return `<tr class="hero"><td>${esc(t.label)}</td><td>${money(m.sell)}${delta}</td></tr>
            <tr><td>unit cost</td><td>${money(m.unitCost)}</td></tr>
            <tr><td>total project</td><td>${money0(m.total)}</td></tr>
            <tr><td>margin</td><td>${pct(m.marginPct)}</td></tr>`;
        }).join('');
        return `<div class="cmp-col">
          <h3>${esc(v.name)}</h3>
          <div class="opts">${names.length ? names.map((n) => `<span class="pill">${esc(n)}</span>`).join('') : '<span class="muted">base BOM</span>'}</div>
          <table class="cmp-table"><thead><tr><th>Tier</th><th>Sell / unit</th></tr></thead><tbody>${rows}</tbody></table>
        </div>`;
      }).join('') + '</div>';
    }

    return `
    <div class="page-head"><div><h1>Compare variants</h1><p class="desc">Side-by-side pricing using the current markup &amp; tier volumes. Deltas are vs. base.</p></div></div>
    <div class="cmp-pick">${chips}</div>
    ${grid}`;
  }

  // ---------- live repaint (internal, no re-render) ----------
  function paintComputed() {
    if (state.view !== 'internal' || !state.project) return;
    const data = D();
    const baseBom = effectiveBom(data, new Set());
    const effBom = effectiveBom(data, state.enabled);
    // per-line roll-up values + item totals
    effBom.forEach((l) => {
      data.tiers.forEach((t) => {
        const rv = document.querySelector(`[data-roll="${l.id}-${t.id}"]`);
        if (rv) rv.textContent = money(lineUnit(effBom, l, t.id));
        const tt = document.querySelector(`[data-tot="${l.id}-${t.id}"]`);
        if (tt) tt.textContent = num(l.qty) !== 1 ? '= ' + money(lineTotal(effBom, l, t.id)) : '';
      });
    });
    // computed footer
    const set = (k, t, txt) => { const c = document.querySelector(`[data-c="${k}-${t.id}"]`); if (c) c.textContent = txt; };
    data.tiers.forEach((t) => {
      const mb = metrics(data, baseBom, t);
      const me = metrics(data, effBom, t);
      set('baseunit', t, money(mb.unitCost));
      set('optdelta', t, me.unitCost - mb.unitCost ? '+' + money(me.unitCost - mb.unitCost) : '—');
      set('unitcost', t, money(me.unitCost));
      set('mk', t, pct(me.markup / 100));
      set('sell', t, money(me.sell));
      set('total', t, money0(me.total));
      set('marginpct', t, pct(me.marginPct) + ' · ' + money(me.marginAbs));
    });
  }

  // ================= EVENTS =================
  app.addEventListener('input', (e) => {
    const ed = e.target.dataset.edit;
    if (!ed || !state.project) return;
    const data = D();
    if (ed === 'tierVol') { tier(e.target.dataset.tier).volume = num(e.target.value); paintComputed(); markDirty(); }
    else if (ed === 'tierLabel') { tier(e.target.dataset.tier).label = e.target.value; markDirty(); }
    else if (ed === 'lineName') { line(e.target.dataset.id).name = e.target.value; markDirty(); }
    else if (ed === 'lineCat') { line(e.target.dataset.id).category = e.target.value; markDirty(); }
    else if (ed === 'lineCost') { line(e.target.dataset.id).costs[e.target.dataset.tier] = num(e.target.value); paintComputed(); markDirty(); }
    else if (ed === 'qty') { line(e.target.dataset.id).qty = num(e.target.value); paintComputed(); markDirty(); }
    else if (ed === 'override') { const l = line(e.target.dataset.id); l.override = l.override || {}; l.override[e.target.dataset.tier] = num(e.target.value); paintComputed(); markDirty(); }
    else if (ed === 'markup') { data.markup = num(e.target.value); paintComputed(); markDirty(); }
    else if (ed === 'tierMarkup') { (data.tierMarkups = data.tierMarkups || {})[e.target.dataset.tier] = num(e.target.value); paintComputed(); markDirty(); }
    else if (ed === 'note') { data.notes[e.target.dataset.tier] = e.target.value; markDirty(); }
  });

  app.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'projectSelect') { selectProject(t.value).then(render); return; }
    const tg = t.dataset.toggle;
    if (tg === 'opt') { t.checked ? state.enabled.add(t.dataset.id) : state.enabled.delete(t.dataset.id); state.activeVariantId = null; render(); }
    else if (tg === 'margin') { state.showMargin = t.checked; }
    else if (tg === 'perTier') { togglePerTier(t.checked); render(); }
    else if (tg === 'compare') {
      if (t.checked) { if (state.compareIds.length < 3) state.compareIds.push(t.dataset.id); }
      else state.compareIds = state.compareIds.filter((id) => id !== t.dataset.id);
      render();
    }
  });

  app.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    const id = b.dataset.id;
    const data = state.project ? D() : null;
    switch (act) {
      case 'view': state.view = b.dataset.view; render(); break;
      case 'newProject': openProjectModal(); break;
      case 'renameProject': openProjectModal(state.project); break;
      case 'delProject': confirmDeleteProject(); break;
      case 'addLine': data.bom.push({ id: uid(), name: '', costs: {}, qty: 1, parentId: null, override: {} }); markDirty(); render(); break;
      case 'addChild': data.bom.push({ id: uid(), name: '', costs: {}, qty: 1, parentId: id, override: {} }); state.collapsed.delete(id); markDirty(); render(); break;
      case 'toggleCollapse': state.collapsed.has(id) ? state.collapsed.delete(id) : state.collapsed.add(id); render(); break;
      case 'indent': {
        const l = line(id);
        const sibs = data.bom.filter((x) => (x.parentId || null) === (l.parentId || null));
        const i = sibs.findIndex((x) => x.id === id);
        if (i > 0) { const np = sibs[i - 1]; l.parentId = np.id; moveAfterSubtree(id, np.id); state.collapsed.delete(np.id); markDirty(); render(); }
        break;
      }
      case 'outdent': {
        const l = line(id);
        if (l.parentId) { const p = line(l.parentId); l.parentId = p.parentId || null; moveAfterSubtree(id, p.id); markDirty(); render(); }
        break;
      }
      case 'toggleMode': {
        const l = line(id); const tid = b.dataset.tier; l.override = l.override || {};
        if (l.override[tid] != null) { delete l.override[tid]; }                  // → roll up from children
        else { const eff = effectiveBom(data, state.enabled); const cur = lineUnit(eff, eff.find((x) => x.id === id) || l, tid); l.override[tid] = Math.round(cur * 100) / 100; } // → fix price (seed with current)
        markDirty(); render(); break;
      }
      case 'delLine': {
        const kill = new Set([id]);
        for (let changed = true; changed; ) { changed = false; data.bom.forEach((l) => { if (l.parentId && kill.has(l.parentId) && !kill.has(l.id)) { kill.add(l.id); changed = true; } }); }
        data.bom = data.bom.filter((l) => !kill.has(l.id)); markDirty(); render(); break;
      }
      case 'addTier': data.tiers.push({ id: uid(), label: 'New tier', volume: 0 }); markDirty(); render(); break;
      case 'delTier': if (data.tiers.length > 1) { data.tiers = data.tiers.filter((t) => t.id !== id); markDirty(); render(); } break;
      case 'addOption': openOptionModal(null); break;
      case 'editOption': openOptionModal(id); break;
      case 'delOption': data.options = data.options.filter((o) => o.id !== id); state.enabled.delete(id); markDirty(); render(); break;
      case 'saveScenario': openNameModal('Save scenario', 'Scenario name', '', (name) => { saveScenario(name); render(); }); break;
      case 'loadScenario': loadScenario(id); break;
      case 'delScenario': data.scenarios = data.scenarios.filter((s) => s.id !== id); if (state.scenarioId === id) state.scenarioId = null; markDirty(); render(); break;
      case 'saveVariant': openNameModal('Save variant', 'Variant name', defaultVariantName(), (name) => { saveVariant(name); render(); }); break;
      case 'loadVariant': loadVariant(id); break;
      case 'delVariant': data.variants = data.variants.filter((v) => v.id !== id); if (state.activeVariantId === id) state.activeVariantId = null; markDirty(); render(); break;
    }
  });

  // ---------- scenarios / variants ops ----------
  function togglePerTier(on) {
    const data = D();
    if (on) { data.tierMarkups = {}; data.tiers.forEach((t) => { data.tierMarkups[t.id] = data.markup; }); }
    else data.tierMarkups = null;
    markDirty();
  }
  function saveScenario(name) {
    const data = D();
    const tierVolumes = {};
    data.tiers.forEach((t) => { tierVolumes[t.id] = t.volume; });
    const s = { id: uid(), name: name || 'Scenario', markup: data.markup, tierMarkups: data.tierMarkups ? clone(data.tierMarkups) : null, tierVolumes, notes: clone(data.notes) };
    data.scenarios.push(s);
    state.scenarioId = s.id;
    markDirty();
  }
  function loadScenario(id) {
    const data = D();
    const s = data.scenarios.find((x) => x.id === id);
    if (!s) return;
    data.markup = s.markup;
    data.tierMarkups = s.tierMarkups ? clone(s.tierMarkups) : null;
    if (s.tierVolumes) data.tiers.forEach((t) => { if (s.tierVolumes[t.id] != null) t.volume = s.tierVolumes[t.id]; });
    data.notes = s.notes ? clone(s.notes) : {};
    state.scenarioId = id;
    markDirty();
    render();
  }
  function defaultVariantName() {
    const data = D();
    const names = [...state.enabled].map((id) => { const o = data.options.find((x) => x.id === id); return o ? o.name : null; }).filter(Boolean);
    return names.length ? 'Base + ' + names.join(' + ') : 'Base spec';
  }
  function saveVariant(name) {
    const data = D();
    const v = { id: uid(), name: name || 'Variant', optionIds: [...state.enabled] };
    data.variants.push(v);
    state.activeVariantId = v.id;
    markDirty();
  }
  function loadVariant(id) {
    const data = D();
    const v = data.variants.find((x) => x.id === id);
    if (!v) return;
    state.enabled = new Set(v.optionIds);
    state.activeVariantId = id;
    render();
  }

  // ================= MODALS =================
  function openModal(html, wide) {
    closeModal();
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<div class="modal${wide ? ' wide' : ''}">${html}</div>`;
    document.body.appendChild(back);
    back.addEventListener('click', (e) => { if (e.target === back) closeModal(); });
    back.querySelectorAll('[data-modal-close]').forEach((b) => b.addEventListener('click', closeModal));
    return back;
  }
  function closeModal() { document.querySelectorAll('.modal-back').forEach((m) => m.remove()); }

  function openNameModal(title, label, initial, onsave) {
    const back = openModal(`<h2>${esc(title)}</h2>
      <label>${esc(label)}</label>
      <input type="text" id="nm" value="${esc(initial)}" autocomplete="off">
      <div class="modal-actions"><button class="b ghost" data-modal-close>Cancel</button><button class="b" id="nmSave">Save</button></div>`);
    const input = back.querySelector('#nm');
    input.focus(); input.select();
    const go = () => { const v = input.value.trim(); if (!v) { input.focus(); return; } closeModal(); onsave(v); };
    back.querySelector('#nmSave').addEventListener('click', go);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  }

  function openProjectModal(project) {
    const editing = !!project;
    const back = openModal(`<h2>${editing ? 'Rename project' : 'New project'}</h2>
      <label>Name</label>
      <input type="text" id="pName" value="${esc(editing ? project.name : '')}" placeholder="e.g. CHARM Band" autocomplete="off">
      <label>Description <span class="muted" style="text-transform:none;font-weight:400">(optional)</span></label>
      <textarea id="pDesc" placeholder="What is this product?">${esc(editing && project.description ? project.description : '')}</textarea>
      <div class="err" id="pErr" style="display:none"></div>
      <div class="modal-actions"><button class="b ghost" data-modal-close>Cancel</button><button class="b" id="pSave">${editing ? 'Save' : 'Create'}</button></div>`);
    back.querySelector('#pName').focus();
    back.querySelector('#pSave').addEventListener('click', async () => {
      const name = back.querySelector('#pName').value.trim();
      const description = back.querySelector('#pDesc').value.trim();
      if (!name) { showErr(back, '#pErr', 'Name is required.'); return; }
      try {
        if (editing) {
          await api('PUT', '/api/costing/projects/' + project.id, { name, description, data: project.data });
          state.project.name = name; state.project.description = description;
          await loadProjects(project.id);
        } else {
          const created = await api('POST', '/api/costing/projects', { name, description, data: blankData() });
          await loadProjects(created.id);
        }
        closeModal(); render();
      } catch (e) { showErr(back, '#pErr', 'Save failed: ' + e.message); }
    });
  }
  function confirmDeleteProject() {
    const p = state.project;
    const back = openModal(`<h2>Delete project</h2>
      <p class="msub">Permanently delete <b>${esc(p.name)}</b> and all its BOM, options, variants and scenarios? This cannot be undone.</p>
      <div class="modal-actions"><button class="b ghost" data-modal-close>Cancel</button><button class="b danger" id="delGo">Delete</button></div>`);
    back.querySelector('#delGo').addEventListener('click', async () => {
      try { await api('DELETE', '/api/costing/projects/' + p.id); state.project = null; closeModal(); await loadProjects(); render(); }
      catch (e) { alert('Delete failed: ' + e.message); }
    });
  }
  function showErr(back, sel, msg) { const el = back.querySelector(sel); el.textContent = msg; el.style.display = 'block'; }

  // ---------- Option editor ----------
  let optDraft = null;
  function openOptionModal(id) {
    const data = D();
    optDraft = id ? clone(data.options.find((o) => o.id === id)) : { id: uid(), name: '', notes: '', mods: [] };
    renderOptionModal();
  }
  function renderOptionModal() {
    const data = D();
    const lineOpts = (sel) => {
      const out = [];
      (function walk(pid, depth) {
        data.bom.filter((l) => (l.parentId || null) === pid).forEach((l) => {
          out.push(`<option value="${esc(l.id)}"${sel === l.id ? ' selected' : ''}>${'— '.repeat(depth)}${esc(l.name || '(unnamed)')}</option>`);
          walk(l.id, depth + 1);
        });
      })(null, 0);
      return out.join('');
    };
    const tierCostInputs = (costs, kind) => `<div class="mod-costs">` + data.tiers.map((t) => `<div class="cc"><label>${esc(t.label)}</label><input type="text" inputmode="decimal" data-mc="${kind}" data-tier="${t.id}" value="${costs && costs[t.id] != null ? esc(costs[t.id]) : ''}" placeholder="$"></div>`).join('') + `</div>`;

    const modRows = optDraft.mods.map((m, i) => {
      const typeSel = `<select data-mod="type" data-i="${i}">
        ${['add', 'swap', 'remove', 'modify'].map((tp) => `<option value="${tp}"${m.type === tp ? ' selected' : ''}>${tp}</option>`).join('')}
      </select>`;
      let detail = '';
      if (m.type === 'add') {
        detail = `<label>New line name</label><input type="text" data-mod="lineName" data-i="${i}" value="${esc(m.line && m.line.name ? m.line.name : '')}" placeholder="e.g. BLE module">
          <label>Category</label><input type="text" data-mod="lineCat" data-i="${i}" value="${esc(m.line && m.line.category ? m.line.category : '')}">
          <label>Cost per tier</label>${tierCostInputs(m.line && m.line.costs, 'add')}`;
      } else if (m.type === 'swap') {
        detail = `<label>Replace which base line?</label><select data-mod="target" data-i="${i}">${lineOpts(m.targetBomId)}</select>
          <label>New line name</label><input type="text" data-mod="lineName" data-i="${i}" value="${esc(m.line && m.line.name ? m.line.name : '')}" placeholder="replacement component">
          <label>New cost per tier</label>${tierCostInputs(m.line && m.line.costs, 'swap')}`;
      } else if (m.type === 'remove') {
        detail = `<label>Remove which base line?</label><select data-mod="target" data-i="${i}">${lineOpts(m.targetBomId)}</select>`;
      } else if (m.type === 'modify') {
        detail = `<label>Modify which base line?</label><select data-mod="target" data-i="${i}">${lineOpts(m.targetBomId)}</select>
          <label>Override cost per tier</label>${tierCostInputs(m.costs, 'modify')}`;
      }
      return `<div class="mod-row"><div class="mod-top">${typeSel}<button class="icon-x" data-mod="del" data-i="${i}" title="Remove change">×</button></div>${detail}</div>`;
    }).join('');

    const back = openModal(`<h2>${optDraft.name ? 'Edit option' : 'New option'}</h2>
      <p class="msub">An option bundles BOM changes that apply when toggled on.</p>
      <label>Option name</label>
      <input type="text" id="oName" value="${esc(optDraft.name)}" placeholder="e.g. BLE, IP68, Extended battery" autocomplete="off">
      <label>Notes <span class="muted" style="text-transform:none;font-weight:400">(optional)</span></label>
      <input type="text" id="oNotes" value="${esc(optDraft.notes || '')}">
      <label>Changes</label>
      ${modRows || '<p class="hint">No changes yet — add one below.</p>'}
      <button class="b ghost sm add-mod" id="addMod">+ Add change</button>
      ${data.bom.length === 0 ? '<p class="hint">Tip: add base BOM lines first so swap/remove/modify have something to target.</p>' : ''}
      <div class="err" id="oErr" style="display:none"></div>
      <div class="modal-actions"><button class="b ghost" data-modal-close>Cancel</button><button class="b" id="oSave">Save option</button></div>`, true);

    // bind text inputs (persist into draft without re-render to keep focus)
    back.querySelector('#oName').addEventListener('input', (e) => { optDraft.name = e.target.value; });
    back.querySelector('#oNotes').addEventListener('input', (e) => { optDraft.notes = e.target.value; });
    back.querySelector('#addMod').addEventListener('click', () => { optDraft.mods.push({ type: 'add', line: { name: '', category: '', costs: {} } }); renderOptionModal(); });

    back.querySelectorAll('[data-mod]').forEach((elm) => {
      const i = +elm.dataset.i;
      const role = elm.dataset.mod;
      if (role === 'type') elm.addEventListener('change', (e) => { setModType(i, e.target.value); renderOptionModal(); });
      else if (role === 'del') elm.addEventListener('click', () => { optDraft.mods.splice(i, 1); renderOptionModal(); });
      else if (role === 'target') elm.addEventListener('change', (e) => { optDraft.mods[i].targetBomId = e.target.value; });
      else if (role === 'lineName') elm.addEventListener('input', (e) => { ensureLine(i).name = e.target.value; });
      else if (role === 'lineCat') elm.addEventListener('input', (e) => { ensureLine(i).category = e.target.value; });
    });
    back.querySelectorAll('[data-mc]').forEach((elm) => {
      elm.addEventListener('input', (e) => {
        const i = +elm.closest('.mod-row').querySelector('[data-mod="type"]').dataset.i;
        const tierId = elm.dataset.tier;
        const m = optDraft.mods[i];
        if (m.type === 'modify') { m.costs = m.costs || {}; m.costs[tierId] = num(e.target.value); }
        else { ensureLine(i).costs = ensureLine(i).costs || {}; ensureLine(i).costs[tierId] = num(e.target.value); }
      });
    });

    back.querySelector('#oSave').addEventListener('click', () => {
      if (!optDraft.name.trim()) { showErr(back, '#oErr', 'Option name is required.'); return; }
      // default targets for selects left untouched
      optDraft.mods.forEach((m, i) => {
        if ((m.type === 'swap' || m.type === 'remove' || m.type === 'modify') && !m.targetBomId) {
          const sel = back.querySelector(`select[data-mod="target"][data-i="${i}"]`);
          if (sel && sel.value) m.targetBomId = sel.value;
        }
      });
      const data2 = D();
      const idx = data2.options.findIndex((o) => o.id === optDraft.id);
      if (idx >= 0) data2.options[idx] = optDraft; else data2.options.push(optDraft);
      closeModal(); markDirty(); render();
    });
  }
  function setModType(i, type) {
    const m = optDraft.mods[i];
    m.type = type;
    if (type === 'add' || type === 'swap') { if (!m.line) m.line = { name: '', category: '', costs: {} }; }
    if (type === 'modify' && !m.costs) m.costs = {};
  }
  function ensureLine(i) { const m = optDraft.mods[i]; if (!m.line) m.line = { name: '', category: '', costs: {} }; return m.line; }

  boot();
})();
