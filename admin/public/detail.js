'use strict';

(function () {
  const data = JSON.parse(document.getElementById('session-data').textContent);
  const motion = data.motion || [];
  const altitude = data.altitude || [];

  // Accelerometer magnitude = sqrt(ax^2 + ay^2 + az^2)
  const accelLabels = motion.map((s) => (s.t / 1000).toFixed(1));
  const accelMag = motion.map((s) =>
    Math.sqrt((s.ax || 0) ** 2 + (s.ay || 0) ** 2 + (s.az || 0) ** 2)
  );

  const altLabels = altitude.map((s) => (s.t / 1000).toFixed(1));
  const altVals = altitude.map((s) => s.relative_altitude);

  const baseOpts = {
    animation: false,
    responsive: true,
    plugins: { legend: { display: false } },
    elements: { point: { radius: 0 } },
    scales: { x: { title: { display: true, text: 'seconds' } } },
  };

  if (window.Chart && accelMag.length) {
    new Chart(document.getElementById('accelChart'), {
      type: 'line',
      data: {
        labels: accelLabels,
        datasets: [{ data: accelMag, borderColor: '#4f8cff', borderWidth: 1, tension: 0.1 }],
      },
      options: baseOpts,
    });
  }

  if (window.Chart && altVals.length) {
    new Chart(document.getElementById('altChart'), {
      type: 'line',
      data: {
        labels: altLabels,
        datasets: [{ data: altVals, borderColor: '#34c759', borderWidth: 1, tension: 0.1 }],
      },
      options: baseOpts,
    });
  }

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
