const fs = require('fs');

// Minimal .env reader (no dependency): parses KEY=VALUE lines, ignores blanks
// and #-comments, trims whitespace. Returns {} when the file is absent.
function loadEnv(envPath) {
  let raw;
  try {
    raw = fs.readFileSync(envPath, { encoding: 'utf8' });
  } catch (err) {
    return {};
  }
  const out = {};
  raw.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }
    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      return;
    }
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key) {
      out[key] = value;
    }
  });
  return out;
}

module.exports = { loadEnv };
