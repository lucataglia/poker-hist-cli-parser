const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadEnv } = require('../src/config');

function tmpEnv(contents) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'env-'));
  const p = path.join(dir, '.env');
  fs.writeFileSync(p, contents);
  return p;
}

test('loadEnv: parses KEY=VALUE lines', () => {
  const p = tmpEnv('PLAYER_NAME=Jeff81088\n');
  assert.deepStrictEqual(loadEnv(p), { PLAYER_NAME: 'Jeff81088' });
});

test('loadEnv: ignores blank lines and comments, trims', () => {
  const p = tmpEnv('# a comment\n\n  PLAYER_NAME = Jeff81088 \n');
  assert.deepStrictEqual(loadEnv(p), { PLAYER_NAME: 'Jeff81088' });
});

test('loadEnv: missing file returns empty object', () => {
  assert.deepStrictEqual(loadEnv('/no/such/file/.env'), {});
});
