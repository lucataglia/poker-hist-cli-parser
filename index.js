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
