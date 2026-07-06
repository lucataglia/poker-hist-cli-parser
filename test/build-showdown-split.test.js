// test/build-showdown-split.test.js
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { buildShowdownSplit } = require('../src/parse-files/sync');

const FIXTURES = path.join(__dirname, 'fixtures');

test('buildShowdownSplit: aggregates split across files', () => {
  const r = buildShowdownSplit(FIXTURES, 0, 'TestHero');
  assert.ok(r.hands > 0, 'counted hands');
  // Identity: sd + nonsd chips = total net chips (finite number).
  assert.ok(Number.isFinite(r.sdChips) && Number.isFinite(r.nonSdChips));
  assert.ok(typeof r.sdBb === 'number' && typeof r.nonSdBb === 'number');
});
