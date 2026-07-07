const test = require('node:test');
const assert = require('node:assert');
const chalk = require('chalk');
const { formatDateShort, renderEVSummary, renderPLChart } = require('../src/helpers');

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

test('renderEVSummary: empty returns placeholder', () => {
  assert.strictEqual(
    renderEVSummary({
      count: 0, actualChips: 0, evChips: 0, avgEquity: 0,
    }),
    'No all-in showdowns found',
  );
});

test('renderEVSummary: shows counts, chips, luck and avg equity', () => {
  const out = stripAnsi(renderEVSummary({
    count: 42, actualChips: 8450, evChips: 7900, avgEquity: 0.532,
  }));
  assert.ok(out.includes('42'), 'shows count');
  assert.ok(out.includes('8450'), 'shows actual chips');
  assert.ok(out.includes('7900'), 'shows EV chips');
  assert.ok(out.includes('550'), 'shows luck = actual - ev');
  assert.ok(out.includes('53.2'), 'shows avg equity percent');
});

test('renderEVSummary: negative luck is colored red', () => {
  const prevLevel = chalk.level;
  chalk.level = 3; // force colors even without a TTY (e.g. under `node --test`)
  const raw = renderEVSummary({
    count: 10, actualChips: 100, evChips: 300, avgEquity: 0.4,
  });
  chalk.level = prevLevel;
  // Red foreground = 31. Luck is -200.
  // eslint-disable-next-line no-control-regex
  assert.ok(/\[31m/.test(raw), 'negative luck should be colored red (ANSI 31)');
});

test('renderEVSummary: shows period, tournaments, bb, ahead% and sample note', () => {
  const out = stripAnsi(renderEVSummary({
    count: 10,
    actualChips: 100,
    evChips: 300,
    avgEquity: 0.4,
    aheadCount: 4,
    actualBb: 12.5,
    evBb: 37.5,
    tournaments: 8,
    periodStart: '20260704',
    periodEnd: '20260706',
  }));
  assert.ok(out.includes('04 Jul 2026'), 'period start shown');
  assert.ok(out.includes('06 Jul 2026'), 'period end shown');
  assert.ok(out.includes('Tournaments'), 'tournaments row');
  assert.ok(out.includes('8'), 'tournaments count');
  assert.ok(out.includes('12.5'), 'actual bb');
  assert.ok(out.includes('37.5'), 'ev bb');
  assert.ok(/40%/.test(out), 'ahead% = 4/10 = 40%');
  assert.ok(/Small sample/i.test(out), 'sample note for count < 30');
});

test('renderEVSummary: single-day period has no arrow, and no note when count >= 30', () => {
  const out = stripAnsi(renderEVSummary({
    count: 50,
    actualChips: 100,
    evChips: 90,
    avgEquity: 0.55,
    aheadCount: 30,
    actualBb: 5,
    evBb: 4.5,
    tournaments: 20,
    periodStart: '20260704',
    periodEnd: '20260704',
  }));
  assert.ok(out.includes('04 Jul 2026'), 'single day shown');
  assert.ok(!out.includes('→'), 'no arrow for a single-day period');
  assert.ok(!/Small sample/i.test(out), 'no sample note when count >= 30');
});

test('renderEVSummary: shows showdown and non-showdown bb rows when present', () => {
  const out = stripAnsi(renderEVSummary({
    count: 10,
    actualChips: 100,
    evChips: 90,
    avgEquity: 0.5,
    aheadCount: 5,
    actualBb: 5,
    evBb: 4.5,
    tournaments: 8,
    periodStart: '20260704',
    periodEnd: '20260706',
    sdBb: 120.5,
    nonSdBb: -70.5,
  }));
  assert.ok(out.includes('Showdown (bb)'), 'showdown row');
  assert.ok(out.includes('120.5'), 'showdown value');
  assert.ok(out.includes('Non-showdown (bb)'), 'non-showdown row');
  assert.ok(out.includes('-70.5'), 'non-showdown value');
});

test('renderEVSummary: omits split rows when sd/nonSd absent', () => {
  const out = stripAnsi(renderEVSummary({
    count: 5,
    actualChips: 10,
    evChips: 10,
    avgEquity: 0.5,
  }));
  assert.ok(!out.includes('Non-showdown'), 'no split rows without data');
});

const { renderDailyDetail, renderDailySummary } = require('../src/helpers');

test('renderDailyDetail: prints date header and one aligned line per tournament', () => {
  const out = stripAnsi(renderDailyDetail([
    {
      date: '20260704',
      tournaments: [
        {
          buyIn: 1, prizePool: 8, position: 2, net: 1, tableSize: '3-max',
        },
        {
          buyIn: 1, prizePool: null, position: 3, net: -1, tableSize: '3-max',
        },
      ],
    },
  ]));
  assert.ok(out.includes('04 Jul 2026'), 'date header');
  assert.ok(/3-max/.test(out), 'table size label from header');
  assert.ok(!/Spin&Go|torneo/.test(out), 'no Spin&Go/torneo label anymore');
  assert.ok(out.includes('[8'), 'prize pool shown when present');
  // The no-prizePool row shows no bracket.
  const rows = out.split('\n').filter((l) => l.includes('3-max'));
  const noPoolRow = rows.find((l) => l.includes('3°'));
  assert.ok(!noPoolRow.includes('['), 'no bracket when prizePool absent');
  assert.ok(out.includes('2°') && out.includes('3°'), 'positions shown');
  // All tournament rows are padded to the same visible length (aligned output).
  assert.strictEqual(rows[0].length, rows[1].length, 'rows aligned to equal width');
});

test('renderDailyDetail: appends a per-day recap line after each day', () => {
  const out = stripAnsi(renderDailyDetail([
    {
      date: '20260704',
      tournaments: [
        // won €2 net (ITM), buyIn 1
        {
          buyIn: 1, prizePool: 8, position: 1, net: 2, tableSize: '3-max',
        },
        // lost buy-in (not ITM)
        {
          buyIn: 1, prizePool: null, position: 3, net: -1, tableSize: '3-max',
        },
      ],
    },
  ]));
  // Per-day recap: 1 won (ITM), 1 lost, 2 played, net +1.00
  assert.ok(/Vinti \(ITM\): 1\b/.test(out), 'per-day won count');
  assert.ok(/Persi: 1\b/.test(out), 'per-day lost count');
  assert.ok(/Giocate: 2\b/.test(out), 'per-day played count');
  assert.ok(out.includes('+1.00€'), 'per-day net total');
});

test('renderDailySummary: shows won/lost/played and net', () => {
  const out = stripAnsi(renderDailySummary({
    won: 43, lost: 79, played: 122, netTotal: -12.5,
  }));
  assert.ok(out.includes('43'), 'won');
  assert.ok(out.includes('79'), 'lost');
  assert.ok(out.includes('122'), 'played');
  assert.ok(out.includes('12.5'), 'net total');
});

test('renderDailyDetail: net colored (green positive, red negative)', () => {
  const prev = chalk.level;
  chalk.level = 3;
  const raw = renderDailyDetail([{
    date: '20260704',
    tournaments: [{
      buyIn: 1, prizePool: 8, position: 1, net: 7, tableSize: '3-max',
    }],
  }]);
  chalk.level = prev;
  // eslint-disable-next-line no-control-regex
  assert.ok(/\[32m/.test(raw), 'green for positive net');
});
