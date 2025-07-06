const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { allInParser } = require('../all-in-parser');
const {
  frameString, parseDateAndTime, extractTimeFromFilename, printEquityStats,
} = require('../helpers');

function parseFileSync(filePath, filename, argvName, isLast) {
  console.log(`${frameString(`${filename} - ${parseDateAndTime(filename)} - ${argvName}`)}\n\n`);

  const fileContent = fs.readFileSync(filePath, { encoding: 'utf8' });

  const {
    moreThanFifty, lessThenFifty, wins, looses,
  } = allInParser(fileContent);

  if (isLast) {
    console.log(`\n${chalk.cyan(printEquityStats(moreThanFifty, lessThenFifty, wins, looses))}`);
    console.log('\n\n\n\n');
  } else {
    console.log('\n\n\n\n');
  }
}

function parseAllOldFiles(directoryArgv, timeFilterArgv, argvName) {
  fs.readdir(directoryArgv, (err, files) => {
    if (err) {
      console.error(chalk.red('Errore nella lettura della directory:'), err);
      return;
    }

    const hhFiles = files
      .filter((file) => file.startsWith('HH'))
      .filter((file) => {
        const time = extractTimeFromFilename(file);
        return time >= timeFilterArgv;
      })
      .sort((a, b) => a.localeCompare(b));

    hhFiles.forEach((filename, index) => {
      const fullPath = path.join(directoryArgv, filename);

      parseFileSync(fullPath, filename, argvName, index === hhFiles.length - 1);
    });
  });
}

module.exports = {
  parseAllOldFiles,
};
