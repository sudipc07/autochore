'use strict';

(function () {
  const data = JSON.parse(document.getElementById('session-data').textContent);
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
