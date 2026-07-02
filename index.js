const chalk = require('chalk');
const argv = require('minimist')(process.argv.slice(2));

const mandatoryFields = ['timestamp', 'name'];
const missingFields = mandatoryFields.filter((field) => !argv[field] || argv[field].toString().trim() === '');

if (missingFields.length > 0) {
  const tableData = missingFields.map((field) => ({ 'Missing field Name': field }));

  console.log('\n');

  console.error(chalk.yellow('Missing mandatory fields\n\n'));
  console.table(tableData);

  console.log('\n');

  console.log(chalk.bold.cyan('Example: ') + chalk.cyan('node index.js --name=<your_poker_name> --dir=<abs_path> --timestamp=YYYYMMDD'));

  console.log('\n');
  process.exit(1);
}

console.clear();

const readline = require('readline');
const { parseAllOldFiles, buildDailyPL, buildAllInEV } = require('./src/parse-files/sync');
const { renderPLChart, renderEVSummary } = require('./src/helpers');

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

function showEV() {
  const totals = buildAllInEV(directoryArgv, timeFilterArgv, argvName);
  console.log('\n');
  console.log(renderEVSummary(totals));
  console.log('\n');
}

function run(view) {
  if (view === 'graph') {
    showGraph();
  } else if (view === 'ev') {
    showEV();
  } else {
    showDetail();
  }
}

if (viewArgv === 'graph' || viewArgv === 'detail' || viewArgv === 'ev') {
  run(viewArgv);
} else {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = () => {
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
  };
  ask();
}
