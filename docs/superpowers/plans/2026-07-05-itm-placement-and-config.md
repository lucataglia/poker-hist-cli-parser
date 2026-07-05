# ITM placement prizes + .env name + missing-param prompts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Count 2nd/3rd-place cash finishes as ITM (and in P/L), read the player name from a `.env` file, and prompt interactively for missing name/view instead of hard-failing.

**Architecture:** Extend the existing ITM regex in `all-in-parser.js` and the prize regex in `pl-parser.js` to also match PokerStars' second/third-place prize line (`finished the tournament in <N>th place and received €X`). Add a dependency-free `.env` reader (`src/config.js`). Rewrite `index.js`'s startup so it resolves the name from CLI > `.env`, applies silent defaults for dir/timestamp, and prompts via readline for name/view when missing.

**Tech Stack:** Node.js (CommonJS), `chalk@4`, `readline` (builtin), `poker-odds-calc`, `node:test`. No new npm dependencies (no `dotenv`).

## Global Constraints

- CommonJS (`require`/`module.exports`), no ESM. No new npm dependencies.
- ESLint airbnb-base must pass: `npx eslint src/ index.js test/`.
- PokerStars prize lines (both are "in the money" for the hero):
  - 1st place: `<name> wins the tournament and receives €X` (existing, keep working)
  - 2nd/3rd: `<name> finished the tournament in <N>th place and received €X` (new)
  - A non-cashing placement is `finished the tournament in <N>th place` WITHOUT `and received`.
- Prize amounts accept optional decimals: `\d+(?:[.,]\d+)?`.
- Name resolution precedence: `--name` (CLI) > `PLAYER_NAME` (`.env`) > interactive prompt.
- Silent defaults: `dir` → `./`, `timestamp` → `0` (all history). No prompt for these.
- `view` must be one of `detail` | `graph` | `ev`; if missing, prompt with `[1] detail [2] graph [3] ev`, re-asking on invalid input.
- readline is created ONLY when an interactive prompt is actually needed (so tests passing `--name` + `--view` never hang).
- Player names may contain regex-special chars; reuse the existing escaping approach.

---

### Task 1: Dependency-free `.env` reader (`loadEnv`)

**Files:**
- Create: `src/config.js`
- Test: `test/config.test.js`

**Interfaces:**
- Consumes: `fs`.
- Produces: `loadEnv(envPath) => object`. Reads the file at `envPath`; parses each
  `KEY=VALUE` line into an object; ignores blank lines and lines starting with `#`;
  trims key and value; returns `{}` if the file does not exist.

- [ ] **Step 1: Write the failing test**

```js
// test/config.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadEnv } = require('../src/config');

function tmpEnv(contents) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'env-'));
  const p = path.join(dir, '.env');
  fs.writeFileSync(p, contents);
  return p;
}

test('loadEnv: parses KEY=VALUE lines', () => {
  const p = tmpEnv('PLAYER_NAME=Jeff81088\n');
  assert.deepStrictEqual(loadEnv(p), { PLAYER_NAME: 'Jeff81088' });
});

test('loadEnv: ignores blank lines and comments, trims', () => {
  const p = tmpEnv('# a comment\n\n  PLAYER_NAME = Jeff81088 \n');
  assert.deepStrictEqual(loadEnv(p), { PLAYER_NAME: 'Jeff81088' });
});

test('loadEnv: missing file returns empty object', () => {
  assert.deepStrictEqual(loadEnv('/no/such/file/.env'), {});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/config.test.js`
Expected: FAIL — `Cannot find module '../src/config'`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/config.js
const fs = require('fs');

// Minimal .env reader (no dependency): parses KEY=VALUE lines, ignores blanks
// and #-comments, trims whitespace. Returns {} when the file is absent.
function loadEnv(envPath) {
  let raw;
  try {
    raw = fs.readFileSync(envPath, { encoding: 'utf8' });
  } catch (err) {
    return {};
  }
  const out = {};
  raw.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }
    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      return;
    }
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key) {
      out[key] = value;
    }
  });
  return out;
}

module.exports = { loadEnv };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/config.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Lint**

Run: `npx eslint src/config.js test/config.test.js`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/config.js test/config.test.js
git commit -m "feat: add dependency-free .env reader"
```

---

### Task 2: Count 2nd/3rd-place prizes in ITM and P/L

**Files:**
- Modify: `src/all-in-parser.js` (the `itmRegex`)
- Modify: `src/pl-parser.js` (`parsePrize`)
- Create: `test/fixtures/HH20260706 T1000000006 No Limit Hold'em €0,91 + €0,09.txt`
- Test: `test/pl-parser.test.js` (append), `test/parser.test.js` (append)

**Interfaces:**
- Consumes: nothing new.
- Produces: no signature changes. `parsePrize` now also sums
  `<name> finished the tournament in <N>th place and received €X`. The `itm`
  counter in `all-in-parser.js` now also counts that line.

- [ ] **Step 1: Create a fixture where the hero finishes 2nd for a prize**

Create `test/fixtures/HH20260706 T1000000006 No Limit Hold'em €0,91 + €0,09.txt` with this exact content (a minimal 10x-style hand where TestHero busts 2nd and is paid €2, and there is NO `receives` line for TestHero):

```
PokerStars Hand #100000000006: Tournament #1000000006, €0.91+€0.09 EUR Hold'em No Limit - Level V (40/80) [ADM ID: TESTAAAA0006] - 2026/07/06 10:00:00 CET [2026/07/06 04:00:00 ET]
Table '1000000006 1' 2-max Seat #1 is the button
Seat 1: TestHero (150 in chips)
Seat 2: Villain1 (450 in chips)
TestHero: posts small blind 40
Villain1: posts big blind 80
*** HOLE CARDS ***
Dealt to TestHero [Kd 3s]
TestHero: raises 70 to 150 and is all-in
Villain1: calls 70
*** FLOP *** [8h 8d 2c]
*** TURN *** [8h 8d 2c] [9h]
*** RIVER *** [8h 8d 2c 9h] [Qs]
*** SHOW DOWN ***
TestHero: shows [Kd 3s] (a pair of Eights)
Villain1: shows [Ah Ad] (two pair, Aces and Eights)
Villain1 collected 300 from pot
TestHero finished the tournament in 2nd place and received €2.00.
Villain1 wins the tournament and receives €8.00 - congratulations!
*** SUMMARY ***
Total pot 300 | Rake 0
Board [8h 8d 2c 9h Qs]
Seat 1: TestHero (small blind) showed [Kd 3s] and lost with a pair of Eights
Seat 2: Villain1 (big blind) showed [Ah Ad] and won (300) with two pair, Aces and Eights
```

- [ ] **Step 2: Write the failing tests**

Append to `test/pl-parser.test.js`:

```js
const CASHED_2ND = "HH20260706 T1000000006 No Limit Hold'em €0,91 + €0,09.txt";

test('parsePL: hero finishes 2nd for a prize -> prize counted from "and received"', () => {
  const r = parsePL(read(CASHED_2ND), 'TestHero');
  assert.strictEqual(r.prize, 2); // "finished ... 2nd place and received €2.00"
  assert.strictEqual(r.buyIn, 1);
  assert.strictEqual(r.pl, 1); // 2 - 1
});
```

Append to `test/parser.test.js` (this suite runs the CLI; add a fixture-scoped
assertion via a new focused test that calls the parser directly). Add at the top
of `test/parser.test.js` if not present: `const { allInParser } = require('../src/all-in-parser');` — NOTE: `all-in-parser` reads `argv` for the name, so instead assert ITM through the CLI detail view, which already prints an ITM count. Append:

```js
test('detail view counts a 2nd-place cash as ITM', () => {
  // Fixtures include one hero 2nd-place cash (HH20260706). Running over just the
  // july fixture range, ITM must be at least 1.
  const out = runCli(['--view=detail', '--timestamp=20260706']);
  const m = out.match(/ITM\s+(\d+)/);
  assert.ok(m, 'ITM row present');
  assert.ok(Number(m[1]) >= 1, `ITM should count the 2nd-place cash, got ${m && m[1]}`);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test test/pl-parser.test.js test/parser.test.js`
Expected: FAIL — `parsePL` returns prize 0 (only `receives` matched), and the ITM count does not include the placement cash.

- [ ] **Step 4: Extend `parsePrize` in `src/pl-parser.js`**

Replace the `parsePrize` function body's regex handling so it sums BOTH prize
line formats. The current function:

```js
function parsePrize(fileContent, playerName) {
  const escaped = playerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${escaped}\\b.*\\breceives €\\s*(\\d+(?:[.,]\\d+)?)`, 'gm');
  let total = 0;
  let m = re.exec(fileContent);
  while (m) {
    total += parseFloat(m[1].replace(',', '.'));
    m = re.exec(fileContent);
  }
  return round2(total);
}
```

becomes (match `receives` for 1st OR `received` for 2nd/3rd — both preceded by the hero name at line start):

```js
function parsePrize(fileContent, playerName) {
  const escaped = playerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // 1st place: "<name> ... receives €X"; 2nd/3rd: "<name> ... received €X".
  const re = new RegExp(`^${escaped}\\b.*\\breceive[sd] €\\s*(\\d+(?:[.,]\\d+)?)`, 'gm');
  let total = 0;
  let m = re.exec(fileContent);
  while (m) {
    total += parseFloat(m[1].replace(',', '.'));
    m = re.exec(fileContent);
  }
  return round2(total);
}
```

- [ ] **Step 5: Extend the `itmRegex` in `src/all-in-parser.js`**

The current ITM scan (near the top of `allInParser`):

```js
  const itmRegex = new RegExp(`^${escapeRegExp(argvName)}\\b.*\\breceives\\b`, 'm');
```

becomes (match `receives` OR `received`):

```js
  const itmRegex = new RegExp(`^${escapeRegExp(argvName)}\\b.*\\breceive[sd]\\b`, 'm');
```

- [ ] **Step 6: Update the existing ITM count test that the new fixture shifts**

The new fixture `HH20260706` adds a 2nd-place cash inside the default fixture
range. The existing test in `test/parser.test.js`:

```js
test('ITM counts only tournaments where hero cashes', () => {
  const out = runCli(['--view=detail']);
  // Only fixture 2 has "TestHero wins the tournament and receives".
  assert.strictEqual(statValue(out, 'ITM'), 1);
});
```

now sees TWO cashes (fixture 2's win + fixture 6's 2nd-place cash). Update its
expectation and comment to:

```js
test('ITM counts tournaments where hero cashes (win or placement)', () => {
  const out = runCli(['--view=detail']);
  // fixture 2 (1st place, receives) + fixture 6 (2nd place, received) = 2 cashes.
  assert.strictEqual(statValue(out, 'ITM'), 2);
});
```

Similarly, if any other existing test in `test/parser.test.js` asserts a `Total`
count, note the new fixture raises the tournament total by 1 for the default
range; update those expectations to match (e.g. a `Total` of 2 becomes 3).
Check by reading the test file before running; adjust every count assertion the
new fixture shifts, without weakening what each test checks.

- [ ] **Step 7: Run tests to verify they pass**

Run: `node --test test/pl-parser.test.js test/parser.test.js`
Expected: PASS. Then run the full suite `node --test` — all pass.

- [ ] **Step 8: Lint**

Run: `npx eslint src/pl-parser.js src/all-in-parser.js test/pl-parser.test.js test/parser.test.js`
Expected: exit 0.

- [ ] **Step 9: Commit**

```bash
git add -f "test/fixtures/HH20260706 T1000000006 No Limit Hold'em €0,91 + €0,09.txt"
git add src/pl-parser.js src/all-in-parser.js test/pl-parser.test.js test/parser.test.js
git commit -m "feat: count 2nd/3rd-place cash finishes as ITM and in P/L"
```

Note: the fixture must be `git add -f` because `.git/info/exclude` ignores `HH20*`.

---

### Task 3: `.env` support files

**Files:**
- Create: `.env.example`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nothing.
- Produces: documentation + ignore rule. No code.

- [ ] **Step 1: Create `.env.example`**

```
# Your PokerStars screen name. Copy this file to .env and fill it in.
# CLI flag --name overrides this value.
PLAYER_NAME=
```

- [ ] **Step 2: Add `.env` to `.gitignore`**

The current `.gitignore` contains `node_modules/`. Append a line so it becomes:

```
node_modules/
.env
```

- [ ] **Step 3: Verify `.env` is ignored**

Run: `printf 'PLAYER_NAME=Jeff81088\n' > .env && git check-ignore .env`
Expected: prints `.env` (meaning it is ignored). Leave the `.env` file in place (it is now git-ignored and useful for local runs).

- [ ] **Step 4: Commit**

```bash
git add .env.example .gitignore
git commit -m "chore: add .env.example and gitignore .env"
```

---

### Task 4: Resolve name from CLI/.env and prompt for missing name/view

**Files:**
- Modify: `index.js`
- Test: `test/view-selection.test.js` (append)

**Interfaces:**
- Consumes: `loadEnv` (Task 1), existing `parseAllOldFiles`/`buildDailyPL`/`buildAllInEV`, `renderPLChart`/`renderEVSummary`.
- Produces: CLI behavior. Name resolves CLI > `.env` > prompt; dir/timestamp get silent defaults; missing name and/or view are prompted; readline only created when a prompt is needed.

- [ ] **Step 1: Write the failing test**

Append to `test/view-selection.test.js`. The existing `runCli` passes `--name=TestHero`. Add a test proving the name can come from `.env` when `--name` is absent, and that `--view` still works:

```js
const fs = require('node:fs');

test('name is read from .env when --name is absent', () => {
  // Write a temporary .env in the project root with PLAYER_NAME, run without --name.
  const envPath = path.join(ROOT, '.env');
  const had = fs.existsSync(envPath);
  const backup = had ? fs.readFileSync(envPath) : null;
  fs.writeFileSync(envPath, 'PLAYER_NAME=TestHero\n');
  try {
    const out = execFileSync('node', [
      path.join(ROOT, 'index.js'),
      '--timestamp=20260101',
      `--dir=${FIXTURES}`,
      '--view=detail',
    ], { encoding: 'utf8', cwd: ROOT })
      // eslint-disable-next-line no-control-regex
      .replace(/\[[0-9;]*m/g, '').replace(/\[[0-9]*[A-Z]/g, '');
    assert.ok(out.includes('All-in ≥ 50% Equity'), 'detail view ran using .env name');
  } finally {
    if (had) { fs.writeFileSync(envPath, backup); } else { fs.rmSync(envPath); }
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/view-selection.test.js`
Expected: FAIL — currently `index.js` hard-fails on missing `--name` (mandatoryFields → process.exit(1)), so the run throws / produces no detail output.

- [ ] **Step 3: Rewrite `index.js`**

Replace the ENTIRE contents of `index.js` with:

```js
const path = require('path');
const readline = require('readline');
const argv = require('minimist')(process.argv.slice(2));
const { loadEnv } = require('./src/config');
const { parseAllOldFiles, buildDailyPL, buildAllInEV } = require('./src/parse-files/sync');
const { renderPLChart, renderEVSummary } = require('./src/helpers');

console.clear();

const env = loadEnv(path.join(__dirname, '.env'));

// Name precedence: --name (CLI) > PLAYER_NAME (.env) > interactive prompt.
const nameFromArgs = argv.name && argv.name.toString().trim();
const nameFromEnv = env.PLAYER_NAME && env.PLAYER_NAME.trim();

// Silent defaults for dir and timestamp (user chose: dir=./, all history).
const directoryArgv = argv.dir || './';
const timeFilterArgv = argv.timestamp !== undefined ? argv.timestamp : 0;
const { anonymize: argvAnonymyze, view: viewArgv } = argv;

const VALID_VIEWS = ['detail', 'graph', 'ev'];

function runWith(name, view) {
  const anonymousName = argvAnonymyze ? 'JohnDoe' : name;
  if (view === 'graph') {
    const daily = buildDailyPL(directoryArgv, timeFilterArgv, name);
    console.log('\n');
    console.log(renderPLChart(daily));
    console.log('\n');
  } else if (view === 'ev') {
    const totals = buildAllInEV(directoryArgv, timeFilterArgv, name);
    console.log('\n');
    console.log(renderEVSummary(totals));
    console.log('\n');
  } else {
    // detail: real name drives parsing, anonymousName is only for display.
    parseAllOldFiles(directoryArgv, timeFilterArgv, name, anonymousName);
  }
}

// Resolve name and view, prompting only for what is still missing.
function resolve() {
  const name = nameFromArgs || nameFromEnv || null;
  const view = VALID_VIEWS.includes(viewArgv) ? viewArgv : null;

  if (name && view) {
    runWith(name, view);
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const askView = (resolvedName) => {
    rl.question('Cosa vuoi vedere?\n  [1] Dettaglio all-in\n  [2] Grafico P/L giornaliero\n  [3] All-in EV summary\n> ', (answer) => {
      const choice = answer.trim();
      const map = { 1: 'detail', 2: 'graph', 3: 'ev' };
      if (map[choice]) {
        rl.close();
        runWith(resolvedName, map[choice]);
      } else {
        askView(resolvedName);
      }
    });
  };

  const askName = (cb) => {
    if (name) {
      cb(name);
      return;
    }
    rl.question('Qual è il tuo nome PokerStars? ', (answer) => {
      const n = answer.trim();
      if (n) {
        cb(n);
      } else {
        askName(cb);
      }
    });
  };

  askName((resolvedName) => {
    if (view) {
      rl.close();
      runWith(resolvedName, view);
    } else {
      askView(resolvedName);
    }
  });
}

resolve();
```

- [ ] **Step 4: Run the failing test again**

Run: `node --test test/view-selection.test.js`
Expected: PASS (including the new `.env` test and the existing `--view` tests, which pass both `--name` and `--view` so readline is never created).

- [ ] **Step 5: Full suite**

Run: `node --test`
Expected: all tests PASS, no hang.

- [ ] **Step 6: Lint**

Run: `npx eslint src/ index.js test/`
Expected: exit 0.

- [ ] **Step 7: Manual smoke tests**

```bash
# name from .env (no --name), explicit view:
printf 'PLAYER_NAME=Jeff81088\n' > .env
node index.js --view=ev --dir="/Users/lucatagliabue/Library/Application Support/PokerStarsItaly/HandHistory/Jeff81088"
# 2nd-place ITM now counted — detail view over full history:
node index.js --view=detail --dir="/Users/lucatagliabue/Library/Application Support/PokerStarsItaly/HandHistory/Jeff81088"
```
Expected: first prints the EV box using the .env name; second shows the stats box with ITM now including the 2nd-place cash (ITM one higher than before this change).

- [ ] **Step 8: Commit**

```bash
git add index.js test/view-selection.test.js
git commit -m "feat: resolve name from .env and prompt for missing name/view instead of failing"
```

---

## Note per l'esecutore

- Do NOT modify the detail/graph/ev rendering logic beyond what Task 4 shows; behavior must stay identical when `--name` + `--view` are passed.
- The `mandatoryFields`/`process.exit(1)` block is removed entirely in Task 4 — missing params are now prompted or defaulted, never a hard fail.
- Fixtures under `test/fixtures/` need `git add -f` (`.git/info/exclude` ignores `HH20*`).
- Do not add the `dotenv` package; the manual `loadEnv` is intentional.
- `src/parse-files/async.js` is out of scope; do not touch it.
