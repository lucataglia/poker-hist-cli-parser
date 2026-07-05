const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

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
  assert.ok(
    out.includes('01 Jan') || out.includes('02 Jan'),
    'chart should contain english short dates',
  );
  assert.ok(!out.includes('All-in ≥ 50% Equity'), 'should not show the detail stats box');
});

test('--view=detail renders the all-in detail view', () => {
  const out = runCli(['--view=detail']);
  assert.ok(out.includes('All-in ≥ 50% Equity'), 'should show the detail stats box');
});

test('--view=ev renders the all-in EV summary', () => {
  const out = runCli(['--view=ev']);
  assert.ok(out.includes('All-in EV summary'), 'shows the EV summary header');
  assert.ok(!out.includes('All-in ≥ 50% Equity'), 'not the detail stats box');
});

test('name is read from .env when --name is absent', () => {
  // Write a temp .env in the OS temp dir so the real project-root .env is never touched.
  // index.js honours POKER_ENV_PATH when set, so we pass it in the child env.
  const tmpEnv = path.join(os.tmpdir(), `poker-test-${process.pid}.env`);
  fs.writeFileSync(tmpEnv, 'PLAYER_NAME=TestHero\n');
  try {
    const out = execFileSync('node', [
      path.join(ROOT, 'index.js'),
      '--timestamp=20260101',
      `--dir=${FIXTURES}`,
      '--view=detail',
    ], {
      encoding: 'utf8',
      cwd: ROOT,
      env: { ...process.env, POKER_ENV_PATH: tmpEnv },
    })
      // eslint-disable-next-line no-control-regex
      .replace(/\[[0-9;]*m/g, '').replace(/\[[0-9]*[A-Z]/g, '');
    assert.ok(out.includes('All-in ≥ 50% Equity'), 'detail view ran using .env name');
  } finally {
    fs.rmSync(tmpEnv, { force: true });
  }
});
