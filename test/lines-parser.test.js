// test/lines-parser.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseShowdownSplit } = require('../src/lines-parser');

const FIXTURES = path.join(__dirname, 'fixtures', 'synthetic');
const read = (name) => fs.readFileSync(path.join(FIXTURES, name), 'utf8');
const SYNTH = "HH20260801 T2000000001 No Limit Hold'em €0,91 + €0,09.txt";

test('parseShowdownSplit: splits net chips into showdown vs non-showdown', () => {
  const r = parseShowdownSplit(read(SYNTH), 'TestHero');
  assert.strictEqual(r.hands, 3);
  assert.strictEqual(r.nonSdChips, 10, 'hand1 -10 + hand2 +20');
  assert.strictEqual(r.sdChips, 60, 'hand3 showdown win net +60');
});

test('parseShowdownSplit: converts to bb per hand (Level I bb=20)', () => {
  const r = parseShowdownSplit(read(SYNTH), 'TestHero');
  assert.strictEqual(r.nonSdBb, 0.5); // 10 / 20
  assert.strictEqual(r.sdBb, 3.0); // 60 / 20
});
