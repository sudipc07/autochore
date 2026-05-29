'use strict';

// Flatten a session's motion_samples into CSV text.
function motionSamplesToCSV(session) {
  const samples = Array.isArray(session.motion_samples) ? session.motion_samples : [];
  const header = ['t_ms', 'ax', 'ay', 'az', 'gx', 'gy', 'gz', 'mx', 'my', 'mz'];
  const lines = [header.join(',')];

  for (const s of samples) {
    lines.push(
      [
        s.t,
        s.ax, s.ay, s.az,
        s.gx, s.gy, s.gz,
        s.mx ?? '', s.my ?? '', s.mz ?? '',
      ].join(',')
    );
  }
  return lines.join('\n');
}

module.exports = { motionSamplesToCSV };
