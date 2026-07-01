const test = require('node:test');
const assert = require('node:assert');
const chalk = require('chalk');
const { formatDateShort, renderPLChart } = require('../src/helpers');

// eslint-disable-next-line no-control-regex
const stripAnsi = (s) => s.replace(/\[[0-9;]*m/g, '');

test('formatDateShort: formats YYYYMMDD to "DD Mmm" english', () => {
  assert.strictEqual(formatDateShort('20260630'), '30 Jun');
  assert.strictEqual(formatDateShort('20260701'), '01 Jul');
  assert.strictEqual(formatDateShort('20260101'), '01 Jan');
  assert.strictEqual(formatDateShort('20261225'), '25 Dec');
});

test('formatDateShort: returns input unchanged when malformed', () => {
  assert.strictEqual(formatDateShort('nope'), 'nope');
});

test('renderPLChart: empty data returns placeholder', () => {
  assert.strictEqual(renderPLChart([]), 'Nessun dato');
});

test('renderPLChart: first line is a legend', () => {
  const out = stripAnsi(renderPLChart([{
    date: '20260630', pl: 3, games: 5, wins: 2, itm: 3, losses: 3,
  }], 8));
  const legend = out.split('\n')[0];
  assert.ok(/\bLegend\b/.test(legend), 'legend header is in english');
  assert.ok(/W\(ITM\) L/.test(legend), 'legend shows the W(ITM) L shape');
});

test('renderPLChart: positive day bar is to the right of the axis', () => {
  const raw = renderPLChart([{
    date: '20260630', pl: 3, games: 5, wins: 2, itm: 3, losses: 3,
  }], 8);
  const out = stripAnsi(raw);
  const line = out.split('\n').find((l) => l.includes('30 Jun'));
  const axis = line.indexOf('│');
  const bar = line.indexOf('▓');
  assert.ok(axis !== -1 && bar > axis, 'bar should start after the axis');
  assert.ok(line.includes('3.00€'));
  // Record shows W(ITM) L bare numbers (legend explains the colors) and the game
  // count, both left of the axis, right after the date. ITM is a subset of W.
  assert.ok(line.includes('[2(3) 3]'), 'shows the W(ITM) L numbers');
  assert.ok(line.includes('(5)'), 'shows the game count');
  assert.ok(line.indexOf('[2(3) 3]') < axis, 'record is left of the axis');
  assert.ok(line.indexOf('(5)') < axis, 'game count is left of the axis');
  // The value column no longer carries the game count on the right.
  assert.ok(!line.includes('€ (5)'), 'game count is not repeated on the right');
});

test('renderPLChart: colors the record numbers (W green, ITM blue, L red)', () => {
  const prevLevel = chalk.level;
  chalk.level = 3; // force colors even without a TTY (e.g. under `node --test`)
  const raw = renderPLChart([{
    date: '20260630', pl: 3, games: 5, wins: 2, itm: 3, losses: 3,
  }], 8);
  chalk.level = prevLevel;
  // Record numbers carry ANSI color codes. Green = 32, bright blue = 94, red = 31.
  // eslint-disable-next-line no-control-regex
  assert.ok(/\[32m2\[39m/.test(raw), 'W number (2) is green');
  // eslint-disable-next-line no-control-regex
  assert.ok(/\[94m3\[39m/.test(raw), 'ITM number (3) is bright blue');
  // eslint-disable-next-line no-control-regex
  assert.ok(/\[31m3\[39m/.test(raw), 'L number (3) is red');
  // Legend on the first line colors the three labels the same way.
  const legend = raw.split('\n')[0];
  // eslint-disable-next-line no-control-regex
  assert.ok(/\[32mW\[39m/.test(legend), 'legend W is green');
  // eslint-disable-next-line no-control-regex
  assert.ok(/\[94mITM\[39m/.test(legend), 'legend ITM is bright blue');
  // eslint-disable-next-line no-control-regex
  assert.ok(/\[31mL\[39m/.test(legend), 'legend L is red');
});

test('renderPLChart: negative day bar is to the left of the axis', () => {
  const out = stripAnsi(renderPLChart([{ date: '20260701', pl: -1, games: 10 }], 8));
  const line = out.split('\n').find((l) => l.includes('01 Jul'));
  const axis = line.indexOf('│');
  const firstBar = line.indexOf('▓');
  assert.ok(firstBar !== -1 && firstBar < axis, 'bar should end before the axis');
  assert.ok(line.includes('-1.00€'));
});

test('renderPLChart: largest magnitude uses full bar width', () => {
  const out = stripAnsi(renderPLChart([
    { date: '20260630', pl: 4, games: 5 },
    { date: '20260701', pl: -1, games: 3 },
  ], 8));
  const big = out.split('\n').find((l) => l.includes('30 Jun'));
  const barCount = (big.match(/▓/g) || []).length;
  assert.strictEqual(barCount, 8, 'max |pl| day fills maxBarWidth');
});
