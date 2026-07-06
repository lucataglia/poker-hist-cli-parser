# Showdown / Non-showdown winnings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show, in the `--view=ev` box, the hero's chips won/lost in showdown vs non-showdown hands (PT4 "blue/red line"), in big blinds.

**Architecture:** A pure parser computes per-hand net chips via stack deltas (method A) and classifies each hand as showdown-for-hero or not, converting to bb per hand. A separate action-based oracle (method B) cross-checks A on real fixtures. An aggregator sums across files; the EV renderer prints two new rows. detail/graph views untouched.

**Tech Stack:** Node.js (CommonJS), `chalk@4`, `node:test`. No new npm dependencies. No `poker-odds-calc` needed here (net chips come from stacks/pot, not equity).

## Global Constraints

- CommonJS, no new npm dependencies. ESLint airbnb-base must pass: `npx eslint src/ index.js test/`.
- Parsers are pure: no console, no argv, no globals.
- Per-hand net (method A, runtime): `net = startStack(nextHand) - startStack(thisHand)`, where start stack is the `Seat N: <name> (X in chips)` line. For the LAST hand of a tournament (no next hand): if the hero has a `finished the tournament` line, `net = -startStack`; otherwise (hero won the tournament) use method B for that one hand.
- Method B (oracle, tests only): `net = Σ(hero "collected X") - contribution`, where `contribution = Σ_street(max amount the hero committed on that street) - Σ(uncalled returned to hero)`. For `raises N to M`, M is the TOTAL committed on that street (not an increment). Blinds are preflop commitment absorbed into the first raise/call.
- Showdown-for-hero: hand contains `*** SHOW DOWN ***` AND the hero did NOT fold before it. Robust test: `*** SHOW DOWN ***` present AND no `<name>: folds` line AND the summary line for the hero does not contain `folded`.
- Units: bb. Per hand `netBb = netChips / bb`, bb = second number of `Level <roman> (<sb>/<bb>)`. Skip bb conversion for a hand with no parseable bb (keep chip total).
- Sign/color: showdown and non-showdown rows green when ≥ 0, red when < 0.
- Identity check: `sdChips + nonSdChips === totalNetChips` for a tournament.

---

### Task 1: parseShowdownSplit (method A + showdown classification)

**Files:**
- Create: `src/lines-parser.js`
- Create fixtures (see Step 1): `test/fixtures/HH20260801 T2000000001 ...`, plus reuse existing ones.
- Test: `test/lines-parser.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `parseShowdownSplit(fileContent, playerName) => { sdChips, nonSdChips, sdBb, nonSdBb, hands }`.
  `hands` = number of hands the hero was dealt into. Chips are integer sums; bb are
  numbers (per-hand netChips/bb summed, unrounded). Showdown hands contribute to
  `sd*`, others to `nonSd*`.

- [ ] **Step 1: Create a synthetic fixture with known net values**

Create `test/fixtures/HH20260801 T2000000001 No Limit Hold'em €0,91 + €0,09.txt` with THREE hands for TestHero at Level I (10/20), bb=20, designed so each net is obvious:

```
PokerStars Hand #200000000001: Tournament #2000000001, €0.91+€0.09 EUR Hold'em No Limit - Level I (10/20) [ADM ID: TESTBBBB0001] - 2026/08/01 10:00:00 CET [2026/08/01 04:00:00 ET]
Table '2000000001 1' 3-max Seat #1 is the button
Seat 1: Villain1 (300 in chips)
Seat 2: TestHero (300 in chips)
Seat 3: Villain2 (300 in chips)
TestHero: posts small blind 10
Villain2: posts big blind 20
*** HOLE CARDS ***
Villain1: raises 40 to 60
TestHero: folds
Villain2: folds
Uncalled bet (40) returned to Villain1
Villain1 collected 40 from pot
*** SUMMARY ***
Total pot 40 | Rake 0
Seat 1: Villain1 (button) collected (40)
Seat 2: TestHero (small blind) folded before Flop
Seat 3: Villain2 (big blind) folded before Flop
PokerStars Hand #200000000002: Tournament #2000000001, €0.91+€0.09 EUR Hold'em No Limit - Level I (10/20) [ADM ID: TESTBBBB0001] - 2026/08/01 10:01:00 CET [2026/08/01 04:01:00 ET]
Table '2000000001 1' 3-max Seat #2 is the button
Seat 1: Villain1 (340 in chips)
Seat 2: TestHero (290 in chips)
Seat 3: Villain2 (270 in chips)
Villain2: posts small blind 10
Villain1: posts big blind 20
*** HOLE CARDS ***
TestHero: raises 40 to 60
Villain2: folds
Villain1: folds
Uncalled bet (40) returned to TestHero
TestHero collected 40 from pot
*** SUMMARY ***
Total pot 40 | Rake 0
Seat 1: Villain1 (big blind) folded before Flop
Seat 2: TestHero (button) collected (40)
Seat 3: Villain2 (small blind) folded before Flop
PokerStars Hand #200000000003: Tournament #2000000001, €0.91+€0.09 EUR Hold'em No Limit - Level I (10/20) [ADM ID: TESTBBBB0001] - 2026/08/01 10:02:00 CET [2026/08/01 04:02:00 ET]
Table '2000000001 1' 3-max Seat #3 is the button
Seat 1: Villain1 (320 in chips)
Seat 2: TestHero (310 in chips)
Seat 3: Villain2 (270 in chips)
Villain1: posts small blind 10
TestHero: posts big blind 20
*** HOLE CARDS ***
Villain1: raises 40 to 60
TestHero: calls 40
*** FLOP *** [2c 7d Kh]
TestHero: checks
Villain1: checks
*** TURN *** [2c 7d Kh] [3s]
TestHero: checks
Villain1: checks
*** RIVER *** [2c 7d Kh 3s] [9c]
TestHero: checks
Villain1: checks
*** SHOW DOWN ***
TestHero: shows [Ah Kd] (a pair of Kings)
Villain1: shows [Qs Jd] (high card Queen)
TestHero collected 120 from pot
*** SUMMARY ***
Total pot 120 | Rake 0
Board [2c 7d Kh 3s 9c]
Seat 1: Villain1 (small blind) showed [Qs Jd] and lost with high card Queen
Seat 2: TestHero (button) showed [Ah Kd] and won (120) with a pair of Kings
Seat 3: Villain2 (big blind) folded before Flop
```

Known nets by stack delta:
- Hand 1: TestHero 300 → next-hand start 290 = **-10** (posted SB 10, folded). Non-showdown.
- Hand 2: 290 → 310 = **+20** (stole blinds). Non-showdown.
- Hand 3: 310 → (no next hand; hero did NOT bust, won the hand). Last hand → method-B fallback: collected 120, committed 60 (called to 60), net **+60**. Showdown.

So expected: nonSdChips = -10 + 20 = **+10**; sdChips = **+60**; hands = 3.
bb=20 → nonSdBb = 10/20 = **0.5**; sdBb = 60/20 = **3.0**.

- [ ] **Step 2: Write the failing test**

```js
// test/lines-parser.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseShowdownSplit } = require('../src/lines-parser');

const FIXTURES = path.join(__dirname, 'fixtures');
const read = (name) => fs.readFileSync(path.join(FIXTURES, name), 'utf8');
const SYNTH = "HH20260801 T2000000001 No Limit Hold'em €0,91 + €0,09.txt";

test('parseShowdownSplit: splits net chips into showdown vs non-showdown', () => {
  const r = parseShowdownSplit(read(SYNTH), 'TestHero');
  assert.strictEqual(r.hands, 3);
  assert.strictEqual(r.nonSdChips, 10, 'hand1 -10 + hand2 +20');
  assert.strictEqual(r.sdChips, 60, 'hand3 showdown win net +60');
});

test('parseShowdownSplit: converts to bb per hand (Level I bb=20)', () => {
  const r = parseShowdownSplit(read(SYNTH), 'TestHero');
  assert.strictEqual(r.nonSdBb, 0.5); // 10 / 20
  assert.strictEqual(r.sdBb, 3.0); // 60 / 20
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test test/lines-parser.test.js`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `src/lines-parser.js`**

```js
// src/lines-parser.js

// Big blind of a hand from its header "Level <roman> (<sb>/<bb>)".
function handBigBlind(handText) {
  const m = handText.match(/Level [^(]*\((\d+)\/(\d+)\)/);
  return m ? Number(m[2]) : null;
}

// Hero's starting stack for a hand: "Seat N: <name> (X in chips)".
function startStack(handText, escapedName) {
  const m = handText.match(new RegExp(`^Seat \\d+: ${escapedName} \\((\\d+) in chips\\)`, 'm'));
  return m ? Number(m[1]) : null;
}

// True if the hero reached showdown in this hand.
function heroWentToShowdown(handText, playerName, escapedName) {
  if (!handText.includes('*** SHOW DOWN ***')) {
    return false;
  }
  // Hero folded during play?
  const foldedInPlay = new RegExp(`^${escapedName}: folds`, 'm').test(handText);
  if (foldedInPlay) {
    return false;
  }
  // Summary marks hero as folded?
  const summaryFolded = new RegExp(`^Seat \\d+: ${escapedName} .*folded`, 'm').test(handText);
  if (summaryFolded) {
    return false;
  }
  return true;
}

// Method B (also used as the last-hand fallback): net = collected - contribution.
function netByActions(handText, playerName, escapedName) {
  // Sum every "<hero> collected N".
  const collectedRe = new RegExp(`^${escapedName}\\b.*collected (\\d+)`, 'gm');
  let collected = 0;
  let cm = collectedRe.exec(handText);
  while (cm) { collected += Number(cm[1]); cm = collectedRe.exec(handText); }

  // Split into streets; for each street, hero commitment = max(sum of call+bet, highest raise "to").
  // Blinds posted preflop are commitment on the preflop street.
  const streets = handText.split(/\*\*\* (?:FLOP|TURN|RIVER|SHOW DOWN|SUMMARY) \*\*\*/);
  // streets[0] contains header + hole cards + preflop actions.
  let contribution = 0;
  streets.forEach((street, idx) => {
    let sumCallBet = 0;
    let maxRaiseTo = 0;
    let blinds = 0;
    street.split('\n').forEach((line) => {
      if (!line.startsWith(`${playerName}:`)) { return; }
      const raise = line.match(/raises \d+ to (\d+)/);
      const bet = line.match(/bets (\d+)/);
      const call = line.match(/calls (\d+)/);
      const sb = line.match(/posts small blind (\d+)/);
      const bb = line.match(/posts big blind (\d+)/);
      const ante = line.match(/posts the ante (\d+)/);
      if (raise) { maxRaiseTo = Math.max(maxRaiseTo, Number(raise[1])); }
      if (bet) { sumCallBet += Number(bet[1]); }
      if (call) { sumCallBet += Number(call[1]); }
      if (idx === 0 && sb) { blinds += Number(sb[1]); }
      if (idx === 0 && bb) { blinds += Number(bb[1]); }
      if (ante) { blinds += Number(ante[1]); }
    });
    // On the preflop street, blinds are part of the "to" for a raiser, or add to call/bet.
    const streetCommit = Math.max(sumCallBet + blinds, maxRaiseTo);
    contribution += streetCommit;
  });

  // Subtract uncalled bet returned to hero.
  const uncalledRe = new RegExp(`Uncalled bet \\((\\d+)\\) returned to ${escapedName}`, 'g');
  let uncalled = 0;
  let um = uncalledRe.exec(handText);
  while (um) { uncalled += Number(um[1]); um = uncalledRe.exec(handText); }

  return collected - (contribution - uncalled);
}

function parseShowdownSplit(fileContent, playerName) {
  const escapedName = playerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Split into hands, keep only those where the hero is seated.
  const hands = fileContent.split('PokerStars Hand')
    .map((h) => h)
    .filter((h) => new RegExp(`^Seat \\d+: ${escapedName} \\(`, 'm').test(h));

  let sdChips = 0;
  let nonSdChips = 0;
  let sdBb = 0;
  let nonSdBb = 0;

  hands.forEach((hand, i) => {
    const thisStart = startStack(hand, escapedName);
    let net;
    const nextHand = hands[i + 1];
    if (nextHand) {
      const nextStart = startStack(nextHand, escapedName);
      net = nextStart - thisStart;
    } else if (new RegExp(`^${escapedName} finished the tournament`, 'm').test(hand)) {
      net = -thisStart; // busted: lost the whole stack
    } else {
      net = netByActions(hand, playerName, escapedName); // won the tournament: last hand
    }

    const bb = handBigBlind(hand);
    const isSd = heroWentToShowdown(hand, playerName, escapedName);
    if (isSd) {
      sdChips += net;
      if (bb) { sdBb += net / bb; }
    } else {
      nonSdChips += net;
      if (bb) { nonSdBb += net / bb; }
    }
  });

  return {
    sdChips, nonSdChips, sdBb, nonSdBb, hands: hands.length,
  };
}

module.exports = { parseShowdownSplit, netByActions, heroWentToShowdown };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test test/lines-parser.test.js`
Expected: PASS (2 tests). If the synthetic net differs, re-check the fixture stacks against the expected deltas and fix the FIXTURE (the numbers must be self-consistent) — not the formula.

- [ ] **Step 6: Lint**

Run: `npx eslint src/lines-parser.js test/lines-parser.test.js`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add -f "test/fixtures/HH20260801 T2000000001 No Limit Hold'em €0,91 + €0,09.txt"
git add src/lines-parser.js test/lines-parser.test.js
git commit -m "feat: add showdown/non-showdown split parser (stack-delta net + classification)"
```

---

### Task 2: Cross-check method A against method B on real-shaped fixtures

**Files:**
- Test: `test/lines-crosscheck.test.js`

**Interfaces:**
- Consumes: `netByActions`, `heroWentToShowdown` (exported by `src/lines-parser.js` in Task 1), and a re-derivation of per-hand method-A net.
- Produces: a test only. No runtime code.

- [ ] **Step 1: Write the cross-check test**

This test walks each hand of the existing all-in fixtures and asserts method A (stack delta) equals method B (`netByActions`) for every hand where A is defined (i.e. every hand that has a next hand in the same tournament). This blinds the subtle contribution rule.

```js
// test/lines-crosscheck.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { netByActions } = require('../src/lines-parser');

const FIXTURES = path.join(__dirname, 'fixtures');

function heroHands(fileContent, escapedName) {
  return fileContent.split('PokerStars Hand')
    .filter((h) => new RegExp(`^Seat \\d+: ${escapedName} \\(`, 'm').test(h));
}
function startStack(hand, escapedName) {
  const m = hand.match(new RegExp(`^Seat \\d+: ${escapedName} \\((\\d+) in chips\\)`, 'm'));
  return m ? Number(m[1]) : null;
}

// Every synthetic + real fixture; hero is TestHero for synthetic, but the all-in
// fixtures use TestHero too. Use TestHero across the board.
const FILES = fs.readdirSync(FIXTURES).filter((f) => f.startsWith('HH'));

test('method A (stack delta) equals method B (actions) for every mid-tournament hand', () => {
  const name = 'TestHero';
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let checked = 0;
  FILES.forEach((f) => {
    const content = fs.readFileSync(path.join(FIXTURES, f), 'utf8');
    const hands = heroHands(content, escaped);
    for (let i = 0; i < hands.length - 1; i += 1) {
      const a = startStack(hands[i + 1], escaped) - startStack(hands[i], escaped);
      const b = netByActions(hands[i], name, escaped);
      assert.strictEqual(b, a, `mismatch in ${f} hand index ${i}: A=${a} B=${b}`);
      checked += 1;
    }
  });
  assert.ok(checked > 0, 'at least one hand cross-checked');
});
```

- [ ] **Step 2: Run the test**

Run: `node --test test/lines-crosscheck.test.js`
Expected: it may FAIL initially if method B's contribution rule is imperfect on some real-shaped hand. If it fails, READ the mismatching hand printed in the assertion message, determine the correct contribution accounting, and fix `netByActions` in `src/lines-parser.js` until A and B agree on every mid-tournament hand. This is the whole point of the task. Do NOT change method A (stack delta is ground truth).

- [ ] **Step 3: Once green, lint**

Run: `npx eslint test/lines-crosscheck.test.js`
Expected: exit 0. Full suite `node --test` — all pass.

- [ ] **Step 4: Commit**

```bash
git add test/lines-crosscheck.test.js src/lines-parser.js
git commit -m "test: cross-check stack-delta net against action-based net on all fixtures"
```

---

### Task 3: buildShowdownSplit aggregator

**Files:**
- Modify: `src/parse-files/sync.js`
- Test: `test/build-showdown-split.test.js`

**Interfaces:**
- Consumes: `parseShowdownSplit` (Task 1), `extractTimeFromFilename` (existing).
- Produces: `buildShowdownSplit(directory, timeFilter, playerName) => { sdChips, nonSdChips, sdBb, nonSdBb, hands }` summed across HH files in range; bb totals rounded to 1 decimal at the end.

- [ ] **Step 1: Write the failing test**

```js
// test/build-showdown-split.test.js
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { buildShowdownSplit } = require('../src/parse-files/sync');

const FIXTURES = path.join(__dirname, 'fixtures');

test('buildShowdownSplit: aggregates split across files', () => {
  const r = buildShowdownSplit(FIXTURES, 0, 'TestHero');
  assert.ok(r.hands > 0, 'counted hands');
  // Identity: sd + nonsd chips = total net chips (finite number).
  assert.ok(Number.isFinite(r.sdChips) && Number.isFinite(r.nonSdChips));
  assert.ok(typeof r.sdBb === 'number' && typeof r.nonSdBb === 'number');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/build-showdown-split.test.js`
Expected: FAIL — `buildShowdownSplit is not a function`.

- [ ] **Step 3: Implement in `src/parse-files/sync.js`**

Add near the other requires:

```js
const { parseShowdownSplit } = require('../lines-parser');
```

Add the function above `module.exports`:

```js
function buildShowdownSplit(directory, timeFilter, playerName) {
  const filter = Number(timeFilter);
  const files = fs.readdirSync(directory)
    .filter((file) => file.startsWith('HH'))
    .filter((file) => {
      const time = extractTimeFromFilename(file);
      return time !== null && Number(time) >= filter;
    });

  let sdChips = 0;
  let nonSdChips = 0;
  let sdBb = 0;
  let nonSdBb = 0;
  let hands = 0;

  files.forEach((filename) => {
    const content = fs.readFileSync(path.join(directory, filename), 'utf8');
    const r = parseShowdownSplit(content, playerName);
    sdChips += r.sdChips;
    nonSdChips += r.nonSdChips;
    sdBb += r.sdBb;
    nonSdBb += r.nonSdBb;
    hands += r.hands;
  });

  const round1 = (n) => Math.round(n * 10) / 10;
  return {
    sdChips, nonSdChips, sdBb: round1(sdBb), nonSdBb: round1(nonSdBb), hands,
  };
}
```

Add `buildShowdownSplit` to `module.exports` (which currently exports parseAllOldFiles, buildDailyPL, buildAllInEV).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/build-showdown-split.test.js`
Expected: PASS. Full suite — all pass.

- [ ] **Step 5: Lint**

Run: `npx eslint src/parse-files/sync.js test/build-showdown-split.test.js`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/parse-files/sync.js test/build-showdown-split.test.js
git commit -m "feat: aggregate showdown/non-showdown split across tournament files"
```

---

### Task 4: Show the two rows in the EV summary and wire index.js

**Files:**
- Modify: `src/helpers/index.js` (`renderEVSummary`)
- Modify: `index.js` (`showEV`)
- Test: `test/helpers.test.js` (append), `test/view-selection.test.js` (append)

**Interfaces:**
- Consumes: `buildShowdownSplit` (Task 3).
- Produces: `renderEVSummary(totals)` reads optional `sdBb`, `nonSdBb` from `totals`
  and prints two rows when present. `showEV` merges `buildShowdownSplit` output into
  the totals object passed to `renderEVSummary`.

- [ ] **Step 1: Write the failing test (renderer)**

Append to `test/helpers.test.js`:

```js
test('renderEVSummary: shows showdown and non-showdown bb rows when present', () => {
  const out = stripAnsi(renderEVSummary({
    count: 10, actualChips: 100, evChips: 90, avgEquity: 0.5,
    aheadCount: 5, actualBb: 5, evBb: 4.5,
    tournaments: 8, periodStart: '20260704', periodEnd: '20260706',
    sdBb: 120.5, nonSdBb: -70.5,
  }));
  assert.ok(out.includes('Showdown (bb)'), 'showdown row');
  assert.ok(out.includes('120.5'), 'showdown value');
  assert.ok(out.includes('Non-showdown (bb)'), 'non-showdown row');
  assert.ok(out.includes('-70.5'), 'non-showdown value');
});

test('renderEVSummary: omits split rows when sd/nonSd absent', () => {
  const out = stripAnsi(renderEVSummary({
    count: 5, actualChips: 10, evChips: 10, avgEquity: 0.5,
  }));
  assert.ok(!out.includes('Non-showdown'), 'no split rows without data');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/helpers.test.js`
Expected: FAIL — rows absent.

- [ ] **Step 3: Implement in `renderEVSummary` (src/helpers/index.js)**

Add `sdBb` and `nonSdBb` to the destructured defaults:

```js
    aheadCount = 0, actualBb = 0, evBb = 0,
    tournaments = 0, periodStart = null, periodEnd = null,
    sdBb = null, nonSdBb = null,
```

After the `All-in ahead (>=50%)` line and before the small-sample note, insert:

```js
  if (sdBb !== null && nonSdBb !== null) {
    const sdStr = `${sdBb >= 0 ? '+' : ''}${sdBb}`;
    const nonSdStr = `${nonSdBb >= 0 ? '+' : ''}${nonSdBb}`;
    lines.push('');
    lines.push(`  Showdown (bb)          ${sdBb >= 0 ? chalk.green(sdStr) : chalk.red(sdStr)}`);
    lines.push(`  Non-showdown (bb)      ${nonSdBb >= 0 ? chalk.green(nonSdStr) : chalk.red(nonSdStr)}`);
  }
```

- [ ] **Step 4: Write the failing test (CLI wiring)**

Append to `test/view-selection.test.js`:

```js
test('--view=ev output includes the showdown split rows', () => {
  const out = runCli(['--view=ev']);
  assert.ok(out.includes('Non-showdown (bb)'), 'EV view shows the split');
});
```

- [ ] **Step 5: Run to verify it fails**

Run: `node --test test/view-selection.test.js`
Expected: FAIL — `showEV` does not yet compute/pass the split.

- [ ] **Step 6: Implement in `index.js` `showEV`**

The current `showEV` (VERIFIED: it uses the resolved variable `name`, not `argvName`):

```js
function showEV() {
  const totals = buildAllInEV(directoryArgv, timeFilterArgv, name);
  console.log('\n');
  console.log(renderEVSummary(totals));
  console.log('\n');
}
```

Update it to also compute and pass the split:

```js
function showEV() {
  const totals = buildAllInEV(directoryArgv, timeFilterArgv, name);
  const split = buildShowdownSplit(directoryArgv, timeFilterArgv, name);
  console.log('\n');
  console.log(renderEVSummary({ ...totals, sdBb: split.sdBb, nonSdBb: split.nonSdBb }));
  console.log('\n');
}
```

Also add `buildShowdownSplit` to the require:

```js
const { parseAllOldFiles, buildDailyPL, buildAllInEV, buildShowdownSplit } = require('./src/parse-files/sync');
```

IMPORTANT: read the current `index.js` first. After the `.env`/name-resolution
rewrite, `showEV` may take the resolved `name` as a parameter or read a
different variable than `argvName`. Use the SAME name variable the sibling
`showGraph`/`showDetail` use so the resolved (.env or CLI) name is passed. Do not
reintroduce `argvName` if the file no longer uses it.

- [ ] **Step 7: Run full suite + lint**

Run: `node --test` then `npx eslint src/ index.js test/`
Expected: all tests pass, lint exit 0.

- [ ] **Step 8: Manual smoke test**

```bash
node index.js --view=ev
```
Expected: the EV box now ends with `Showdown (bb)` and `Non-showdown (bb)` rows (colored), in addition to everything already there.

- [ ] **Step 9: Commit**

```bash
git add src/helpers/index.js index.js test/helpers.test.js test/view-selection.test.js
git commit -m "feat: show showdown/non-showdown bb split in the EV summary"
```

---

## Note per l'esecutore

- Method A (stack delta) is ground truth; NEVER tune it. In Task 2, if A and B disagree, fix method B's contribution accounting, not A.
- Do NOT touch detail/graph rendering, `all-in-parser.js`, or `ev-parser.js`.
- Fixtures need `git add -f` (`.git/info/exclude` ignores `HH20*`).
- The synthetic fixture in Task 1 must have internally consistent stacks: each hand's next-hand starting stack must equal this hand's start plus the intended net. Double-check the arithmetic before writing the test expectations.
- `index.js` name variable is `name` (the resolved CLI>.env value), verified. Use it in `showEV`.
- The Task 2 cross-check runs over ALL `HH*` fixtures with player `TestHero` (verified: fixtures 1-7 all use TestHero). Method B must agree with stack-delta on every mid-tournament hand there, including the all-in-with-uncalled hands.
