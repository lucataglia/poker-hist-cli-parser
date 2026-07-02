const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { buildAllInEV } = require('../src/parse-files/sync');

const FIXTURES = path.join(__dirname, 'fixtures');

test('buildAllInEV: aggregates spots across fixture files', () => {
  const totals = buildAllInEV(FIXTURES, 20260101, 'TestHero');
  // fixture 1 (lost, actual 0) + fixture 2 (won, actual 300) = 2 spots.
  assert.strictEqual(totals.count, 2);
  assert.strictEqual(totals.actualChips, 300);
  assert.ok(totals.avgEquity > 0 && totals.avgEquity < 1, 'avg equity is a fraction');
});

test('buildAllInEV: timeFilter excludes earlier files', () => {
  const totals = buildAllInEV(FIXTURES, 20260102, 'TestHero');
  assert.strictEqual(totals.count, 1); // only fixture 2
  assert.strictEqual(totals.actualChips, 300);
});
