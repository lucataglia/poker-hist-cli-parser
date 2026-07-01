// test/build-daily-pl.test.js
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { buildDailyPL } = require('../src/parse-files/sync');

const FIXTURES = path.join(__dirname, 'fixtures');

test('buildDailyPL: groups per day with pl, game count, wins, itm, losses', () => {
  const data = buildDailyPL(FIXTURES, 20260101, 'TestHero');
  // fixture 1: 20260101, hero busts (no win, no cash) -> pl -1, loss
  // fixture 2: 20260102, hero wins the tournament and receives EUR -> pl +1, win + itm
  assert.deepStrictEqual(data, [
    {
      date: '20260101', pl: -1, games: 1, wins: 0, itm: 0, losses: 1,
    },
    {
      date: '20260102', pl: 1, games: 1, wins: 1, itm: 1, losses: 0,
    },
  ]);
});

test('buildDailyPL: timeFilter excludes earlier days', () => {
  const data = buildDailyPL(FIXTURES, 20260102, 'TestHero');
  assert.deepStrictEqual(data, [
    {
      date: '20260102', pl: 1, games: 1, wins: 1, itm: 1, losses: 0,
    },
  ]);
});
