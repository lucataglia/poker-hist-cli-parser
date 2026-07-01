const test = require('node:test');
const assert = require('node:assert');
const { formatDateShortIt } = require('../src/helpers');

test('formatDateShortIt: formats YYYYMMDD to "DD Mmm" italian', () => {
  assert.strictEqual(formatDateShortIt('20260630'), '30 Giu');
  assert.strictEqual(formatDateShortIt('20260701'), '01 Lug');
  assert.strictEqual(formatDateShortIt('20260101'), '01 Gen');
  assert.strictEqual(formatDateShortIt('20261225'), '25 Dic');
});

test('formatDateShortIt: returns input unchanged when malformed', () => {
  assert.strictEqual(formatDateShortIt('nope'), 'nope');
});
