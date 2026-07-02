const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { buildAllInEV } = require('../src/parse-files/sync');

const FIXTURES = path.join(__dirname, 'fixtures');

test('buildAllInEV: aggregates spots across fixture files', () => {
  const totals = buildAllInEV(FIXTURES, 20260101, 'TestHero');
  // fixture 1 (lost, actual 0) + fixture 2 (won HU, actual 300) +
  // fixture 3 (3-way win, actual 600 = side 100 + main 500) +
  // fixture 4 (preflop HU win, actual 600) +
  // fixture 5 (excluded: 3-way with muck, FIX 3) = 4 spots.
  assert.strictEqual(totals.count, 4);
  assert.strictEqual(totals.actualChips, 1500);
  assert.ok(totals.avgEquity > 0 && totals.avgEquity < 1, 'avg equity is a fraction');
});

test('buildAllInEV: timeFilter excludes earlier files', () => {
  const totals = buildAllInEV(FIXTURES, 20260102, 'TestHero');
  // fixture 2 + fixture 3 + fixture 4 (fixture 5 excluded) = 3 spots
  assert.strictEqual(totals.count, 3);
  assert.strictEqual(totals.actualChips, 1500);
});
