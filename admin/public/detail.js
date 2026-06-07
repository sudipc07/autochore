'use strict';

(function () {
  const data = JSON.parse(document.getElementById('session-data').textContent);
  const fullMotion = data.motion || [];   // full resolution, for path reconstruction
  let motion = data.motion || [];
  let altitude = data.altitude || [];

  // Downsample for rendering only (raw data stays intact in CSV/JSON).
  const MAX_POINTS = 2000;
  function decimate(arr) {
    if (arr.length <= MAX_POINTS) return arr;
    const stride = Math.ceil(arr.length / MAX_POINTS);
    return arr.filter((_, i) => i % stride === 0);
  }
  motion = decimate(motion);
  altitude = decimate(altitude);

  const secs = (s) => (s.t / 1000).toFixed(1);
  const AXIS_COLORS = ['#ff6b6b', '#34c759', '#4f8cff']; // 3-axis

  const baseOpts = {
    animation: false,
    responsive: true,
    normalized: true,
    plugins: { legend: { display: true, labels: { boxWidth: 10, color: '#9aa0ab' } } },
    elements: { point: { radius: 0 } },
    scales: {
      x: { title: { display: true, text: 'seconds', color: '#9aa0ab' }, ticks: { color: '#9aa0ab', maxTicksLimit: 10 } },
      y: { ticks: { color: '#9aa0ab' } },
    },
  };

  function hasAny(keys) {
    return motion.some((s) => keys.some((k) => s[k] != null));
  }

  function hide(canvasId, noteId) {
    const c = document.getElementById(canvasId);
    const n = document.getElementById(noteId);
    if (c) c.style.display = 'none';
    if (n) n.style.display = 'block';
  }

  // Multi-line chart over `motion`, one line per key, with explicit labels.
  function axisChart(id, keys, labels, noteId) {
    const el = document.getElementById(id);
    if (!el || !window.Chart) return;
    if (noteId && !hasAny(keys)) { hide(id, noteId); return; }
    const x = motion.map(secs);
    const datasets = keys.map((k, i) => ({
      label: labels[i],
      data: motion.map((s) => (s[k] ?? null)),
      borderColor: AXIS_COLORS[i % AXIS_COLORS.length],
      borderWidth: 1,
      tension: 0.1,
      spanGaps: true,
    }));
    new Chart(el, { type: 'line', data: { labels: x, datasets }, options: baseOpts });
  }

  function lineChart(id, points, valueFn, color, label, noteId) {
    const el = document.getElementById(id);
    if (!el || !window.Chart) return;
    const vals = points.map(valueFn);
    if (noteId && !vals.some((v) => v != null)) { hide(id, noteId); return; }
    if (!points.length) return;
    new Chart(el, {
      type: 'line',
      data: { labels: points.map(secs), datasets: [{ label, data: vals, borderColor: color, borderWidth: 1, tension: 0.1, spanGaps: true }] },
      options: { ...baseOpts, plugins: { legend: { display: false } } },
    });
  }

  // Accelerometer: per-axis + magnitude
  axisChart('accelChart', ['ax', 'ay', 'az'], ['X', 'Y', 'Z']);
  lineChart('accelMagChart', motion,
    (s) => Math.sqrt((s.ax || 0) ** 2 + (s.ay || 0) ** 2 + (s.az || 0) ** 2),
    '#4f8cff', 'magnitude');

  // Gravity
  axisChart('gravChart', ['gravx', 'gravy', 'gravz'], ['X', 'Y', 'Z'], 'gravNote');

  // Gyroscope
  axisChart('gyroChart', ['gx', 'gy', 'gz'], ['X', 'Y', 'Z']);

  // Orientation (roll/pitch/yaw)
  axisChart('oriChart', ['roll', 'pitch', 'yaw'], ['Roll', 'Pitch', 'Yaw'], 'oriNote');

  // Magnetometer
  axisChart('magChart', ['mx', 'my', 'mz'], ['X', 'Y', 'Z'], 'magNote');

  // Heading
  lineChart('headingChart', motion, (s) => (s.heading ?? null), '#e0a93b', 'heading', 'headingNote');

  // Altitude
  lineChart('altChart', altitude, (s) => s.relative_altitude, '#34c759', 'altitude');

  // ---- Movement path (Pedestrian Dead Reckoning) ----
  renderPath(fullMotion);

  function renderPath(m) {
    const canvas = document.getElementById('pathCanvas');
    const note = document.getElementById('pathNote');
    if (!canvas || m.length < 50) { hidePath(); return; }

    const t = m.map((s) => s.t / 1000);
    const dur = t[t.length - 1] - t[0];
    const fs = dur > 0 ? m.length / dur : 0;
    if (fs <= 0) { hidePath(); return; }

    // accel magnitude, DC-removed, lightly smoothed
    const amag = m.map((s) => Math.sqrt((s.ax || 0) ** 2 + (s.ay || 0) ** 2 + (s.az || 0) ** 2));
    const mean = amag.reduce((a, b) => a + b, 0) / amag.length;
    const ac = amag.map((v) => v - mean);
    const sm = ac.map((_, i) => {
      let s = 0, n = 0;
      for (let k = Math.max(0, i - 2); k <= Math.min(ac.length - 1, i + 2); k++) { s += ac[k]; n++; }
      return s / n;
    });
    const std = Math.sqrt(sm.reduce((a, b) => a + b * b, 0) / sm.length) || 1;
    const thr = std * 0.6;
    const gap = Math.max(1, Math.round(0.30 * fs));

    // step peaks
    const peaks = [];
    for (let i = 1; i < sm.length - 1; i++) {
      if (sm[i] > thr && sm[i] >= sm[i - 1] && sm[i] > sm[i + 1] && (!peaks.length || i - peaks[peaks.length - 1] >= gap)) {
        peaks.push(i);
      }
    }
    if (peaks.length < 10) { hidePath(); return; }

    // heading: fusion yaw if present (forward-filled), else integrate gyro-z
    const hasYaw = m.some((s) => typeof s.yaw === 'number');
    let headingAt;
    if (hasYaw) {
      let last = 0;
      const yawF = m.map((s) => { if (typeof s.yaw === 'number') last = s.yaw; return last; });
      headingAt = (i) => (yawF[i] * Math.PI) / 180;
    } else {
      const cum = []; let acc = 0;
      for (let i = 0; i < m.length; i++) { acc += ((m[i].gz || 0) * Math.PI) / 180 / fs; cum.push(acc); }
      headingAt = (i) => cum[i];
    }

    // dead reckon (unwrap heading across steps)
    const L = 0.7;
    let x = 0, y = 0, prev = headingAt(peaks[0]);
    const xs = [0], ys = [0];
    for (const p of peaks) {
      let h = headingAt(p);
      while (h - prev > Math.PI) h -= 2 * Math.PI;
      while (h - prev < -Math.PI) h += 2 * Math.PI;
      prev = h;
      x += L * Math.cos(h); y += L * Math.sin(h);
      xs.push(x); ys.push(y);
    }

    // draw, fit-to-canvas with equal aspect
    canvas.style.display = '';
    if (note) note.style.display = 'none';
    canvas.style.width = '100%';
    const cw = canvas.clientWidth || 600, chh = 320;
    canvas.width = cw; canvas.height = chh;
    const ctx = canvas.getContext('2d');
    const pad = 30;
    const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
    const sx = (cw - 2 * pad) / Math.max(0.5, maxx - minx);
    const sy = (chh - 2 * pad) / Math.max(0.5, maxy - miny);
    const sc = Math.min(sx, sy);
    const ox = (cw - (maxx - minx) * sc) / 2 - minx * sc;
    const oy = (chh - (maxy - miny) * sc) / 2 - miny * sc;
    const px = (vx) => ox + vx * sc;
    const py = (vy) => chh - (oy + vy * sc); // flip y so "up" is up

    ctx.clearRect(0, 0, cw, chh);
    ctx.strokeStyle = '#4f8cff'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    ctx.beginPath();
    xs.forEach((vx, i) => { const X = px(vx), Y = py(ys[i]); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
    ctx.stroke();
    const dot = (vx, vy, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(px(vx), py(vy), 6, 0, 7); ctx.fill(); };
    dot(xs[0], ys[0], '#10b981');                    // start
    dot(xs[xs.length - 1], ys[ys.length - 1], '#ef4444'); // end
  }
  function hidePath() {
    const canvas = document.getElementById('pathCanvas');
    const note = document.getElementById('pathNote');
    if (canvas) canvas.style.display = 'none';
    if (note) note.style.display = 'block';
  }

  // Copy JSON (raw, full-resolution)
  const copyBtn = document.getElementById('copyJson');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(JSON.stringify(data.raw, null, 2));
        copyBtn.textContent = 'Copied!';
        setTimeout(() => (copyBtn.textContent = 'Copy JSON'), 1500);
      } catch (_) {
        copyBtn.textContent = 'Copy failed';
      }
    });
  }
})();
