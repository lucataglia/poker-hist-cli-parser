# Graph view daily detail + totals — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In `--view=graph`, print a per-day breakdown (one line per tournament: name, buy-in, prize pool, finish position, net) and a final totals summary (won ITM / lost / played / net €), before/around the existing bar chart.

**Architecture:** Extend the pure `parsePL` to also return finish position and prize pool. Add a `buildDailyDetail` aggregator that groups tournaments by day and computes overall totals. Add two renderers in helpers. Wire them into the graph branch of index.js. The existing chart (buildDailyPL/renderPLChart) is untouched.

**Tech Stack:** Node.js (CommonJS), `chalk@4`, `node:test`. No new npm dependencies.

## Global Constraints

- CommonJS, no new npm dependencies. ESLint airbnb-base must pass: `npx eslint src/ index.js test/`.
- Parsers pure: no console/argv/globals.
- Position: `<name> wins the tournament` → 1; `<name> finished the tournament in <N>th place` → N; else null.
- Prize pool = first `<anyone> wins the tournament and receives €X` in the file → X (number); null if absent. This is the 1st-place prize = the multiplier signature.
- A tournament is a "Spin&Go" iff prizePool !== null; otherwise labeled "torneo" and the `[montepremi]` field is omitted entirely.
- Net per tournament = hero prize − buy-in (already `parsePL().pl`). Green if ≥ 0, red if < 0.
- Buy-in from header `€A+€B EUR`, summed (already `parseBuyIn`). Display like `1€`.
- Totals: won = tournaments with prize>0 (ITM); lost = played − won; played = tournament count; netTotal = Σ net. Net colored green/red.
- Date display `DD Mmm YYYY` (reuse `formatDateLong` from helpers) for the day header.
- The existing bar chart output must be unchanged; the detail prints before it, the summary after.

---

### Task 1: parsePL returns position and prizePool

**Files:**
- Modify: `src/pl-parser.js`
- Test: `test/pl-parser.test.js` (append)

**Interfaces:**
- Consumes: nothing new.
- Produces: `parsePL(fileContent, playerName)` return object gains `position`
  (number 1/2/3… or null) and `prizePool` (number or null), alongside existing
  `prize`, `buyIn`, `pl`, `won`.

- [ ] **Step 1: Write the failing test**

Append to `test/pl-parser.test.js` (it already has `read`, `parsePL`, and the fixture name constants LOST/WON/CASHED_2ND):

```js
test('parsePL: reports finish position and prize pool', () => {
  // WON fixture: hero wins (1st); its receives line is the pool.
  const won = parsePL(read(WON), 'TestHero');
  assert.strictEqual(won.position, 1);
  assert.strictEqual(won.prizePool, won.prize, 'winner prize == pool');

  // CASHED_2ND fixture: hero 2nd; a villain wins with a receives line = pool.
  const second = parsePL(read(CASHED_2ND), 'TestHero');
  assert.strictEqual(second.position, 2);
  assert.ok(second.prizePool !== null && second.prizePool > 0, 'pool from winner line');

  // LOST fixture: hero busts; check position is a number and pool may be present.
  const lost = parsePL(read(LOST), 'TestHero');
  assert.ok(lost.position === null || typeof lost.position === 'number');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/pl-parser.test.js`
Expected: FAIL — `position`/`prizePool` undefined.

- [ ] **Step 3: Implement**

In `src/pl-parser.js`, add two helper functions and extend `parsePL`. The current
`parsePL` looks like:

```js
function parsePL(fileContent, playerName) {
  const buyIn = parseBuyIn(fileContent);
  const prize = parsePrize(fileContent, playerName);
  const won = parseWon(fileContent, playerName);
  return {
    prize, buyIn, pl: round2(prize - buyIn), won,
  };
}
```

Add above it:

```js
// Finish position: "<name> wins the tournament" -> 1; "<name> finished the
// tournament in <N>th place" -> N; null if neither present.
function parsePosition(fileContent, playerName) {
  const escaped = playerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`^${escaped} wins the tournament\\b`, 'm').test(fileContent)) {
    return 1;
  }
  const m = fileContent.match(new RegExp(`^${escaped} finished the tournament in (\\d+)`, 'm'));
  return m ? Number(m[1]) : null;
}

// Prize pool = 1st-place prize = the first "<anyone> wins the tournament and
// receives €X" in the file. null if absent (common when the hero busts 3rd and
// the tournament continues off the hero's table).
function parsePrizePool(fileContent) {
  const m = fileContent.match(/wins the tournament and receives €\s*(\d+(?:[.,]\d+)?)/);
  return m ? parseFloat(m[1].replace(',', '.')) : null;
}
```

Extend `parsePL`:

```js
function parsePL(fileContent, playerName) {
  const buyIn = parseBuyIn(fileContent);
  const prize = parsePrize(fileContent, playerName);
  const won = parseWon(fileContent, playerName);
  const position = parsePosition(fileContent, playerName);
  const prizePool = parsePrizePool(fileContent);
  return {
    prize, buyIn, pl: round2(prize - buyIn), won, position, prizePool,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/pl-parser.test.js`
Expected: PASS. If a fixture's actual position/pool differs, read the fixture and correct the TEST expectation to match reality — never fudge the parser.

- [ ] **Step 5: Lint**

Run: `npx eslint src/pl-parser.js test/pl-parser.test.js`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/pl-parser.js test/pl-parser.test.js
git commit -m "feat: parsePL reports finish position and prize pool"
```

---

### Task 2: buildDailyDetail aggregator

**Files:**
- Modify: `src/parse-files/sync.js`
- Test: `test/build-daily-detail.test.js`

**Interfaces:**
- Consumes: `parsePL` (now with position/prizePool), `extractTimeFromFilename`.
- Produces: `buildDailyDetail(directory, timeFilter, playerName) => { days, totals }`
  where `days` is `[{ date, tournaments: [{ buyIn, prizePool, position, net, isSpin }] }]`
  sorted chronologically (tournaments within a day in file-read order), and
  `totals` is `{ won, lost, played, netTotal }` (won = prize>0 count; lost =
  played − won; netTotal = round2 Σ net).

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/build-daily-detail.test.js`
Expected: FAIL — `buildDailyDetail is not a function`.

- [ ] **Step 3: Implement in `src/parse-files/sync.js`**

Add above `module.exports` (parsePL is already required at the top of the file):

```js
function buildDailyDetail(directory, timeFilter, playerName) {
  const filter = Number(timeFilter);
  const files = fs.readdirSync(directory)
    .filter((file) => file.startsWith('HH'))
    .filter((file) => {
      const time = extractTimeFromFilename(file);
      return time !== null && Number(time) >= filter;
    })
    .sort((a, b) => a.localeCompare(b));

  const byDay = new Map();
  let won = 0;
  let lost = 0;
  let played = 0;
  let netTotal = 0;

  files.forEach((filename) => {
    const date = extractTimeFromFilename(filename);
    const content = fs.readFileSync(path.join(directory, filename), 'utf8');
    const {
      pl, prize, position, prizePool, buyIn,
    } = parsePL(content, playerName);

    const tournament = {
      buyIn,
      prizePool,
      position,
      net: pl,
      isSpin: prizePool !== null,
    };

    const entry = byDay.get(date) || { date, tournaments: [] };
    entry.tournaments.push(tournament);
    byDay.set(date, entry);

    played += 1;
    if (prize > 0) { won += 1; } else { lost += 1; }
    netTotal = Math.round((netTotal + pl) * 100) / 100;
  });

  const days = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
  return {
    days, totals: {
      won, lost, played, netTotal,
    },
  };
}
```

`parsePL` already returns `buyIn`, so it is used directly for the per-tournament
buy-in (no separate parse). Add `buildDailyDetail` to `module.exports` (alongside parseAllOldFiles, buildDailyPL, buildAllInEV, buildShowdownSplit).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/build-daily-detail.test.js`
Expected: PASS. Full suite — all pass.

- [ ] **Step 5: Lint**

Run: `npx eslint src/parse-files/sync.js test/build-daily-detail.test.js`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/parse-files/sync.js test/build-daily-detail.test.js
git commit -m "feat: aggregate per-day tournament detail and overall totals"
```

---

### Task 3: renderDailyDetail and renderDailySummary

**Files:**
- Modify: `src/helpers/index.js`
- Test: `test/helpers.test.js` (append)

**Interfaces:**
- Consumes: `chalk`, `formatDateLong` (existing helper, `YYYYMMDD -> 'DD Mmm YYYY'`).
- Produces: `renderDailyDetail(days) => string` and `renderDailySummary(totals) => string`.
  `days`/`totals` shapes from Task 2.

- [ ] **Step 1: Write the failing test**

Append to `test/helpers.test.js`:

```js
const { renderDailyDetail, renderDailySummary } = require('../src/helpers');

test('renderDailyDetail: prints date header and one line per tournament', () => {
  const out = stripAnsi(renderDailyDetail([
    {
      date: '20260704',
      tournaments: [
        {
          buyIn: 1, prizePool: 8, position: 2, net: 1, isSpin: true,
        },
        {
          buyIn: 1, prizePool: null, position: 3, net: -1, isSpin: false,
        },
      ],
    },
  ]));
  assert.ok(out.includes('04 Jul 2026'), 'date header');
  assert.ok(/Spin&Go/.test(out), 'spin label when prizePool present');
  assert.ok(out.includes('[8'), 'prize pool shown for spin');
  assert.ok(/\btorneo\b/.test(out), 'torneo label when no prizePool');
  assert.ok(!/torneo.*\[/.test(out), 'no bracket for non-spin');
  assert.ok(out.includes('2') && out.includes('3'), 'positions shown');
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
  const chalk = require('chalk');
  const prev = chalk.level;
  chalk.level = 3;
  const raw = renderDailyDetail([{
    date: '20260704',
    tournaments: [{
      buyIn: 1, prizePool: 8, position: 1, net: 7, isSpin: true,
    }],
  }]);
  chalk.level = prev;
  // eslint-disable-next-line no-control-regex
  assert.ok(/\[32m/.test(raw), 'green for positive net');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/helpers.test.js`
Expected: FAIL — renderers not defined.

- [ ] **Step 3: Implement in `src/helpers/index.js`**

Add before `module.exports` (chalk and formatDateLong already exist above):

```js
// One line per tournament under each day header.
function renderDailyDetail(days) {
  if (!days || days.length === 0) {
    return '';
  }
  const lines = [];
  days.forEach((day) => {
    lines.push(chalk.bold(formatDateLong(day.date)));
    day.tournaments.forEach((t) => {
      const label = t.isSpin ? 'Spin&Go' : 'torneo';
      const pool = t.isSpin ? ` [${t.prizePool}€]` : '';
      const pos = t.position ? `${t.position}°` : '-';
      const netStr = `${t.net >= 0 ? '+' : ''}${t.net.toFixed(2)}€`;
      const netColored = t.net >= 0 ? chalk.green(netStr) : chalk.red(netStr);
      lines.push(`  ${label} ${t.buyIn}€${pool}  ${pos}  ${netColored}`);
    });
    lines.push('');
  });
  return lines.join('\n');
}

// Overall totals line.
function renderDailySummary(totals) {
  const {
    won, lost, played, netTotal,
  } = totals;
  const netStr = `${netTotal >= 0 ? '+' : ''}${netTotal.toFixed(2)}€`;
  const netColored = netTotal >= 0 ? chalk.green(netStr) : chalk.red(netStr);
  return `Vinti (ITM): ${won}   Persi: ${lost}   Giocate: ${played}   Netto: ${netColored}`;
}
```

Add both to `module.exports` (alphabetical: renderDailyDetail, renderDailySummary before renderEVSummary/renderPLChart).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/helpers.test.js`
Expected: PASS (all). Full suite — all pass.

- [ ] **Step 5: Lint**

Run: `npx eslint src/helpers/index.js test/helpers.test.js`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/helpers/index.js test/helpers.test.js
git commit -m "feat: renderers for daily tournament detail and totals summary"
```

---

### Task 4: Wire daily detail + summary into the graph view

**Files:**
- Modify: `index.js`
- Test: `test/view-selection.test.js` (append)

**Interfaces:**
- Consumes: `buildDailyDetail` (Task 2), `renderDailyDetail`, `renderDailySummary` (Task 3).
- Produces: graph view prints the daily detail before the chart and the totals summary after.

- [ ] **Step 1: Write the failing test**

Append to `test/view-selection.test.js`:

```js
test('--view=graph includes per-day detail and totals summary', () => {
  const out = runCli(['--view=graph']);
  assert.ok(/Spin&Go|torneo/.test(out), 'per-tournament rows present');
  assert.ok(out.includes('Giocate:'), 'totals summary present');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/view-selection.test.js`
Expected: FAIL — graph view has no detail/summary yet.

- [ ] **Step 3: Implement in `index.js`**

Update the require to add the three names:

```js
const {
  parseAllOldFiles, buildDailyPL, buildAllInEV, buildShowdownSplit, buildDailyDetail,
} = require('./src/parse-files/sync');
const {
  renderPLChart, renderEVSummary, renderDailyDetail, renderDailySummary,
} = require('./src/helpers');
```

In the `graph` branch of the dispatcher (currently):

```js
  if (view === 'graph') {
    const daily = buildDailyPL(directoryArgv, timeFilterArgv, name);
    console.log('\n');
    console.log(renderPLChart(daily));
    console.log('\n');
  }
```

replace with:

```js
  if (view === 'graph') {
    const detail = buildDailyDetail(directoryArgv, timeFilterArgv, name);
    const daily = buildDailyPL(directoryArgv, timeFilterArgv, name);
    console.log('\n');
    console.log(renderDailyDetail(detail.days));
    console.log(renderPLChart(daily));
    console.log('\n');
    console.log(renderDailySummary(detail.totals));
    console.log('\n');
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/view-selection.test.js`
Expected: PASS. Full suite `node --test` — all pass, no hang.

- [ ] **Step 5: Lint**

Run: `npx eslint src/ index.js test/`
Expected: exit 0.

- [ ] **Step 6: Manual smoke test**

Run (uses .env name + dir):
```bash
node index.js --view=graph --timestamp=20260704
```
Expected: for each day, a `DD Mmm YYYY` header followed by one `Spin&Go …`/`torneo …`
line per tournament with a colored net; then the existing bar chart; then a
`Vinti (ITM): … Persi: … Giocate: … Netto: …` summary line.

- [ ] **Step 7: Commit**

```bash
git add index.js test/view-selection.test.js
git commit -m "feat: show per-day tournament detail and totals in the graph view"
```

---

## Note per l'esecutore

- Do NOT change the existing bar chart (buildDailyPL/renderPLChart) or the detail/ev views.
- `parsePL` is the single source for buy-in, prize, net, position, prizePool — do not re-parse those elsewhere.
- Prize pool regex matches the FIRST `wins the tournament and receives €X` in the file; that is the 1st-place prize. When the hero wins, that line is the hero's own.
- Fixtures under `test/fixtures/` need `git add -f` if any are added (this plan adds none; it reuses existing fixtures LOST/WON/CASHED_2ND and the real HH fixtures).
- `formatDateLong` already exists in helpers (returns 'DD Mmm YYYY'); reuse it, do not reimplement.
