# EV summary context — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich the `--view=ev` summary with the analyzed period, tournament count, EV/actual/luck in big blinds, the share of all-ins where the hero was ahead (≥50% equity), and a small-sample warning.

**Architecture:** Extend the existing pure `parseAllInEV` to capture the big blind of each all-in hand (from the `Level (sb/bb)` header) and aggregate bb-denominated EV plus an "ahead" count. Extend `buildAllInEV` to also report tournament count and the real date range across files. Extend `renderEVSummary` to print the new context and metrics. No new dependencies; detail/graph views untouched.

**Tech Stack:** Node.js (CommonJS), `poker-odds-calc`, `chalk@4`, `node:test`. No new npm dependencies.

## Global Constraints

- CommonJS, no new npm dependencies. ESLint airbnb-base must pass: `npx eslint src/ index.js test/`.
- `parseAllInEV` stays pure (no console, no argv, no globals).
- Big blind per hand = second number in the header `Level <roman> (<sb>/<bb>)`. Regex: `/Level [^(]*\((\d+)\/(\d+)\)/`, bb = capture group 2 as Number.
- bb conversion is PER SPOT: `chips / bb` using that hand's bb; totals are the sum of per-spot bb values. If a hand has no parseable bb, that spot contributes to chip totals but is skipped in bb totals.
- "ahead" = spot with `equity >= 0.5`.
- Small-sample threshold: `count < 30`.
- Period dates come from `extractTimeFromFilename` (YYYYMMDD) over the files in range; display as `DD Mmm YYYY`.
- Luck (chips and bb): green when `>= 0`, red when `< 0`.
- Existing behavior when `count === 0` ("No all-in showdowns found") must be preserved.

---

### Task 1: parseAllInEV captures bb and aggregates bb/ahead

**Files:**
- Modify: `src/ev-parser.js`
- Test: `test/ev-parser.test.js` (append)

**Interfaces:**
- Consumes: nothing new.
- Produces: each spot is now `{ equity, pot, actual, bb }` (`bb` is the big blind
  of the all-in hand, or `null` if not parseable). `parseAllInEV`'s `totals` gains:
  `evBb` (sum of `round1(evChipsPerSpot / bb)`… see below), `actualBb`, and
  `aheadCount` (spots with `equity >= 0.5`). Exact totals shape documented in Step 3.

- [ ] **Step 1: Write the failing test**

Append to `test/ev-parser.test.js` (it already requires `parseAllInEV`, `fs`, `path`, and has `read`/`FIXTURES`):

```js
test('parseAllInEV: spot carries the hand big blind and bb/ahead aggregates', () => {
  // Fixture 6 is a Level V (40/80) hand: bb = 80. Hero all-in preflop, equity ~0.18,
  // pot 300, actual 0 (lost). One spot.
  const CASHED_2ND = "HH20260706 T1000000006 No Limit Hold'em €0,91 + €0,09.txt";
  const { spots, totals } = parseAllInEV(read(CASHED_2ND), 'TestHero');
  assert.strictEqual(spots.length, 1);
  assert.strictEqual(spots[0].bb, 80, 'bb parsed from Level (40/80)');
  // ahead: equity < 0.5 here, so aheadCount 0.
  assert.strictEqual(totals.aheadCount, 0);
  // actualBb = 0 (lost); evBb = round1(equity*pot / bb) summed.
  assert.strictEqual(totals.actualBb, 0);
  assert.ok(totals.evBb > 0, 'evBb positive');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/ev-parser.test.js`
Expected: FAIL — `spots[0].bb` is undefined and `totals.aheadCount`/`actualBb`/`evBb` are undefined.

- [ ] **Step 3: Implement**

In `src/ev-parser.js`, inside `parseHandSpot`, after computing `pot` (and before `return`), add bb extraction:

```js
  // Big blind of this hand, from the header "Level <roman> (<sb>/<bb>)".
  const bbMatch = handText.match(/Level [^(]*\((\d+)\/(\d+)\)/);
  const bb = bbMatch ? Number(bbMatch[2]) : null;
```

Change the spot return to include `bb`:

```js
  return { equity, pot, actual, bb };
```

Then update `parseAllInEV`'s totals reduction. The current code computes
`count`, `actualChips`, `evChips` (sum of per-spot `round(equity*pot)`), and
`avgEquity`. Add the new aggregates. Replace the totals-building block with:

```js
  const round = (n) => Math.round(n);
  const round1 = (n) => Math.round(n * 10) / 10;

  const count = spots.length;
  const actualChips = spots.reduce((s, x) => s + x.actual, 0);
  const evChips = spots.reduce((s, x) => s + round(x.equity * x.pot), 0);
  const equitySum = spots.reduce((s, x) => s + x.equity, 0);
  const avgEquity = count === 0 ? 0 : equitySum / count;
  const aheadCount = spots.filter((x) => x.equity >= 0.5).length;
  // bb-denominated totals: per-spot chips/bb, skipping spots with no bb.
  const actualBb = round1(spots.reduce((s, x) => (x.bb ? s + x.actual / x.bb : s), 0));
  const evBb = round1(spots.reduce((s, x) => (x.bb ? s + (x.equity * x.pot) / x.bb : s), 0));

  return {
    spots,
    totals: {
      count, actualChips, evChips, avgEquity, aheadCount, actualBb, evBb,
    },
  };
```

Note: keep whatever local helper names already exist; if `round` is already
defined at the top of the file, reuse it and only add `round1`. Ensure no
duplicate `const round` declaration (check the top of the file first).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/ev-parser.test.js`
Expected: PASS. If the exact `bb` or `aheadCount` differs from the fixture reality, read the printed values and correct the test expectation to match the fixture (do not change the parsing formula). Then run the full suite `node --test` — all pass.

- [ ] **Step 5: Lint**

Run: `npx eslint src/ev-parser.js test/ev-parser.test.js`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/ev-parser.js test/ev-parser.test.js
git commit -m "feat: capture big blind per all-in spot; aggregate bb EV and ahead count"
```

---

### Task 2: buildAllInEV aggregates bb/ahead, tournament count, and date range

**Files:**
- Modify: `src/parse-files/sync.js`
- Test: `test/build-all-in-ev.test.js` (append)

**Interfaces:**
- Consumes: `parseAllInEV` totals now including `evBb`, `actualBb`, `aheadCount` (Task 1); `extractTimeFromFilename` (existing).
- Produces: `buildAllInEV` returns
  `{ count, actualChips, evChips, avgEquity, aheadCount, actualBb, evBb, tournaments, periodStart, periodEnd }`
  where `tournaments` is the number of HH files in range, and `periodStart`/`periodEnd`
  are the min/max `YYYYMMDD` strings among those files (or `null` when no files).

- [ ] **Step 1: Write the failing test**

Append to `test/build-all-in-ev.test.js`:

```js
test('buildAllInEV: reports tournaments count and real date range', () => {
  const totals = buildAllInEV(FIXTURES, 20260101, 'TestHero');
  // All fixture files from 20260101 onward are counted as tournaments.
  assert.ok(totals.tournaments >= 6, `tournaments >= 6, got ${totals.tournaments}`);
  assert.strictEqual(totals.periodStart, '20260101');
  assert.strictEqual(totals.periodEnd, '20260707'); // latest fixture date
  assert.ok(typeof totals.aheadCount === 'number', 'aheadCount present');
  assert.ok(typeof totals.evBb === 'number', 'evBb present');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/build-all-in-ev.test.js`
Expected: FAIL — `tournaments`, `periodStart`, `periodEnd` are undefined.

- [ ] **Step 3: Implement**

Replace the body of `buildAllInEV` in `src/parse-files/sync.js` with:

```js
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
  let aheadCount = 0;
  let actualBb = 0;
  let evBb = 0;
  let periodStart = null;
  let periodEnd = null;

  files.forEach((filename) => {
    const date = extractTimeFromFilename(filename);
    if (date !== null) {
      if (periodStart === null || date < periodStart) { periodStart = date; }
      if (periodEnd === null || date > periodEnd) { periodEnd = date; }
    }
    const content = fs.readFileSync(path.join(directory, filename), 'utf8');
    const { totals } = parseAllInEV(content, playerName);
    count += totals.count;
    actualChips += totals.actualChips;
    evChips += totals.evChips;
    equitySum += totals.avgEquity * totals.count;
    aheadCount += totals.aheadCount;
    actualBb += totals.actualBb;
    evBb += totals.evBb;
  });

  const round1 = (n) => Math.round(n * 10) / 10;
  const avgEquity = count === 0 ? 0 : equitySum / count;
  return {
    count,
    actualChips,
    evChips,
    avgEquity,
    aheadCount,
    actualBb: round1(actualBb),
    evBb: round1(evBb),
    tournaments: files.length,
    periodStart,
    periodEnd,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/build-all-in-ev.test.js`
Expected: PASS. If `periodEnd` differs (e.g. a newer fixture exists), read the actual value and set the expectation to match the real latest fixture date. Then run the full suite — all pass.

- [ ] **Step 5: Lint**

Run: `npx eslint src/parse-files/sync.js test/build-all-in-ev.test.js`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/parse-files/sync.js test/build-all-in-ev.test.js
git commit -m "feat: aggregate bb EV, ahead count, tournament count and date range"
```

---

### Task 3: renderEVSummary shows period, tournaments, bb, ahead%, sample note

**Files:**
- Modify: `src/helpers/index.js`
- Test: `test/helpers.test.js` (append)

**Interfaces:**
- Consumes: `chalk`, `formatDateShort` (existing, `YYYYMMDD -> 'DD Mmm'`).
- Produces: `renderEVSummary(totals)` renders the enriched summary. `totals` may now
  include `aheadCount, actualBb, evBb, tournaments, periodStart, periodEnd`. When those
  are absent (e.g. old callers) the function must not crash — guard with defaults.
  Adds a module-local `formatDateLong(yyyymmdd) => 'DD Mmm YYYY'`.

- [ ] **Step 1: Write the failing test**

Append to `test/helpers.test.js` (it already has `stripAnsi`, `chalk`, and requires helpers):

```js
test('renderEVSummary: shows period, tournaments, bb, ahead% and sample note', () => {
  const out = stripAnsi(renderEVSummary({
    count: 10, actualChips: 100, evChips: 300, avgEquity: 0.4,
    aheadCount: 4, actualBb: 12.5, evBb: 37.5,
    tournaments: 8, periodStart: '20260704', periodEnd: '20260706',
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
    count: 50, actualChips: 100, evChips: 90, avgEquity: 0.55,
    aheadCount: 30, actualBb: 5, evBb: 4.5,
    tournaments: 20, periodStart: '20260704', periodEnd: '20260704',
  }));
  assert.ok(out.includes('04 Jul 2026'), 'single day shown');
  assert.ok(!out.includes('→'), 'no arrow for a single-day period');
  assert.ok(!/Small sample/i.test(out), 'no sample note when count >= 30');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/helpers.test.js`
Expected: FAIL — none of the new rows are rendered yet.

- [ ] **Step 3: Implement**

In `src/helpers/index.js`, add a module-local date helper near `formatDateShort`
(reuse the existing `MONTHS` array that `formatDateShort` uses):

```js
function formatDateLong(yyyymmdd) {
  const short = formatDateShort(yyyymmdd); // 'DD Mmm' or the raw input if malformed
  if (short === yyyymmdd) {
    return yyyymmdd;
  }
  return `${short} ${yyyymmdd.slice(0, 4)}`;
}
```

Replace `renderEVSummary` with:

```js
function renderEVSummary(totals) {
  const {
    count, actualChips, evChips, avgEquity,
    aheadCount = 0, actualBb = 0, evBb = 0,
    tournaments = 0, periodStart = null, periodEnd = null,
  } = totals;
  if (!count) {
    return 'No all-in showdowns found';
  }
  const luck = actualChips - evChips;
  const luckStr = `${luck >= 0 ? '+' : ''}${luck}`;
  const luckColored = luck >= 0 ? chalk.green(luckStr) : chalk.red(luckStr);

  const luckBb = Math.round((actualBb - evBb) * 10) / 10;
  const luckBbStr = `${luckBb >= 0 ? '+' : ''}${luckBb}`;
  const luckBbColored = luckBb >= 0 ? chalk.green(luckBbStr) : chalk.red(luckBbStr);

  const avgPct = (avgEquity * 100).toFixed(1);
  const aheadPct = Math.round((aheadCount / count) * 100);

  const lines = ['All-in EV summary (showdown hands only)', ''];

  if (periodStart) {
    const period = (periodEnd && periodEnd !== periodStart)
      ? `${formatDateLong(periodStart)} → ${formatDateLong(periodEnd)}`
      : formatDateLong(periodStart);
    lines.push(`  Period                 ${period}`);
  }
  lines.push(`  Tournaments            ${tournaments}`);
  lines.push('');
  lines.push(`  All-ins analyzed       ${count}`);
  lines.push(`  Actual chips won       ${actualChips}  (${actualBb} bb)`);
  lines.push(`  Expected chips (EV)    ${evChips}  (${evBb} bb)`);
  lines.push(`  Luck (actual - EV)     ${luckColored}  (${luckBbColored} bb)`);
  lines.push(`  Avg equity when all-in ${avgPct}%`);
  lines.push(`  All-in ahead (>=50%)   ${aheadPct}%`);

  if (count < 30) {
    lines.push('');
    lines.push(chalk.yellow('  ⚠ Small sample (<30 all-ins) - treat as indicative only'));
  }

  return lines.join('\n');
}
```

Note: `formatDateLong` must be defined BEFORE `renderEVSummary` uses it (place it
above), and `formatDateShort` must already exist above both (it does).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/helpers.test.js`
Expected: PASS (all, including existing helper tests). Then full suite `node --test` — all pass.

- [ ] **Step 5: Lint**

Run: `npx eslint src/helpers/index.js test/helpers.test.js`
Expected: exit 0.

- [ ] **Step 6: Manual smoke test**

Run (uses your `.env` name and dir):
```bash
node index.js --view=ev --timestamp=20260704
```
Expected: the EV box now begins with `Period ...` and `Tournaments ...`, shows chips
AND bb on the actual/EV/luck rows, an `All-in ahead (>=50%)` percentage, and — if
fewer than 30 all-ins in the range — the yellow small-sample note.

- [ ] **Step 7: Commit**

```bash
git add src/helpers/index.js test/helpers.test.js
git commit -m "feat: EV summary shows period, tournaments, bb totals, ahead% and sample note"
```

---

## Note per l'esecutore

- Do NOT touch detail/graph rendering or `all-in-parser.js`.
- If `src/ev-parser.js` already has a top-level `round` helper, reuse it; only add `round1`. Avoid a duplicate declaration (lint error).
- The bb regex `Level [^(]*\((\d+)\/(\d+)\)` must take the SECOND group as bb (big blind), not the first (small blind).
- If a fixture-derived expectation (bb value, periodEnd date, aheadCount) differs from what the test asserts, correct the TEST to match the real fixture — never tune the parsing to hit a number.
- Fixtures under `test/fixtures/` need `git add -f` if you add any (`.git/info/exclude` ignores `HH20*`), but this plan adds no new fixtures.
