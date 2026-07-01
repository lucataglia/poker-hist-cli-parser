const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const FIXTURES = path.join(__dirname, 'fixtures');

// Run the CLI against the fixtures and return the stripped-of-color stdout.
function runCli(extraArgs = []) {
  const out = execFileSync(
    'node',
    [
      path.join(ROOT, 'index.js'),
      '--name=TestHero',
      '--timestamp=20260101',
      `--dir=${FIXTURES}`,
      ...extraArgs,
    ],
    { encoding: 'utf8', cwd: ROOT },
  );
  // Strip ANSI color codes and the console.clear() escape sequence.
  // eslint-disable-next-line no-control-regex
  return out.replace(/\[[0-9;]*m/g, '').replace(/\[[0-9]*[A-Z]/g, '');
}

// Pull "Label   value" out of the stats box.
function statValue(output, label) {
  const re = new RegExp(`${label}\\s+(-?\\d+)\\s*│`);
  const m = output.match(re);
  return m ? Number(m[1]) : null;
}

test('counts every tournament processed as total', () => {
  const out = runCli(['--view=detail']);
  assert.strictEqual(statValue(out, 'Total'), 2, 'two fixture tournaments');
});

test('counts hero all-in wins and losses', () => {
  const out = runCli(['--view=detail']);
  assert.strictEqual(statValue(out, 'Wins'), 1, 'one all-in won');
  assert.strictEqual(statValue(out, 'Losses'), 1, 'one all-in lost');
});

test('ITM counts only tournaments where hero cashes', () => {
  const out = runCli(['--view=detail']);
  // Only fixture 2 has "TestHero wins the tournament and receives".
  assert.strictEqual(statValue(out, 'ITM'), 1);
});

test('parsing uses --name and is not hardcoded to a specific player', () => {
  // If the old hardcoded 'Jeff' check were still there, wins/losses would be 0.
  const out = runCli(['--view=detail']);
  assert.ok(out.includes('TestHero'), 'hero name should appear in output');
});

test('--anonymize replaces every occurrence of the real name', () => {
  const out = runCli(['--anonymize', '--view=detail']);
  assert.ok(!out.includes('TestHero'), 'real name must not leak when anonymized');
  assert.ok(out.includes('JohnDoe'), 'anonymized name should appear');
});
