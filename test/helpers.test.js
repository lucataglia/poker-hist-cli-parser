const test = require('node:test');
const assert = require('node:assert');
const { formatDateShortIt, renderPLChart } = require('../src/helpers');

// eslint-disable-next-line no-control-regex
const stripAnsi = (s) => s.replace(/\[[0-9;]*m/g, '');

test('formatDateShortIt: formats YYYYMMDD to "DD Mmm" italian', () => {
  assert.strictEqual(formatDateShortIt('20260630'), '30 Giu');
  assert.strictEqual(formatDateShortIt('20260701'), '01 Lug');
  assert.strictEqual(formatDateShortIt('20260101'), '01 Gen');
  assert.strictEqual(formatDateShortIt('20261225'), '25 Dic');
});

test('formatDateShortIt: returns input unchanged when malformed', () => {
  assert.strictEqual(formatDateShortIt('nope'), 'nope');
});

test('renderPLChart: empty data returns placeholder', () => {
  assert.strictEqual(renderPLChart([]), 'Nessun dato');
});

test('renderPLChart: positive day bar is to the right of the axis', () => {
  const out = stripAnsi(renderPLChart([{ date: '20260630', pl: 3, games: 5 }], 8));
  const line = out.split('\n').find((l) => l.includes('30 Giu'));
  const axis = line.indexOf('│');
  const bar = line.indexOf('▓');
  assert.ok(axis !== -1 && bar > axis, 'bar should start after the axis');
  assert.ok(line.includes('3.00€'));
  assert.ok(line.includes('(5)'));
});

test('renderPLChart: negative day bar is to the left of the axis', () => {
  const out = stripAnsi(renderPLChart([{ date: '20260701', pl: -1, games: 10 }], 8));
  const line = out.split('\n').find((l) => l.includes('01 Lug'));
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
  const big = out.split('\n').find((l) => l.includes('30 Giu'));
  const barCount = (big.match(/▓/g) || []).length;
  assert.strictEqual(barCount, 8, 'max |pl| day fills maxBarWidth');
});
