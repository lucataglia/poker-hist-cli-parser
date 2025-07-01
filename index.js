const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const argv = require('minimist')(process.argv.slice(2));
const { allInParser } = require('./all-in-parser');
const { frameString } = require('./helpers');

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
const streamed = {};

function extractTimeFromFilename(filename) {
  const regex = /HH(\d{8})/;
  const match = filename.match(regex);

  if (match) {
    return match[1];
  }

  return null;
}

function parseDateAndTime(filename) {
  const regex = /HH(\d{8})/;
  const match = filename.match(regex);

  if (match) {
    const dateStr = match[1];
    const year = dateStr.slice(0, 4);
    const month = dateStr.slice(4, 6);
    const day = dateStr.slice(6, 8);

    return `${day}/${month}/${year}`;
  }

  return null;
}

function parseFile(filePath, filename) {
  const fileStream = fs.createReadStream(filePath, {
    encoding: 'utf8',
    start: streamed[filename] || 0,
  });

  fileStream.on('data', (chunk) => {
    console.log(`${frameString(`${filename} - ${parseDateAndTime(filename)} - ${argvName}`)}\n\n`); // Aggiunto il nome del file prima di iniziare il parsing
    streamed[filename] = (streamed[filename] || 0) + chunk.length;
    allInParser(chunk); // Elabora i dati letti dal file
  });
}

function parseAllOldFiles() {
  fs.readdir(directoryArgv, (err, files) => {
    if (err) {
      console.error(chalk.red('Errore nella lettura della directory:'), err);
      return;
    }

    const hhFiles = files
      .filter((file) => file.startsWith('HH'))
      .sort((a, b) => a.localeCompare(b));

    hhFiles.forEach((file) => {
      const time = extractTimeFromFilename(file);

      if (timeFilterArgv > time) {
        return;
      }

      const fullPath = path.join(directoryArgv, file);

      streamed[file] = 0;

      parseFile(fullPath, file);
    });
  });
}

parseAllOldFiles();
