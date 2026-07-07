const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { allInParser } = require('../all-in-parser');
const {
  frameString, parseDateAndTime, extractTimeFromFilename, printEquityStats, round2,
} = require('../helpers');
const { parsePL } = require('../pl-parser');
const { parseAllInEV } = require('../ev-parser');
const { parseShowdownSplit } = require('../lines-parser');

function parseFileSync(filePath, filename, argvName, displayName, isLast) {
  const headerName = displayName || argvName;
  console.log(`${frameString(`${filename} - ${parseDateAndTime(filename)} - ${headerName}`)}\n\n`);

  const fileContent = fs.readFileSync(filePath, { encoding: 'utf8' });

  const {
    moreThanFifty, lessThenFifty, wins, looses, total, itm,
  } = allInParser(fileContent, argvName);

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

// Read all HH* files at/after timeFilter and aggregate hero all-in EV spots into
// one totals object. avgEquity is the mean spot equity across all files.
// FIX 4 (DRY): reuse parseAllInEV's returned totals instead of re-implementing
// the reduction. avgEquity is kept as a weighted mean: sum(equity per spot) / totalCount.
function buildAllInEV(directory, timeFilter, playerName) {
  const filter = Number(timeFilter);
  const files = fs.readdirSync(directory)
    .filter((file) => file.startsWith('HH'))
    .filter((file) => {
      const time = extractTimeFromFilename(file);
      return time !== null && Number(time) >= filter;
    });

  let count = 0;
  let actualChips = 0;
  let evChips = 0;
  let equitySum = 0;
  let aheadCount = 0;
  let actualBb = 0;
  let evBb = 0;
  let periodStart = null;
  let periodEnd = null;

  files.forEach((filename) => {
    const date = extractTimeFromFilename(filename);
    if (date !== null) {
      if (periodStart === null || date < periodStart) { periodStart = date; }
      if (periodEnd === null || date > periodEnd) { periodEnd = date; }
    }
    const content = fs.readFileSync(path.join(directory, filename), 'utf8');
    const { totals } = parseAllInEV(content, playerName);
    count += totals.count;
    actualChips += totals.actualChips;
    evChips += totals.evChips;
    equitySum += totals.avgEquity * totals.count;
    aheadCount += totals.aheadCount;
    actualBb += totals.actualBb;
    evBb += totals.evBb;
  });

  const round1 = (n) => Math.round(n * 10) / 10;
  const avgEquity = count === 0 ? 0 : equitySum / count;
  return {
    count,
    actualChips,
    evChips,
    avgEquity,
    aheadCount,
    actualBb: round1(actualBb),
    evBb: round1(evBb),
    tournaments: files.length,
    periodStart,
    periodEnd,
  };
}

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

function buildDailyDetail(directory, timeFilter, playerName) {
  const filter = Number(timeFilter);
  const files = fs.readdirSync(directory)
    .filter((file) => file.startsWith('HH'))
    .filter((file) => {
      const time = extractTimeFromFilename(file);
      return time !== null && Number(time) >= filter;
    })
    .sort((a, b) => a.localeCompare(b));

  const byDay = new Map();
  let won = 0;
  let lost = 0;
  let played = 0;
  let netTotal = 0;

  files.forEach((filename) => {
    const date = extractTimeFromFilename(filename);
    const content = fs.readFileSync(path.join(directory, filename), 'utf8');
    const {
      pl, prize, position, prizePool, buyIn, tableSize,
    } = parsePL(content, playerName);

    const tournament = {
      buyIn,
      prizePool,
      position,
      net: pl,
      tableSize,
    };

    const entry = byDay.get(date) || { date, tournaments: [] };
    entry.tournaments.push(tournament);
    byDay.set(date, entry);

    played += 1;
    if (prize > 0) { won += 1; } else { lost += 1; }
    netTotal = Math.round((netTotal + pl) * 100) / 100;
  });

  const days = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
  return {
    days,
    totals: {
      won, lost, played, netTotal,
    },
  };
}

module.exports = {
  parseAllOldFiles,
  buildDailyPL,
  buildAllInEV,
  buildShowdownSplit,
  buildDailyDetail,
};
