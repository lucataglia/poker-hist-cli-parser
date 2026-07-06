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
// FIX 1: 3-way all-in hero wins from both main and side pot (two 'collected' lines)
const MULTIWAY_WIN = "HH20260103 T1000000003 No Limit Hold'em €0,91 + €0,09.txt";
// FIX 2: hero is all-in preflop, villain redundantly shows as all-in on flop
const HERO_PREFLOP_ALLIN = "HH20260104 T1000000004 No Limit Hold'em €0,91 + €0,09.txt";
// FIX 3: 3-way all-in where one villain mucks (incomplete info)
const MUCK_3WAY = "HH20260105 T1000000005 No Limit Hold'em €0,91 + €0,09.txt";

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

// FIX 1: multiway all-in where hero collects from side pot AND main pot
test('parseAllInEV: hero collects from side pot + main pot -> actual = sum of both', () => {
  const { spots } = parseAllInEV(read(MULTIWAY_WIN), 'TestHero');
  assert.strictEqual(spots.length, 1);
  // Hero collects 100 from side pot + 500 from main pot = 600
  assert.strictEqual(spots[0].actual, 600);
  assert.strictEqual(spots[0].pot, 700);
});

// FIX 2: hero is all-in preflop; villain also hits an all-in line on the flop
// -> board snapshot must be taken at the HERO's first all-in (preflop = empty board)
test('parseAllInEV: hero all-in preflop, later villain all-in line on flop -> board is empty (preflop equity)', () => {
  const { spots } = parseAllInEV(read(HERO_PREFLOP_ALLIN), 'TestHero');
  assert.strictEqual(spots.length, 1);
  // KsKc vs 7h6h preflop: equity should be ~0.70-0.80 (pair vs two-overcards)
  // If board were snapshotted at flop [2d 8h Ah] equity would be much lower (~0.35)
  assert.ok(spots[0].equity > 0.65, `equity ${spots[0].equity} should be preflop (>0.65)`);
});

// FIX 3: 3-way all-in where one villain mucks -> spot must be excluded (can't compute equity)
test('parseAllInEV: 3-way all-in with one muck -> spot excluded (0 spots)', () => {
  const { spots } = parseAllInEV(read(MUCK_3WAY), 'TestHero');
  // Villain2 mucks: we can't correctly compute equity without all revealed cards
  assert.strictEqual(spots.length, 0);
});

test('parseAllInEV: spot carries the hand big blind and bb/ahead aggregates', () => {
  // Fixture 6 is a Level V (40/80) hand: bb = 80. Hero all-in preflop, equity ~0.18,
  // pot 300, actual 0 (lost). One spot.
  const CASHED_2ND = "HH20260706 T1000000006 No Limit Hold'em €0,91 + €0,09.txt";
  const { spots, totals } = parseAllInEV(read(CASHED_2ND), 'TestHero');
  assert.strictEqual(spots.length, 1);
  assert.strictEqual(spots[0].bb, 80, 'bb parsed from Level (40/80)');
  // ahead: equity < 0.5 here, so aheadCount 0.
  assert.strictEqual(totals.aheadCount, 0);
  // actualBb = 0 (lost); evBb = round1(equity*pot / bb) summed.
  assert.strictEqual(totals.actualBb, 0);
  assert.ok(totals.evBb > 0, 'evBb positive');
});
