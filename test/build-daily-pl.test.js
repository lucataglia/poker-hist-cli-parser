// test/build-daily-pl.test.js
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { buildDailyPL } = require('../src/parse-files/sync');

const FIXTURES = path.join(__dirname, 'fixtures');

test('buildDailyPL: groups per day with pl and game count', () => {
  const data = buildDailyPL(FIXTURES, 20260101, 'TestHero');
  // fixture 1: 20260101, hero busts -> pl -1 ; fixture 2: 20260102, hero wins -> pl +1
  assert.deepStrictEqual(data, [
    { date: '20260101', pl: -1, games: 1 },
    { date: '20260102', pl: 1, games: 1 },
  ]);
});

test('buildDailyPL: timeFilter excludes earlier days', () => {
  const data = buildDailyPL(FIXTURES, 20260102, 'TestHero');
  assert.deepStrictEqual(data, [
    { date: '20260102', pl: 1, games: 1 },
  ]);
});
