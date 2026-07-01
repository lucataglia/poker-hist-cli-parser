# Grafico P/L giornaliero — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere una seconda vista alla CLI: un grafico a barre divergenti che mostra il P/L reale in euro per giornata, scelto via prompt interattivo o flag `--view`.

**Architecture:** Un parser puro nuovo (`src/pl-parser.js`) estrae buy-in e premio da ogni file torneo senza side effect. Un aggregatore in `sync.js` raggruppa per data. Un renderer puro in `helpers` produce la stringa del grafico. `index.js` legge `--view` o chiede via readline, poi dispaccia. La vista detail esistente resta invariata.

**Tech Stack:** Node.js (CommonJS), `chalk@4` (colori, già presente), `readline` nativo, `node:test` per i test. Nessuna nuova dipendenza.

## Global Constraints

- CommonJS (`require`/`module.exports`), no ESM.
- Nessuna nuova dipendenza npm.
- ESLint airbnb-base deve passare: `npx eslint src/ index.js`.
- Buy-in letto dall'header di ogni torneo, formato `€X.XX+€Y.YY` (esistono almeno `€0.46+€0.04` e `€0.91+€0.09`); mai assunto fisso.
- Premio: riga `^<playerName>\b.*\breceives €X`, letto sull'intero contenuto file.
- Il parser puro (`parsePL`) non fa `console.log`, non legge `argv`, non usa stato globale.
- Colori tenui: `chalk.dim.green` (P/L ≥ 0, barra a destra), `chalk.dim.red` (P/L < 0, barra a sinistra).
- Date output in italiano abbreviato: `30 Giu`, `01 Lug`.

---

### Task 1: Parser puro P/L per torneo (`parsePL`)

**Files:**
- Create: `src/pl-parser.js`
- Test: `test/pl-parser.test.js`

**Interfaces:**
- Consumes: niente (funzione pura, riceve testo file già letto).
- Produces: `parsePL(fileContent: string, playerName: string) => { prize: number, buyIn: number, pl: number }`. `prize` = euro incassati (0 se non a premio), `buyIn` = costo totale torneo in euro, `pl = prize - buyIn` arrotondato a 2 decimali.

- [ ] **Step 1: Write the failing test**

```js
// test/pl-parser.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parsePL } = require('../src/pl-parser');

const FIXTURES = path.join(__dirname, 'fixtures');
const read = (name) => fs.readFileSync(path.join(FIXTURES, name), 'utf8');

const LOST = "HH20260101 T1000000001 No Limit Hold'em €0,91 + €0,09.txt";
const WON = "HH20260102 T1000000002 No Limit Hold'em €0,91 + €0,09.txt";

test('parsePL: hero busts without cashing -> pl = -buyIn', () => {
  const r = parsePL(read(LOST), 'TestHero');
  assert.strictEqual(r.prize, 0);
  assert.strictEqual(r.buyIn, 1);
  assert.strictEqual(r.pl, -1);
});

test('parsePL: hero wins tournament -> prize counted, pl positive', () => {
  const r = parsePL(read(WON), 'TestHero');
  assert.strictEqual(r.prize, 2);
  assert.strictEqual(r.buyIn, 1);
  assert.strictEqual(r.pl, 1);
});

test('parsePL: buy-in parsed from header, not hardcoded', () => {
  const content = "PokerStars Hand #1: Tournament #9, €0.46+€0.04 EUR Hold'em No Limit\n";
  const r = parsePL(content, 'TestHero');
  assert.strictEqual(r.buyIn, 0.5);
  assert.strictEqual(r.prize, 0);
  assert.strictEqual(r.pl, -0.5);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/pl-parser.test.js`
Expected: FAIL — `Cannot find module '../src/pl-parser'`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/pl-parser.js
const round2 = (n) => Math.round(n * 100) / 100;

// Parse the first "€X.XX+€Y.YY" occurrence from the header and sum both parts.
// Handles both '.' and ',' as decimal separator. Falls back to 1 EUR.
function parseBuyIn(fileContent) {
  const match = fileContent.match(/€\s*(\d+[.,]\d+)\s*\+\s*€\s*(\d+[.,]\d+)/);
  if (!match) {
    return 1;
  }
  const a = parseFloat(match[1].replace(',', '.'));
  const b = parseFloat(match[2].replace(',', '.'));
  return round2(a + b);
}

// Sum every "<player> ... receives €X" line (there is at most one per tournament,
// but summing is robust). Handles '.' and ',' decimals.
function parsePrize(fileContent, playerName) {
  const escaped = playerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${escaped}\\b.*\\breceives €\\s*(\\d+[.,]\\d+)`, 'gm');
  let total = 0;
  let m = re.exec(fileContent);
  while (m) {
    total += parseFloat(m[1].replace(',', '.'));
    m = re.exec(fileContent);
  }
  return round2(total);
}

function parsePL(fileContent, playerName) {
  const buyIn = parseBuyIn(fileContent);
  const prize = parsePrize(fileContent, playerName);
  return { prize, buyIn, pl: round2(prize - buyIn) };
}

module.exports = { parsePL };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/pl-parser.test.js`
Expected: PASS (3 test).

- [ ] **Step 5: Lint**

Run: `npx eslint src/pl-parser.js`
Expected: nessun output (exit 0).

- [ ] **Step 6: Commit**

```bash
git add src/pl-parser.js test/pl-parser.test.js
git commit -m "feat: add pure parsePL parser for per-tournament profit/loss"
```

---

### Task 2: Formattazione data italiana (`formatDateShortIt`)

**Files:**
- Modify: `src/helpers/index.js` (aggiungere funzione + export)
- Test: `test/helpers.test.js`

**Interfaces:**
- Consumes: niente.
- Produces: `formatDateShortIt(yyyymmdd: string) => string` es. `'20260630' -> '30 Giu'`. Ritorna la stringa originale se non nel formato atteso.

- [ ] **Step 1: Write the failing test**

```js
// test/helpers.test.js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/helpers.test.js`
Expected: FAIL — `formatDateShortIt is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `src/helpers/index.js`, aggiungere prima del `module.exports`:

```js
const MONTHS_IT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

function formatDateShortIt(yyyymmdd) {
  if (typeof yyyymmdd !== 'string' || !/^\d{8}$/.test(yyyymmdd)) {
    return yyyymmdd;
  }
  const day = yyyymmdd.slice(6, 8);
  const monthIndex = Number(yyyymmdd.slice(4, 6)) - 1;
  const month = MONTHS_IT[monthIndex];
  if (!month) {
    return yyyymmdd;
  }
  return `${day} ${month}`;
}
```

E aggiungere `formatDateShortIt,` al `module.exports` (in ordine alfabetico, prima di `frameString`).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/helpers.test.js`
Expected: PASS (2 test).

- [ ] **Step 5: Lint**

Run: `npx eslint src/helpers/index.js`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/helpers/index.js test/helpers.test.js
git commit -m "feat: add italian short date formatter for chart labels"
```

---

### Task 3: Renderer del grafico (`renderPLChart`)

**Files:**
- Modify: `src/helpers/index.js` (aggiungere funzione + export)
- Test: `test/helpers.test.js` (aggiungere test)

**Interfaces:**
- Consumes: `formatDateShortIt` (Task 2), `chalk`.
- Produces: `renderPLChart(dailyData: Array<{ date: string, pl: number, games: number }>, maxBarWidth?: number) => string`. Barra proporzionale al `|pl|` massimo; a destra (verde dim) se `pl >= 0`, a sinistra (rosso dim) se `pl < 0`; asse centrale `│`. `maxBarWidth` default 20. Dati vuoti → `'Nessun dato'`.

- [ ] **Step 1: Write the failing test**

```js
// aggiungere a test/helpers.test.js
const { renderPLChart } = require('../src/helpers');

// eslint-disable-next-line no-control-regex
const stripAnsi = (s) => s.replace(/\[[0-9;]*m/g, '');

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/helpers.test.js`
Expected: FAIL — `renderPLChart is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `src/helpers/index.js`, richiede `chalk` in cima (verificare se già importato; se no aggiungere `const chalk = require('chalk');`). Aggiungere prima del `module.exports`:

```js
const BAR_CHAR = '▓';

// Divergent horizontal bar chart. Positive P/L extends right of a central axis
// (dim green), negative extends left (dim red). Bar length is proportional to the
// largest |pl| in the data set, capped at maxBarWidth.
function renderPLChart(dailyData, maxBarWidth = 20) {
  if (!dailyData || dailyData.length === 0) {
    return 'Nessun dato';
  }

  const maxAbs = dailyData.reduce((m, d) => Math.max(m, Math.abs(d.pl)), 0);
  const label = (d) => formatDateShortIt(d.date);
  const labelWidth = dailyData.reduce((m, d) => Math.max(m, label(d).length), 0);

  const barLen = (pl) => {
    if (maxAbs === 0 || pl === 0) {
      return 0;
    }
    return Math.max(1, Math.round((Math.abs(pl) / maxAbs) * maxBarWidth));
  };

  const lines = dailyData.map((d) => {
    const lbl = label(d).padEnd(labelWidth);
    const len = barLen(d.pl);
    const value = `${d.pl >= 0 ? '' : '-'}${Math.abs(d.pl).toFixed(2)}€`;
    const games = `(${d.games})`;

    if (d.pl < 0) {
      const bar = chalk.dim.red(BAR_CHAR.repeat(len));
      const pad = ' '.repeat(maxBarWidth - len);
      return `${lbl} ${pad}${bar}│ ${value} ${games}`;
    }
    const bar = chalk.dim.green(BAR_CHAR.repeat(len));
    return `${lbl} ${' '.repeat(maxBarWidth)}│${bar} ${value} ${games}`;
  });

  const axisPad = ' '.repeat(labelWidth + 1 + maxBarWidth);
  lines.push(`${axisPad}┴`);

  return lines.join('\n');
}
```

E aggiungere `renderPLChart,` al `module.exports` (ordine alfabetico).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/helpers.test.js`
Expected: PASS (tutti, inclusi i test di Task 2).

- [ ] **Step 5: Lint**

Run: `npx eslint src/helpers/index.js`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/helpers/index.js test/helpers.test.js
git commit -m "feat: add divergent bar chart renderer for daily P/L"
```

---

### Task 4: Aggregatore giornaliero (`buildDailyPL`)

**Files:**
- Modify: `src/parse-files/sync.js`
- Test: `test/build-daily-pl.test.js`

**Interfaces:**
- Consumes: `parsePL` (Task 1), `extractTimeFromFilename` (esistente in helpers), `fs`, `path`.
- Produces: `buildDailyPL(directory: string, timeFilter: number|string, playerName: string) => Array<{ date: string, pl: number, games: number }>` ordinato cronologicamente per `date`. Legge in modo sincrono i file `HH*` con data `>= timeFilter`, li raggruppa per `YYYYMMDD`.

- [ ] **Step 1: Write the failing test**

```js
// test/build-daily-pl.test.js
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { buildDailyPL } = require('../src/parse-files/sync');

const FIXTURES = path.join(__dirname, 'fixtures');

test('buildDailyPL: groups per day with pl and game count', () => {
  const data = buildDailyPL(FIXTURES, 20260101, 'TestHero');
  // fixture 1: 20260101, hero busts -> pl -1 ; fixture 2: 20260102, hero wins -> pl +1
  assert.deepStrictEqual(data, [
    { date: '20260101', pl: -1, games: 1 },
    { date: '20260102', pl: 1, games: 1 },
  ]);
});

test('buildDailyPL: timeFilter excludes earlier days', () => {
  const data = buildDailyPL(FIXTURES, 20260102, 'TestHero');
  assert.deepStrictEqual(data, [
    { date: '20260102', pl: 1, games: 1 },
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/build-daily-pl.test.js`
Expected: FAIL — `buildDailyPL is not a function` / undefined.

- [ ] **Step 3: Write minimal implementation**

In `src/parse-files/sync.js`, aggiungere l'import di `parsePL` in cima:

```js
const { parsePL } = require('../pl-parser');
```

Aggiungere la funzione (sopra `module.exports`):

```js
const round2 = (n) => Math.round(n * 100) / 100;

// Read all HH* files at/after timeFilter, compute per-tournament P/L, and
// aggregate into one entry per calendar day sorted chronologically.
function buildDailyPL(directory, timeFilter, playerName) {
  const filter = Number(timeFilter);
  const files = fs.readdirSync(directory)
    .filter((file) => file.startsWith('HH'))
    .filter((file) => {
      const time = extractTimeFromFilename(file);
      return time !== null && Number(time) >= filter;
    });

  const byDay = new Map();
  files.forEach((filename) => {
    const date = extractTimeFromFilename(filename);
    const content = fs.readFileSync(path.join(directory, filename), 'utf8');
    const { pl } = parsePL(content, playerName);

    const entry = byDay.get(date) || { date, pl: 0, games: 0 };
    entry.pl = round2(entry.pl + pl);
    entry.games += 1;
    byDay.set(date, entry);
  });

  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}
```

Aggiungere `buildDailyPL` al `module.exports`:

```js
module.exports = {
  parseAllOldFiles,
  buildDailyPL,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/build-daily-pl.test.js`
Expected: PASS (2 test).

- [ ] **Step 5: Lint**

Run: `npx eslint src/parse-files/sync.js`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/parse-files/sync.js test/build-daily-pl.test.js
git commit -m "feat: aggregate per-tournament P/L into daily totals"
```

---

### Task 5: Selezione vista in `index.js` (flag + prompt)

**Files:**
- Modify: `index.js`
- Test: `test/view-selection.test.js`

**Interfaces:**
- Consumes: `buildDailyPL` (Task 4), `renderPLChart` (Task 3), `parseAllOldFiles` (esistente).
- Produces: comportamento CLI. `--view=graph` → grafico; `--view=detail` → vista attuale; nessun `--view` → prompt readline `[1]/[2]`.

- [ ] **Step 1: Write the failing test**

```js
// test/view-selection.test.js
const test = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const FIXTURES = path.join(__dirname, 'fixtures');

function runCli(extraArgs) {
  const out = execFileSync('node', [
    path.join(ROOT, 'index.js'),
    '--name=TestHero',
    '--timestamp=20260101',
    `--dir=${FIXTURES}`,
    ...extraArgs,
  ], { encoding: 'utf8', cwd: ROOT });
  // eslint-disable-next-line no-control-regex
  return out.replace(/\[[0-9;]*m/g, '').replace(/\[[0-9]*[A-Z]/g, '');
}

test('--view=graph renders the daily chart, not the all-in detail', () => {
  const out = runCli(['--view=graph']);
  assert.ok(out.includes('30 Giu') || out.includes('01 Gen') || out.includes('02 Gen'),
    'chart should contain italian short dates');
  assert.ok(!out.includes('All-in ≥ 50% Equity'), 'should not show the detail stats box');
});

test('--view=detail renders the all-in detail view', () => {
  const out = runCli(['--view=detail']);
  assert.ok(out.includes('All-in ≥ 50% Equity'), 'should show the detail stats box');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/view-selection.test.js`
Expected: FAIL — `--view=graph` mostra ancora il detail (il flag non è gestito), quindi il primo test fallisce sull'assenza di `30 Giu`.

- [ ] **Step 3: Write minimal implementation**

Sostituire in `index.js` il blocco finale (da `const directoryArgv = ...` in poi) con:

```js
const readline = require('readline');
const { parseAllOldFiles, buildDailyPL } = require('./src/parse-files/sync');
const { renderPLChart } = require('./src/helpers');

const directoryArgv = argv.dir || './';
const {
  timestamp: timeFilterArgv,
  name: argvName,
  anonymize: argvAnonymyze,
  view: viewArgv,
} = argv;

const anonymousName = argvAnonymyze ? 'JohnDoe' : argvName;

function showDetail() {
  // The real name (argvName) drives parsing; anonymousName is only for display.
  parseAllOldFiles(directoryArgv, timeFilterArgv, argvName, anonymousName);
}

function showGraph() {
  const daily = buildDailyPL(directoryArgv, timeFilterArgv, argvName);
  console.log('\n');
  console.log(renderPLChart(daily));
  console.log('\n');
}

function run(view) {
  if (view === 'graph') {
    showGraph();
  } else {
    showDetail();
  }
}

if (viewArgv === 'graph' || viewArgv === 'detail') {
  run(viewArgv);
} else {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = () => {
    rl.question('Cosa vuoi vedere?\n  [1] Dettaglio all-in\n  [2] Grafico P/L giornaliero\n> ', (answer) => {
      const choice = answer.trim();
      if (choice === '1') {
        rl.close();
        run('detail');
      } else if (choice === '2') {
        rl.close();
        run('graph');
      } else {
        ask();
      }
    });
  };
  ask();
}
```

Rimuovere la vecchia riga `require` di `parseAllOldFiles` in cima al file (riga 3) se ora duplicata: mantenere un solo `require('./src/parse-files/sync')`. Verificare che l'import in cima venga rimosso e sostituito da quello nuovo che include anche `buildDailyPL`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/view-selection.test.js`
Expected: PASS (2 test). Nota: con `--view=...` readline non viene istanziato, quindi il processo termina senza restare appeso.

- [ ] **Step 5: Full suite + lint**

Run: `node --test` poi `npx eslint src/ index.js`
Expected: tutti i test PASS, eslint exit 0.

- [ ] **Step 6: Manual smoke test**

Run:
```bash
node index.js --name=Jeff81088 --timestamp=20260601 --view=graph --dir="/Users/lucatagliabue/Library/Application Support/PokerStarsItaly/HandHistory/Jeff81088"
```
Expected: grafico a barre con date italiane, barre verdi a destra / rosse a sinistra, valori € e conteggio tornei per riga.

- [ ] **Step 7: Commit**

```bash
git add index.js test/view-selection.test.js
git commit -m "feat: add --view flag and interactive prompt to pick detail or P/L graph"
```

---

## Note per l'esecutore

- La vista `detail` esistente NON deve cambiare comportamento: i test in `test/parser.test.js` devono continuare a passare a ogni task.
- `readline` viene istanziato SOLO quando `--view` è assente: mai nei test (che passano sempre `--view`), così i test non restano appesi in attesa di input.
- `src/parse-files/async.js` è fuori scope: non toccarlo.
