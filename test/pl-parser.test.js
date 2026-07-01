// test/pl-parser.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parsePL } = require('../src/pl-parser');

const FIXTURES = path.join(__dirname, 'fixtures');
const read = (name) => fs.readFileSync(path.join(FIXTURES, name), 'utf8');

const LOST = "HH20260101 T1000000001 No Limit Hold'em €0,91 + €0,09.txt";
const WON = "HH20260102 T1000000002 No Limit Hold'em €0,91 + €0,09.txt";

test('parsePL: hero busts without cashing -> pl = -buyIn, not won', () => {
  const r = parsePL(read(LOST), 'TestHero');
  assert.strictEqual(r.prize, 0);
  assert.strictEqual(r.buyIn, 1);
  assert.strictEqual(r.pl, -1);
  assert.strictEqual(r.won, false);
});

test('parsePL: hero wins tournament -> prize counted, pl positive, won', () => {
  const r = parsePL(read(WON), 'TestHero');
  assert.strictEqual(r.prize, 2);
  assert.strictEqual(r.buyIn, 1);
  assert.strictEqual(r.pl, 1);
  assert.strictEqual(r.won, true);
});

test('parsePL: buy-in parsed from header, not hardcoded', () => {
  const content = "PokerStars Hand #1: Tournament #9, €0.46+€0.04 EUR Hold'em No Limit\n";
  const r = parsePL(content, 'TestHero');
  assert.strictEqual(r.buyIn, 0.5);
  assert.strictEqual(r.prize, 0);
  assert.strictEqual(r.pl, -0.5);
});

test('parsePL: integer prize amount without decimals is parsed', () => {
  const content = "PokerStars Hand #1: Tournament #9, €0.91+€0.09 EUR Hold'em No Limit\nTestHero wins the tournament and receives €2 - congratulations!\n";
  const r = parsePL(content, 'TestHero');
  assert.strictEqual(r.prize, 2);
});

test('parsePL: three-part (bounty/PKO) buy-in sums all parts', () => {
  const content = "PokerStars Hand #1: Tournament #9, €4.60+€4.60+€0.80 EUR Hold'em No Limit\n";
  const r = parsePL(content, 'TestHero');
  assert.strictEqual(r.buyIn, 10);
});
