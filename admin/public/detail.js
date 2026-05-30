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
  const AXIS_COLORS = ['#ff6b6b', '#34c759', '#4f8cff']; // X, Y, Z

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

  function axisChart(id, keys) {
    const el = document.getElementById(id);
    if (!el || !window.Chart) return false;
    const labels = motion.map(secs);
    const datasets = keys.map((k, i) => ({
      label: k.toUpperCase().slice(1), // ax -> X
      data: motion.map((s) => (s[k] ?? null)),
      borderColor: AXIS_COLORS[i],
      borderWidth: 1,
      tension: 0.1,
      spanGaps: true,
    }));
    new Chart(el, { type: 'line', data: { labels, datasets }, options: baseOpts });
    return true;
  }

  function lineChart(id, points, valueFn, color, label) {
    const el = document.getElementById(id);
    if (!el || !window.Chart || !points.length) return;
    new Chart(el, {
      type: 'line',
      data: {
        labels: points.map(secs),
        datasets: [{ label, data: points.map(valueFn), borderColor: color, borderWidth: 1, tension: 0.1 }],
      },
      options: { ...baseOpts, plugins: { legend: { display: false } } },
    });
  }

  // Accelerometer: per-axis + magnitude
  axisChart('accelChart', ['ax', 'ay', 'az']);
  lineChart('accelMagChart', motion,
    (s) => Math.sqrt((s.ax || 0) ** 2 + (s.ay || 0) ** 2 + (s.az || 0) ** 2),
    '#4f8cff', 'magnitude');

  // Gyroscope: per-axis
  axisChart('gyroChart', ['gx', 'gy', 'gz']);

  // Magnetometer: per-axis (may be empty for older sessions)
  const hasMag = motion.some((s) => s.mx != null);
  if (hasMag) {
    axisChart('magChart', ['mx', 'my', 'mz']);
  } else {
    const c = document.getElementById('magChart');
    const n = document.getElementById('magNote');
    if (c) c.style.display = 'none';
    if (n) n.style.display = 'block';
  }

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
