# All-in EV summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `--view=ev` view that reports all-in results stripped of luck: actual chips won vs expected chips (equity × pot) at the moment of the all-in, aggregated over the tournaments in the `--timestamp` range.

**Architecture:** A new pure parser `src/ev-parser.js` scans each hand, detects hero all-ins that reach showdown with revealed cards, reconstructs the board visible at the all-in moment, computes hero equity with `poker-odds-calc`, and returns per-spot `{equity, pot, actual}` plus totals. `sync.js` aggregates across files; `helpers` renders a summary box; `index.js` dispatches the new view. detail and graph views are untouched.

**Tech Stack:** Node.js (CommonJS), `poker-odds-calc` (equity, already a dependency), `chalk@4` (already present), `node:test`. No new dependencies.

## Global Constraints

- CommonJS (`require`/`module.exports`), no ESM.
- No new npm dependencies.
- ESLint airbnb-base must pass: `npx eslint src/ index.js test/`.
- `parseAllInEV` is pure: no `console.log`, no `argv`, no global state.
- Equity is a fraction 0..1 computed as `(winPct + tiePct / 2) / 100` (split pots count half).
- Board at the all-in moment: preflop = no board, flop all-in = 3 cards, turn all-in = 4 cards. NOT the full river board.
- Only hero all-ins that reach `*** SHOW DOWN ***` with revealed cards for all involved players are counted (wins AND losses).
- `pot` = first integer after `Total pot`. `actual` = integer after `<player> ... collected`, else 0.
- Output declares "showdown hands only". Empty → "No all-in showdowns found".

---

### Task 1: Pure per-hand EV parser (`parseAllInEV`)

**Files:**
- Create: `src/ev-parser.js`
- Test: `test/ev-parser.test.js`

**Interfaces:**
- Consumes: `poker-odds-calc` (`TexasHoldem`).
- Produces: `parseAllInEV(fileContent, playerName) => { spots, totals }` where
  `spots` is `Array<{ equity: number, pot: number, actual: number }>` (equity 0..1),
  and `totals` is `{ count: number, actualChips: number, evChips: number, avgEquity: number }`.
  `evChips` = sum of `equity * pot` rounded to integer; `avgEquity` = mean of spot equities (0..1), 0 when count is 0.

- [ ] **Step 1: Write the failing test**

```js
// test/ev-parser.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseAllInEV } = require('../src/ev-parser');

const FIXTURES = path.join(__dirname, 'fixtures');
const read = (name) => fs.readFileSync(path.join(FIXTURES, name), 'utf8');

const LOST = "HH20260101 T1000000001 No Limit Hold'em €0,91 + €0,09.txt";
const WON = "HH20260102 T1000000002 No Limit Hold'em €0,91 + €0,09.txt";

test('parseAllInEV: hero all-in preflop lost at showdown -> one spot, actual 0', () => {
  const { spots, totals } = parseAllInEV(read(LOST), 'TestHero');
  assert.strictEqual(spots.length, 1);
  const spot = spots[0];
  // Qs4d vs 4cAh preflop: hero equity ~0.24-0.28.
  assert.ok(spot.equity > 0.2 && spot.equity < 0.32, `equity ${spot.equity} in range`);
  assert.strictEqual(spot.pot, 520); // Total pot 520 in fixture 1
  assert.strictEqual(spot.actual, 0); // hero lost, collected nothing
  assert.strictEqual(totals.count, 1);
});

test('parseAllInEV: hero all-in won at showdown -> actual = collected pot', () => {
  const { spots, totals } = parseAllInEV(read(WON), 'TestHero');
  assert.strictEqual(spots.length, 1);
  const spot = spots[0];
  // AhKh vs QdQs preflop: hero equity ~0.45-0.50 (slightly under a pair).
  assert.ok(spot.equity > 0.4 && spot.equity < 0.55, `equity ${spot.equity} in range`);
  assert.strictEqual(spot.pot, 300); // Total pot 300 in fixture 2
  assert.strictEqual(spot.actual, 300); // hero collected 300
  assert.strictEqual(totals.count, 1);
  assert.strictEqual(totals.actualChips, 300);
});

test('parseAllInEV: no all-in showdown -> empty', () => {
  const content = "PokerStars Hand #1: Tournament #9\n*** HOLE CARDS ***\nTestHero: folds\n*** SUMMARY ***\n";
  const { spots, totals } = parseAllInEV(content, 'TestHero');
  assert.strictEqual(spots.length, 0);
  assert.strictEqual(totals.count, 0);
  assert.strictEqual(totals.avgEquity, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/ev-parser.test.js`
Expected: FAIL — `Cannot find module '../src/ev-parser'`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/ev-parser.js
const { TexasHoldem } = require('poker-odds-calc');

const round = (n) => Math.round(n);

// Extract the board visible at the moment of the LAST all-in in the hand.
// Streets appear as "*** FLOP *** [a b c]", "*** TURN *** [a b c] [d]",
// "*** RIVER *** [a b c d] [e]". The board known when the all-in happens is
// the board of the street on which the last "is all-in" line sits.
function boardAtAllIn(lines) {
  let currentBoard = [];
  let boardAtLastAllIn = null;
  lines.forEach((row) => {
    const flop = row.match(/^\*\*\* FLOP \*\*\* \[([^\]]+)\]/);
    const turn = row.match(/^\*\*\* TURN \*\*\* \[([^\]]+)\] \[([^\]]+)\]/);
    const river = row.match(/^\*\*\* RIVER \*\*\* \[([^\]]+)\] \[([^\]]+)\]/);
    if (flop) {
      currentBoard = flop[1].split(' ');
    } else if (turn) {
      currentBoard = [...turn[1].split(' '), turn[2]];
    } else if (river) {
      currentBoard = [...river[1].split(' '), river[2]];
    }
    if (row.includes('is all-in')) {
      boardAtLastAllIn = [...currentBoard];
    }
  });
  return boardAtLastAllIn;
}

// Parse one hand's text. Returns a spot or null.
function parseHandSpot(handText, playerName) {
  if (!handText.includes('is all-in') || !handText.includes('*** SHOW DOWN ***')) {
    return null;
  }
  const lines = handText.split('\n');

  // Hero must be involved in an all-in.
  const heroAllIn = lines.some((r) => r.startsWith(`${playerName}:`) && r.includes('is all-in'));
  if (!heroAllIn) {
    return null;
  }

  // Collect shown cards per player from "<name>: shows [a b]".
  const shown = {};
  lines.forEach((row) => {
    const m = row.match(/^(.+?): shows \[([^\]]+)\]/);
    if (m) {
      shown[m[1]] = m[2].split(' ');
    }
  });
  // Need hero + at least one villain shown.
  if (!shown[playerName] || Object.keys(shown).length < 2) {
    return null;
  }

  const potMatch = handText.match(/Total pot (\d+)/);
  const pot = potMatch ? Number(potMatch[1]) : 0;

  const escaped = playerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const collectedMatch = handText.match(new RegExp(`^${escaped}\\b.*collected (\\d+)`, 'm'));
  const actual = collectedMatch ? Number(collectedMatch[1]) : 0;

  const board = boardAtAllIn(lines) || [];

  const table = new TexasHoldem();
  const names = Object.keys(shown);
  names.forEach((n) => { table.addPlayer(shown[n]); });
  if (board.length > 0) {
    table.setBoard(board);
  }

  const result = table.calculate().getPlayers();
  const heroIndex = names.indexOf(playerName);
  const heroResult = result[heroIndex];
  const equity = (heroResult.getWinsPercentage() + heroResult.getTiesPercentage() / 2) / 100;

  return { equity, pot, actual };
}

function parseAllInEV(fileContent, playerName) {
  const hands = fileContent.split('PokerStars Hand');
  const spots = [];
  hands.forEach((h) => {
    const spot = parseHandSpot(h, playerName);
    if (spot) {
      spots.push(spot);
    }
  });

  const count = spots.length;
  const actualChips = spots.reduce((s, x) => s + x.actual, 0);
  const evChips = round(spots.reduce((s, x) => s + x.equity * x.pot, 0));
  const avgEquity = count === 0 ? 0 : spots.reduce((s, x) => s + x.equity, 0) / count;

  return {
    spots,
    totals: {
      count, actualChips, evChips, avgEquity,
    },
  };
}

module.exports = { parseAllInEV };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/ev-parser.test.js`
Expected: PASS (3 tests). If an equity assertion is just outside the range, read the actual printed value and widen the range in the test to bracket it — do not change the formula.

- [ ] **Step 5: Lint**

Run: `npx eslint src/ev-parser.js test/ev-parser.test.js`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/ev-parser.js test/ev-parser.test.js
git commit -m "feat: add pure all-in EV parser (equity vs actual chips at showdown)"
```

---

### Task 2: EV summary renderer (`renderEVSummary`)

**Files:**
- Modify: `src/helpers/index.js` (add function + export)
- Test: `test/helpers.test.js` (append)

**Interfaces:**
- Consumes: `chalk`.
- Produces: `renderEVSummary(totals) => string` where `totals` is
  `{ count, actualChips, evChips, avgEquity }`. Shows count, actual, EV, luck
  (`actualChips - evChips`, green if >= 0 else red), and avg equity as a percent.
  When `count === 0` returns `'No all-in showdowns found'`.

- [ ] **Step 1: Write the failing test**

```js
// append to test/helpers.test.js
const { renderEVSummary } = require('../src/helpers');

test('renderEVSummary: empty returns placeholder', () => {
  assert.strictEqual(
    renderEVSummary({ count: 0, actualChips: 0, evChips: 0, avgEquity: 0 }),
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
  const raw = renderEVSummary({
    count: 10, actualChips: 100, evChips: 300, avgEquity: 0.4,
  });
  // Red foreground = 31. Luck is -200.
  // eslint-disable-next-line no-control-regex
  assert.ok(/\[31m/.test(raw) || raw.includes('-200'), 'negative luck present');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/helpers.test.js`
Expected: FAIL — `renderEVSummary is not a function`.

- [ ] **Step 3: Write minimal implementation**

Add to `src/helpers/index.js` before `module.exports` (chalk is already required at the top of the file):

```js
// Summary box for the all-in EV view. luck = actualChips - evChips: green when
// running at/above expectation, red when below.
function renderEVSummary(totals) {
  const {
    count, actualChips, evChips, avgEquity,
  } = totals;
  if (!count) {
    return 'No all-in showdowns found';
  }
  const luck = actualChips - evChips;
  const luckStr = `${luck >= 0 ? '+' : ''}${luck}`;
  const luckColored = luck >= 0 ? chalk.green(luckStr) : chalk.red(luckStr);
  const avgPct = (avgEquity * 100).toFixed(1);

  const lines = [
    'All-in EV summary (showdown hands only)',
    '',
    `  All-ins analyzed       ${count}`,
    `  Actual chips won       ${actualChips}`,
    `  Expected chips (EV)    ${evChips}`,
    `  Luck (actual - EV)     ${luckColored}`,
    `  Avg equity when all-in ${avgPct}%`,
  ];
  return lines.join('\n');
}
```

Add `renderEVSummary,` to `module.exports` in alphabetical order (after `renderPLChart`? no — alphabetical: `renderEVSummary` comes before `renderPLChart`).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/helpers.test.js`
Expected: PASS (all, including existing helper tests).

- [ ] **Step 5: Lint**

Run: `npx eslint src/helpers/index.js test/helpers.test.js`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/helpers/index.js test/helpers.test.js
git commit -m "feat: add all-in EV summary renderer"
```

---

### Task 3: Aggregator across files (`buildAllInEV`)

**Files:**
- Modify: `src/parse-files/sync.js`
- Test: `test/build-all-in-ev.test.js`

**Interfaces:**
- Consumes: `parseAllInEV` (Task 1), `extractTimeFromFilename` (existing helper), `fs`, `path`.
- Produces: `buildAllInEV(directory, timeFilter, playerName) => { count, actualChips, evChips, avgEquity }`
  aggregated over all HH* files with date >= timeFilter.

- [ ] **Step 1: Write the failing test**

```js
// test/build-all-in-ev.test.js
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { buildAllInEV } = require('../src/parse-files/sync');

const FIXTURES = path.join(__dirname, 'fixtures');

test('buildAllInEV: aggregates spots across fixture files', () => {
  const totals = buildAllInEV(FIXTURES, 20260101, 'TestHero');
  // fixture 1 (lost, actual 0) + fixture 2 (won, actual 300) = 2 spots.
  assert.strictEqual(totals.count, 2);
  assert.strictEqual(totals.actualChips, 300);
  assert.ok(totals.avgEquity > 0 && totals.avgEquity < 1, 'avg equity is a fraction');
});

test('buildAllInEV: timeFilter excludes earlier files', () => {
  const totals = buildAllInEV(FIXTURES, 20260102, 'TestHero');
  assert.strictEqual(totals.count, 1); // only fixture 2
  assert.strictEqual(totals.actualChips, 300);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/build-all-in-ev.test.js`
Expected: FAIL — `buildAllInEV is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `src/parse-files/sync.js` add the import near the top (below the existing `parsePL` require):

```js
const { parseAllInEV } = require('../ev-parser');
```

Add the function above `module.exports`:

```js
// Read all HH* files at/after timeFilter and aggregate hero all-in EV spots into
// one totals object. avgEquity is the mean spot equity across all files.
function buildAllInEV(directory, timeFilter, playerName) {
  const filter = Number(timeFilter);
  const files = fs.readdirSync(directory)
    .filter((file) => file.startsWith('HH'))
    .filter((file) => {
      const time = extractTimeFromFilename(file);
      return time !== null && Number(time) >= filter;
    });

  let count = 0;
  let actualChips = 0;
  let evChips = 0;
  let equitySum = 0;

  files.forEach((filename) => {
    const content = fs.readFileSync(path.join(directory, filename), 'utf8');
    const { spots } = parseAllInEV(content, playerName);
    spots.forEach((s) => {
      count += 1;
      actualChips += s.actual;
      evChips += Math.round(s.equity * s.pot);
      equitySum += s.equity;
    });
  });

  const avgEquity = count === 0 ? 0 : equitySum / count;
  return {
    count, actualChips, evChips, avgEquity,
  };
}
```

Add `buildAllInEV` to `module.exports` (which currently exports `parseAllOldFiles` and `buildDailyPL`):

```js
module.exports = {
  parseAllOldFiles,
  buildDailyPL,
  buildAllInEV,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/build-all-in-ev.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Lint**

Run: `npx eslint src/parse-files/sync.js test/build-all-in-ev.test.js`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/parse-files/sync.js test/build-all-in-ev.test.js
git commit -m "feat: aggregate all-in EV across tournament files"
```

---

### Task 4: Wire `--view=ev` into the CLI

**Files:**
- Modify: `index.js`
- Test: `test/view-selection.test.js` (append)

**Interfaces:**
- Consumes: `buildAllInEV` (Task 3), `renderEVSummary` (Task 2).
- Produces: `--view=ev` renders the EV summary; the interactive prompt gains `[3] All-in EV summary`.

- [ ] **Step 1: Write the failing test**

```js
// append to test/view-selection.test.js
test('--view=ev renders the all-in EV summary', () => {
  const out = runCli(['--view=ev']);
  assert.ok(out.includes('All-in EV summary'), 'shows the EV summary header');
  assert.ok(!out.includes('All-in ≥ 50% Equity'), 'not the detail stats box');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/view-selection.test.js`
Expected: FAIL — `--view=ev` currently falls through to detail, so 'All-in EV summary' is absent.

- [ ] **Step 3: Write minimal implementation**

In `index.js`:

Update the require to include `buildAllInEV`:

```js
const { parseAllOldFiles, buildDailyPL, buildAllInEV } = require('./src/parse-files/sync');
```

Update the helpers require to include `renderEVSummary`:

```js
const { renderPLChart, renderEVSummary } = require('./src/helpers');
```

Add a `showEV` function next to `showGraph`:

```js
function showEV() {
  const totals = buildAllInEV(directoryArgv, timeFilterArgv, argvName);
  console.log('\n');
  console.log(renderEVSummary(totals));
  console.log('\n');
}
```

Update `run` to handle the `ev` view:

```js
function run(view) {
  if (view === 'graph') {
    showGraph();
  } else if (view === 'ev') {
    showEV();
  } else {
    showDetail();
  }
}
```

Update the flag guard to accept `ev`:

```js
if (viewArgv === 'graph' || viewArgv === 'detail' || viewArgv === 'ev') {
  run(viewArgv);
} else {
```

Update the prompt to offer option 3 (replace the existing `rl.question` prompt string and add the `choice === '3'` branch):

```js
    rl.question('Cosa vuoi vedere?\n  [1] Dettaglio all-in\n  [2] Grafico P/L giornaliero\n  [3] All-in EV summary\n> ', (answer) => {
      const choice = answer.trim();
      if (choice === '1') {
        rl.close();
        run('detail');
      } else if (choice === '2') {
        rl.close();
        run('graph');
      } else if (choice === '3') {
        rl.close();
        run('ev');
      } else {
        ask();
      }
    });
```

- [ ] **Step 4: Run the full suite**

Run: `node --test`
Expected: all tests PASS, no hang (tests always pass `--view`, so readline is never created).

- [ ] **Step 5: Lint**

Run: `npx eslint src/ index.js test/`
Expected: exit 0.

- [ ] **Step 6: Manual smoke test**

Run:
```bash
node index.js --name=Jeff81088 --timestamp=20260101 --view=ev --dir="/Users/lucatagliabue/Library/Application Support/PokerStarsItaly/HandHistory/Jeff81088"
```
Expected: an "All-in EV summary" box with a plausible count (dozens), actual vs EV chips, a colored luck figure, and an average equity near 50%.

- [ ] **Step 7: Commit**

```bash
git add index.js test/view-selection.test.js
git commit -m "feat: add --view=ev all-in EV summary to the CLI"
```

---

## Note per l'esecutore

- Do NOT modify `src/all-in-parser.js`, the detail view, or `src/parse-files/async.js`.
- The equity engine `poker-odds-calc` expects cards as arrays like `['Qs','4d']`. Board set via `table.setBoard([...])`. Preflop: do not call setBoard.
- If a fixture equity assertion in Task 1 lands just outside the given range, read the printed value and widen the test range to bracket it. Never tune the formula to hit a number.
- `Total pot` may be followed by side-pot detail; the regex `Total pot (\d+)` captures only the main total, which is intended.
