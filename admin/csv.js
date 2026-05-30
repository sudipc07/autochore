'use strict';

// Flatten a session's motion_samples into CSV text.
function motionSamplesToCSV(session) {
  const samples = Array.isArray(session.motion_samples) ? session.motion_samples : [];
  const cols = [
    't', 'ax', 'ay', 'az', 'gravx', 'gravy', 'gravz',
    'gx', 'gy', 'gz', 'roll', 'pitch', 'yaw',
    'qw', 'qx', 'qy', 'qz', 'mx', 'my', 'mz', 'magacc', 'heading',
  ];
  const lines = [cols.join(',')];
  for (const s of samples) {
    lines.push(cols.map((c) => (s[c] ?? '')).join(','));
  }
  return lines.join('\n');
}

module.exports = { motionSamplesToCSV };
