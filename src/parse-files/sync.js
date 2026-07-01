const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { allInParser } = require('../all-in-parser');
const {
  frameString, parseDateAndTime, extractTimeFromFilename, printEquityStats, round2,
} = require('../helpers');
const { parsePL } = require('../pl-parser');

function parseFileSync(filePath, filename, argvName, displayName, isLast) {
  const headerName = displayName || argvName;
  console.log(`${frameString(`${filename} - ${parseDateAndTime(filename)} - ${headerName}`)}\n\n`);

  const fileContent = fs.readFileSync(filePath, { encoding: 'utf8' });

  const {
    moreThanFifty, lessThenFifty, wins, looses, total, itm,
  } = allInParser(fileContent);

  if (isLast) {
    console.log(`\n${chalk.cyan(printEquityStats(moreThanFifty, lessThenFifty, wins, looses, total, itm))}`);
    console.log('\n\n\n\n');
  } else {
    console.log('\n\n\n\n');
  }
}

function parseAllOldFiles(directoryArgv, timeFilterArgv, argvName, displayName) {
  fs.readdir(directoryArgv, (err, files) => {
    if (err) {
      console.error(chalk.red('Errore nella lettura della directory:'), err);
      return;
    }

    const timeFilter = Number(timeFilterArgv);

    const hhFiles = files
      .filter((file) => file.startsWith('HH'))
      .filter((file) => {
        const time = extractTimeFromFilename(file);
        return time !== null && Number(time) >= timeFilter;
      })
      .sort((a, b) => a.localeCompare(b));

    hhFiles.forEach((filename, index) => {
      const fullPath = path.join(directoryArgv, filename);

      parseFileSync(fullPath, filename, argvName, displayName, index === hhFiles.length - 1);
    });
  });
}

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
    const { pl, prize, won } = parsePL(content, playerName);

    const entry = byDay.get(date) || {
      date, pl: 0, games: 0, wins: 0, itm: 0, losses: 0,
    };
    entry.pl = round2(entry.pl + pl);
    entry.games += 1;
    // wins = tournaments won (1st place); itm = tournaments where the hero cashed
    // (received a prize); losses = neither. In a winner-take-all these coincide,
    // but they are tracked separately so multi-payout formats stay correct.
    if (won) {
      entry.wins += 1;
    }
    if (prize > 0) {
      entry.itm += 1;
    }
    if (!won && prize <= 0) {
      entry.losses += 1;
    }
    byDay.set(date, entry);
  });

  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

module.exports = {
  parseAllOldFiles,
  buildDailyPL,
};
