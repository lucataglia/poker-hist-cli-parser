const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const FIXTURES = path.join(__dirname, 'fixtures');

function runCli(extraArgs) {
  const out = execFileSync('node', [
    path.join(ROOT, 'index.js'),
    '--name=TestHero',
    '--timestamp=20260101',
    `--dir=${FIXTURES}`,
    ...extraArgs,
  ], { encoding: 'utf8', cwd: ROOT });
  // eslint-disable-next-line no-control-regex
  return out.replace(/\[[0-9;]*m/g, '').replace(/\[[0-9]*[A-Z]/g, '');
}

test('--view=graph renders the daily chart, not the all-in detail', () => {
  const out = runCli(['--view=graph']);
  assert.ok(out.includes('30 Giu') || out.includes('01 Gen') || out.includes('02 Gen'),
    'chart should contain italian short dates');
  assert.ok(!out.includes('All-in ≥ 50% Equity'), 'should not show the detail stats box');
});

test('--view=detail renders the all-in detail view', () => {
  const out = runCli(['--view=detail']);
  assert.ok(out.includes('All-in ≥ 50% Equity'), 'should show the detail stats box');
});
