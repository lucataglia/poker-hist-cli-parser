const chalk = require('chalk');
const argv = require('minimist')(process.argv.slice(2));
const { parseAllOldFiles } = require('./src/parse-files/sync');

const mandatoryFields = ['timestamp', 'name'];
const missingFields = mandatoryFields.filter((field) => !argv[field] || argv[field].toString().trim() === '');

if (missingFields.length > 0) {
  const tableData = missingFields.map((field) => ({ 'Missing field Name': field }));

  console.log('\n');

  console.error(chalk.yellow('Missing mandatory missing\n\n'));
  console.table(tableData);

  console.log('\n');

  console.log(chalk.bold.cyan('Example: ') + chalk.cyan('node index.js --name=<your_poker_name> --dir=<abs_path> --timestamp=YYYYMMDD'));

  console.log('\n');
  process.exit(1);
}

console.clear();

const directoryArgv = argv.dir || './';
const { timestamp: timeFilterArgv } = argv;
const { name: argvName } = argv;

parseAllOldFiles(directoryArgv, timeFilterArgv, argvName);
