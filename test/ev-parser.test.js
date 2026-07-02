// test/ev-parser.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseAllInEV } = require('../src/ev-parser');

const FIXTURES = path.join(__dirname, 'fixtures');
const read = (name) => fs.readFileSync(path.join(FIXTURES, name), 'utf8');

const LOST = "HH20260101 T1000000001 No Limit Hold'em €0,91 + €0,09.txt";
const WON = "HH20260102 T1000000002 No Limit Hold'em €0,91 + €0,09.txt";

test('parseAllInEV: hero all-in preflop lost at showdown -> one spot, actual 0', () => {
  const { spots, totals } = parseAllInEV(read(LOST), 'TestHero');
  assert.strictEqual(spots.length, 1);
  const spot = spots[0];
  // Qs4d vs 4cAh preflop: hero equity ~0.24-0.28.
  assert.ok(spot.equity > 0.2 && spot.equity < 0.32, `equity ${spot.equity} in range`);
  assert.strictEqual(spot.pot, 600); // Total pot 600 in fixture 1
  assert.strictEqual(spot.actual, 0); // hero lost, collected nothing
  assert.strictEqual(totals.count, 1);
});

test('parseAllInEV: hero all-in won at showdown -> actual = collected pot', () => {
  const { spots, totals } = parseAllInEV(read(WON), 'TestHero');
  assert.strictEqual(spots.length, 1);
  const spot = spots[0];
  // AhKh vs QdQs preflop: hero equity ~0.45-0.50 (slightly under a pair).
  assert.ok(spot.equity > 0.4 && spot.equity < 0.55, `equity ${spot.equity} in range`);
  assert.strictEqual(spot.pot, 300); // Total pot 300 in fixture 2
  assert.strictEqual(spot.actual, 300); // hero collected 300
  assert.strictEqual(totals.count, 1);
  assert.strictEqual(totals.actualChips, 300);
});

test('parseAllInEV: no all-in showdown -> empty', () => {
  const content = 'PokerStars Hand #1: Tournament #9\n*** HOLE CARDS ***\nTestHero: folds\n*** SUMMARY ***\n';
  const { spots, totals } = parseAllInEV(content, 'TestHero');
  assert.strictEqual(spots.length, 0);
  assert.strictEqual(totals.count, 0);
  assert.strictEqual(totals.avgEquity, 0);
});
