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
  // 7 fixture tournaments (HH20260101 through HH20260105 + HH20260706 + HH20260707)
  assert.strictEqual(statValue(out, 'Total'), 7, 'seven fixture tournaments');
});

test('counts hero all-in wins and losses', () => {
  const out = runCli(['--view=detail']);
  // fixtures 2,3,4,5 hero wins the all-in; fixtures 1, 6, 7 hero loses
  assert.strictEqual(statValue(out, 'Wins'), 4, 'four all-ins won');
  assert.strictEqual(statValue(out, 'Losses'), 3, 'three all-ins lost');
});

test('ITM counts tournaments where hero cashes (win or placement)', () => {
  const out = runCli(['--view=detail']);
  // fixtures 2,3,4,5 (1st, receives) + fixture 6 (2nd, received €2) + fixture 7 (2nd, received €10) = 6.
  assert.strictEqual(statValue(out, 'ITM'), 6);
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

test('detail view counts a 2nd-place cash as ITM', () => {
  // Fixtures include two hero 2nd-place cashes (HH20260706, HH20260707).
  // Running over the full fixture range, ITM must be at least 2 (the placement cashes alone).
  const out = runCli(['--view=detail']);
  const itmVal = statValue(out, 'ITM');
  assert.ok(itmVal !== null, 'ITM row present');
  assert.ok(itmVal >= 2, `ITM should count the 2nd-place cashes, got ${itmVal}`);
});
