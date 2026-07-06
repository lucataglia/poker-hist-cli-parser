// test/build-daily-detail.test.js
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { buildDailyDetail } = require('../src/parse-files/sync');

const FIXTURES = path.join(__dirname, 'fixtures');

test('buildDailyDetail: groups tournaments by day with per-tournament fields', () => {
  const { days, totals } = buildDailyDetail(FIXTURES, 0, 'TestHero');
  assert.ok(days.length > 0, 'has days');
  const t = days[0].tournaments[0];
  assert.ok('buyIn' in t && 'prizePool' in t && 'position' in t && 'net' in t && 'isSpin' in t);
  // totals consistency
  assert.strictEqual(totals.won + totals.lost, totals.played);
  assert.ok(Number.isFinite(totals.netTotal));
});

test('buildDailyDetail: isSpin true iff prizePool present', () => {
  const { days } = buildDailyDetail(FIXTURES, 0, 'TestHero');
  const all = days.flatMap((d) => d.tournaments);
  all.forEach((t) => {
    assert.strictEqual(t.isSpin, t.prizePool !== null);
  });
});
