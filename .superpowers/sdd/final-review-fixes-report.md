# Final Review Fixes Report

---

## Round 2: Multiway All-in EV Fixes

### FIX 1 (Critical): sum ALL 'collected' lines for the hero

**File:** `src/ev-parser.js` — `parseHandSpot`

**Change:** Replaced the single `handText.match(new RegExp(..., 'm'))` call (which captured only the first `collected N` line) with a `RegExp.exec` loop using the `gm` flags, summing every matched integer. Multiway wins where the hero collects from both a side pot and a main pot on separate lines are now correctly totalled.

**TDD:** New test `parseAllInEV: hero collects from side pot + main pot -> actual = sum of both` confirmed failing (got actual=100, expected 600) before fix; passes after.

---

### FIX 2 (Important): snapshot board at HERO's first all-in, not global last all-in

**File:** `src/ev-parser.js` — `boardAtAllIn`

**Change:** Changed signature from `boardAtAllIn(lines)` to `boardAtAllIn(lines, playerName)`. Now only snapshots when the row starts with `${playerName}:` AND includes `'is all-in'`, and only takes the FIRST such snapshot (ignores later all-in lines from other players). Updated the caller in `parseHandSpot` to pass `playerName`. A hero who commits preflop gets `boardSnapshot = []` (empty board).

**TDD:** New test `parseAllInEV: hero all-in preflop, later villain all-in line on flop -> board is empty (preflop equity)` confirmed failing (equity was ~0.60 post-flop vs expected >0.65 preflop) before fix; passes after.

---

### FIX 3 (Important): exclude spots where not all all-in players reveal cards

**File:** `src/ev-parser.js` — `parseHandSpot`

**Change:** Added detection of all distinct player names that went all-in (lines matching `^(.+?): .*is all-in`). If `allInNames.size > Object.keys(shown).length`, the spot is excluded (returns `null`). Comment explains this is a known limitation: without all revealed cards, equity calculation would incorrectly treat the mucked player's cards as deck cards.

**TDD:** New test `parseAllInEV: 3-way all-in with one muck -> spot excluded (0 spots)` confirmed failing (got spots.length=1) before fix; passes after.

---

### FIX 4 (DRY): buildAllInEV reuses parseAllInEV's totals

**File:** `src/parse-files/sync.js` — `buildAllInEV`

**Change:** Replaced the manual `spots` iteration (re-implementing the same reduction) with destructuring `{ totals }` from `parseAllInEV`. Accumulates `count`, `actualChips`, `evChips` directly from `totals`; computes weighted equity sum as `totals.avgEquity * totals.count`. Return shape unchanged: `{ count, actualChips, evChips, avgEquity }`.

---

### FIX 5 (test gaps): new fixtures and tests

**New fixture files:**
- `test/fixtures/HH20260103 T1000000003 ...` — 3-way all-in, hero wins, collects 100 from side pot + 500 from main pot (covers FIX 1)
- `test/fixtures/HH20260104 T1000000004 ...` — hero all-in preflop (KsKc), villain has a redundant `is all-in` line on the flop (covers FIX 2)
- `test/fixtures/HH20260105 T1000000005 ...` — 3-way all-in, hero + Villain1 show cards, Villain2 mucks (covers FIX 3)

**New tests in `test/ev-parser.test.js`:**
- `parseAllInEV: hero collects from side pot + main pot -> actual = sum of both`
- `parseAllInEV: hero all-in preflop, later villain all-in line on flop -> board is empty (preflop equity)`
- `parseAllInEV: 3-way all-in with one muck -> spot excluded (0 spots)`

**Strengthened test in `test/helpers.test.js`:**
- `renderEVSummary: negative luck is colored red` — now forces `chalk.level=3` like the other color test, and asserts `/\[31m/.test(raw)` directly without `|| raw.includes('-200')` fallback.

**Updated existing tests to account for new fixtures:**
- `test/parser.test.js` — updated counts (Total=5, Wins=4, Losses=1, ITM=4)
- `test/build-daily-pl.test.js` — updated deepStrictEqual to include 5 fixture days
- `test/build-all-in-ev.test.js` — updated count/actualChips for corrected fixture set

---

### Full suite result

```
node --test
tests 34
pass 34
fail 0
duration_ms ~7314
```

All 34 tests pass (31 original + 3 new EV parser tests).

---

### Lint result

`npx eslint src/ index.js test/` — exit 0, no output (clean).

---

### Real-data EV box (Jeff81088, timestamp ≥ 20260101)

```
All-in EV summary (showdown hands only)

  All-ins analyzed       93
  Actual chips won       26403
  Expected chips (EV)    23464
  Luck (actual - EV)     +2939
  Avg equity when all-in 47.7%
```

Numbers shifted vs before due to FIX 1 (summing side+main pots), FIX 2 (preflop board snapshot), and FIX 3 (excluding incomplete multiway showdowns). This is expected and correct behaviour.

---

### Commit

Hash: `af3a8b6`
Branch: `feat/all-in-ev`
Message: `fix: correct multiway all-in EV (sum side pots, hero-street board, require all-in cards revealed)`
Files changed: 11 (395 insertions, 29 deletions)

---

### Concerns

- **FIX 3 known limitation:** Spots where a villain mucks are silently excluded rather than flagged. For real-data analysis this means some multiway pots are missing from the EV count. A future improvement could attempt to compute equity only among the revealed players if the mucking player is already eliminated (e.g. bust-out hand) — but this is out of scope for this task.
- **FIX 4 `void` issue:** Initially used `void spots;` to suppress an unused-variable lint warning, which itself is banned by the `no-void` ESLint rule. Fixed by simply not destructuring `spots` at all (`const { totals } = ...`).
- The 3 new fixture files cause all existing count-based tests (parser, build-daily-pl, build-all-in-ev) to need updated expected values; those were updated accordingly and all pass.

---

## FIX 1: buy-in regex sums ALL parts (multi-part PKO/bounty)

**File:** `src/pl-parser.js` — `parseBuyIn`

**Change:** Replaced the two-capture-group regex with a two-step approach:
1. Match the full buy-in span (`€amount+€amount(+€amount...)`) before the currency code.
2. Extract every `€<amount>` within that span using a global match and sum them all with `reduce`.

**TDD result:**
- New test `parsePL: three-part (bounty/PKO) buy-in sums all parts` confirmed FAILING before fix (got 9.2, expected 10).
- After fix: all 5 pl-parser tests pass including both existing 2-part tests (buyIn 1 and 0.5).

---

## FIX 2: escape argvName in ITM regex

**File:** `src/all-in-parser.js`

**Change:** Added a module-level `escapeRegExp` helper:
```js
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
```
Used it in both:
- The ITM regex: `new RegExp(\`^\${escapeRegExp(argvName)}\\b.*\\breceives\\b\`, 'm')`
- The `anonymize` helper (replaced inline escaping with a call to `escapeRegExp`)

**Verification:** All 5 tests in `test/parser.test.js` pass — including anonymize and ITM tests. Behavior unchanged for normal names.

---

## FIX 3: dedupe round2

**Files:** `src/helpers/index.js`, `src/pl-parser.js`, `src/parse-files/sync.js`

**Change:**
- Added `const round2 = (n) => Math.round(n * 100) / 100;` and exported it (alphabetical position) from `src/helpers/index.js`.
- Replaced the local definition in `src/pl-parser.js` with `const { round2 } = require('./helpers');`.
- Replaced the local definition in `src/parse-files/sync.js` with destructured import from `require('../helpers')`.

**Verification:** Behavior identical, no test regressions.

---

## Full suite result

```
node --test
tests 20
pass 20
fail 0
duration_ms ~3213
```

All 20 tests pass (19 original + 1 new PKO buy-in test).

---

## Lint result

`npx eslint src/ index.js` — exit 0, no output (clean).

---

## Commit

Hash: `6ba9965`
Message: `fix: sum multi-part buy-ins, escape name in ITM regex, dedupe round2 helper`
Branch: `fix/parser-bugs`
Files changed: 5 (31 insertions, 14 deletions)

---

## Concerns

None. All fixes are targeted and non-breaking. The `parseBuyIn` rewrite correctly handles 2-part and 3-part (and any N-part) buy-ins. The `escapeRegExp` extraction eliminates the inconsistency between the ITM regex and the `anonymize` helper. The `round2` deduplication introduces a single source of truth with no behavior change.

---

## Round 3: Cleanup Fixes (ITM predicate, dead code, .env test safety)

### FIX 1 (consistency): unify ITM predicate

**File:** `src/all-in-parser.js` — line 46

**Change:** Added `€` after `receive[sd]` in the ITM regex, changing it from `\\breceive[sd]\\b` to `\\breceive[sd] €`. This aligns the all-in-parser ITM check with the pl-parser prize regex (`receive[sd] €`), ensuring both views share one definition and preventing false positives from any non-prize "received"/"receives" line.

**Result:** All existing tests still pass — fixtures already use "receives €"/"received €" so the predicate change is a correctness tightening with no test impact.

---

### FIX 2 (dead code): delete async.js

**File deleted:** `src/parse-files/async.js`

**Verification:** `grep -rn "parse-files/async\|require.*async" src/ index.js test/` returned no output (zero references). The file was safely deleted.

---

### FIX 3 (test safety): stop mutating the real project-root .env

**Files changed:** `index.js`, `test/view-selection.test.js`

**Approach:** Added `process.env.POKER_ENV_PATH` override to `index.js`:
```js
const envPath = process.env.POKER_ENV_PATH || path.join(__dirname, '.env');
const env = loadEnv(envPath);
```

Updated the test to write a temp `.env` to `os.tmpdir()` and pass `POKER_ENV_PATH` in the child process environment. The real project-root `.env` is never touched. Cleanup is unconditional in `finally` via `fs.rmSync(tmpEnv, { force: true })`.

Also moved the `require('node:os')` import to the top of the file to satisfy the `global-require` ESLint rule.

---

### Full suite result

```
node --test
tests 41
pass 41
fail 0
duration_ms ~12325
```

All 41 tests pass. No regressions.

---

### Lint result

`npx eslint src/ index.js test/` — exit 0, no output (clean).

---

### Real-data verification (Jeff81088)

```
node index.js --view=detail --dir="...HandHistory/Jeff81088"

│ All-in ≥ 50% Equity  120 │
│ All-in < 50% Equity  135 │
│                          │
│ Wins                 136 │
│ Losses               119 │
│                          │
│ Plus/Minus           -15 │
│ Plus/Minus Wins       17 │
│                          │
│ Total                 99 │
│ ITM                   43 │
└──────────────────────────┘
```

**ITM value: 43**

---

### Commit

Hash: `bb7079f`
Branch: `feat/itm-placement-config`
Message: `refactor: unify ITM predicate, drop dead async.js, make .env test use temp path`
Files changed: 6 (16 insertions, 60 deletions — including async.js deletion)

---

### Concerns

None. All three fixes are clean and non-breaking:
- FIX 1 is a pure correctness improvement (the fixtures already used the euro sign so no test impact).
- FIX 2 had zero references confirmed before deletion.
- FIX 3 avoids any mutation of the real `.env` and the minimal `index.js` change (one new variable honoring an env override) is backward-compatible — the default path is unchanged.
