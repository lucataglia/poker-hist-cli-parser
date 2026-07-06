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

---

## Round 4: Round bb totals once; clarify bb-null guard; fix stale comment

### FIX 1 (accuracy): round bb totals only ONCE, at the end

**File:** `src/ev-parser.js` — `parseAllInEV`

**Change:** Removed the local `round1` definition from `parseAllInEV`. Changed `actualBb` and `evBb` from rounded per-file values to raw (unrounded) floats:
```js
const actualBb = spots.reduce((s, x) => (x.bb !== null && x.bb ? s + x.actual / x.bb : s), 0);
const evBb = spots.reduce((s, x) => (x.bb !== null && x.bb ? s + (x.equity * x.pot) / x.bb : s), 0);
```
`round1` was only used for those two variables in this function, so removing it also satisfies lint (no unused declarations).

**File:** `src/parse-files/sync.js` — `buildAllInEV`

No change needed here — it already accumulates raw `actualBb`/`evBb` into running sums and applies `round1` only at the end before returning. With ev-parser now returning raw values, this single rounding point is correct.

---

### FIX 2 (clarity): use `x.bb !== null` instead of falsy check

Folded into FIX 1 above. The guard changed from `x.bb ? ...` to `x.bb !== null && x.bb ? ...`, making the null-intent explicit while retaining the divide-by-zero guard for the impossible `bb === 0` case.

---

### FIX 3 (cosmetic): fix stale test comment

**File:** `test/build-all-in-ev.test.js`

**Change:** Updated the comment on the `periodEnd` assertion from `// latest fixture date` to `// latest fixture date is 20260707`. The assertion itself (`'20260707'`) was already correct.

---

### Full suite result

```
node --test
tests 45
pass 45
fail 0
duration_ms ~12155
```

All 45 tests pass. No regressions.

---

### Lint result

`npx eslint src/ index.js test/` — exit 0, no output (clean).

---

### Real-data EV box (`--view=ev --timestamp=20260704`)

```
All-in EV summary (showdown hands only)

  Period                 04 Jul 2026 → 06 Jul 2026
  Tournaments            34

  All-ins analyzed       70
  Actual chips won       14340  (438.8 bb)
  Expected chips (EV)    16193  (464.5 bb)
  Luck (actual - EV)     -1853  (-25.7 bb)
  Avg equity when all-in 45.3%
  All-in ahead (>=50%)   40%
```

Numbers may shift slightly vs before due to the elimination of double-rounding across files — expected and correct.

---

### Commit

Hash: `15e4127`
Branch: `feat/ev-summary-context`
Message: `refactor: round bb totals once at the end; clarify bb-null guard and stale comment`
Files changed: 2 (4 insertions, 6 deletions)

---

### Concerns

None. The change is pure accuracy improvement: removing accumulated rounding error across N files. For a small number of files the difference is negligible; for large sample sizes it could meaningfully affect bb totals. The test for `evBb` in `ev-parser.test.js` asserts `> 0` (still true for raw values). The `actualBb === 0` assertion in the same test is also still true (hero lost, actual=0, so raw sum is still 0).

---

## Round 5: Running-total per-street commitment + code-review cleanups

### FIX 1 (Critical): replace sumCallBet/maxRaiseTo formula with running-total walk

**File:** `src/lines-parser.js` — `netByActions`

**Problem:** The prior formula `maxRaiseTo > 0 ? maxRaiseTo + sumCallBet : sumCallBet + blinds` over-counted the call-then-raise shape (e.g., flop: hero calls 40 then raises to 200 → formula gave 200+40=240; correct is 200, because PokerStars writes "raises X to M" where M is the TOTAL committed on that street, already including the prior call).

**Change:** Replaced `sumCallBet`, `maxRaiseTo`, `blinds` with a single `running` variable per street. Walk actions in order:
- `raises X to M` → `running = M` (M is already cumulative)
- `bets N` → `running += N`
- `calls N` → `running += N` (increment)
- blind/ante post → `running += amount`

Street commitment = final `running`. Both shapes handled correctly:
- raise-then-call: SB=10 → raise sets running=60 → call +140 → 200 ✓
- call-then-raise: call +40 → raise sets running=200 → 200 ✓

Updated invariant comment to describe the running-total model.

**TDD:** New fixture `HH20260301 T1000000021` (call-then-raise on flop) confirmed failing (B=320 vs A=360) before fix; passes after. New fixture `HH20260300 T1000000020` (raise-then-call) confirmed correct throughout.

---

### FIX 2: Remove no-op `.map((h) => h)` in parseShowdownSplit

**File:** `src/lines-parser.js` — `parseShowdownSplit`

Removed the identity `.map((h) => h)` that did nothing. Clean up only.

---

### FIX 3: Remove unused `playerName` param from `heroWentToShowdown`

**File:** `src/lines-parser.js` — `heroWentToShowdown`

The function never used `playerName` (only `escapedName`). Removed the param and updated the call site in `parseShowdownSplit`. `netByActions` still takes `playerName` legitimately (uses it for the `startsWith` prefix check).

---

### FIX 4: Add precondition comment to `parseShowdownSplit`

**File:** `src/lines-parser.js` — `parseShowdownSplit`

Added:
```
// Assumes one file = one complete single-table tournament (SNG).
// Multi-file MTTs where a tournament spans files would misattribute the first hand
// as a fresh buy-in.
```

---

### New fixture hands (hand-computed ground truth)

**File 1: `HH20260300 T1000000020` — raise-then-call (3-bet preflop, sanity check)**
- Hand #30: TestHero=500, SB. Raises to 60, Villain 3-bets to 200, TestHero calls 140.
  - Running: +10(SB)→raise sets 60→call +140→200
  - Collected 400, contribution=200, net=+200. End stack=700.
- Hand #31: Anchor. TestHero=700. Folds BB (Villain folds SB), collects 20. [Not validated by crosscheck — only hands[0] is checked against hands[1].startStack=700]
- Stack delta A = 700−500 = 200 = method B net = 200 ✓

**File 2: `HH20260301 T1000000021` — call-then-raise on flop (the actually broken shape)**
- Hand #40: TestHero=500, BB. Preflop: limp pot (3-way), TestHero checks (running=20). Flop: calls 40 (running=40), faces re-raise, raises to 400 (running=400). Villain folds. Uncalled 200 returned.
  - Contribution: preflop=20, flop=400. Total=420. Uncalled=200.
  - Collected=620. Net=620−(420−200)=+360. End stack=860.
- Hand #41: Anchor. TestHero=860 (just collects BB since both villains fold).
- Stack delta A = 860−500 = 360 = method B net = 360 ✓ (old formula gave 320, WRONG)

---

### Full suite result

```
node --test
tests 52
pass 52
fail 0
duration_ms ~12425
```

All 52 tests pass. No regressions.

---

### Lint result

`npx eslint src/ index.js test/` — exit 0, no output (clean).

---

### Real-data EV box (`--view=ev`)

```
All-in EV summary (showdown hands only)

  Period                 06 Jan 2026 → 06 Jul 2026
  Tournaments            121

  All-ins analyzed       224
  Actual chips won       59615  (1796.5 bb)
  Expected chips (EV)    55582  (1658.4 bb)
  Luck (actual - EV)     +4033  (+138.1 bb)
  Avg equity when all-in 47.3%
  All-in ahead (>=50%)   49%

  Showdown (bb)          +313.9
  Non-showdown (bb)      +70.4
```

---

### Commit

Hash: (see below)
Branch: `feat/showdown-split`
Message: `fix: model per-street commitment as a running total (handles raise-then-call and call-then-raise)`

---

### Concerns

- The `raise` branch sets `running = M` unconditionally. If a hand somehow had TWO raise lines from the hero on the same street (degenerate format), the earlier raise's contribution would be lost. In practice PokerStars never writes two raise lines from the same player in the same betting round; the running-total model is correct for all standard hand histories.
- The call-then-raise fixture uses a 3-way pot with both villains in, which requires the pot math to be computed precisely (Villain2 folds flop after calling, leaving an uncalled bet from TestHero's re-raise). The stacks were computed from first principles and verified by chip conservation (700+300+500=1500=440+200+860).
- The raise-then-call fixture (HH20260300) confirms the fix does not regress the shape the prior formula was designed to handle.
