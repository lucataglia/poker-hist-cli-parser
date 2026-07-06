const chalk = require('chalk');

const pretty = (card) => card.split('').map((char) => {
  switch (char) {
    case 'h': return '❤️';
    case 'd': return '🔷';
    case 'c': return '☘️';
    case 's': return '♠️';
    default: return char;
  }
}).join(' ');

const prettyHand = ([a, b, c, d]) => {
  const card1 = pretty(a + b);
  const card2 = pretty(c + d);

  return `${card1}  ${card2}`;
};

const prettyBoard = (board) => {
  const [a, b, c, d, e] = board.split(' ');

  const card1 = `${pretty(a)}  `;

  const card2 = `${pretty(b)}  `;

  const card3 = d
    ? `${pretty(c)}  `
    : pretty(c);

  const card4 = d
    ? e
      ? `${pretty(d)}  `
      : pretty(d)
    : '';

  const card5 = e
    ? pretty(e)
    : '';

  return `${card1}${card2}${card3}${card4}${card5}`;
};

function printEquityStats(
  allInAbove50,
  allInUnder50,
  wins,
  losses,
  total,
  itm,
  header = 'Stats current session',
) {
  // Convert numbers to strings
  const plusMinus = allInAbove50 - allInUnder50;
  const plusMinusWins = wins - losses;

  const above50Str = allInAbove50.toString();
  const under50Str = allInUnder50.toString();
  const plusMinusStr = plusMinus.toString();
  const winsStr = wins.toString();
  const lossesStr = losses.toString();
  const plusMinusWinsStr = plusMinusWins.toString();
  const totalStr = total.toString();
  const itmStr = itm.toString();

  // Labels
  const label1 = 'All-in ≥ 50% Equity';
  const label2 = 'All-in < 50% Equity';
  const label3 = 'Wins';
  const label4 = 'Losses';
  const label5 = 'Plus/Minus';
  const label6 = 'Plus/Minus Wins';
  const label7 = 'Total';
  const label8 = 'ITM';

  // Calculate max label length and max value length to align nicely
  const maxLabelLength = Math.max(
    label1.length,
    label2.length,
    label3.length,
    label4.length,
    label5.length,
    label7.length,
  );

  const maxValueLength = Math.max(
    above50Str.length,
    under50Str.length,
    plusMinusStr.length,
    winsStr.length,
    lossesStr.length,
    plusMinusWinsStr.length,
    itmStr.length,
  );

  // Calculate content width (label + padding + value)
  const padding = 2; // spaces between label and value
  const contentWidth = maxLabelLength + padding + maxValueLength;

  // Calculate total width of the box (including borders)
  let totalWidth = contentWidth + 4;

  // If header is longer than totalWidth - 2 (because corners take 2 chars), adjust totalWidth
  if (header.length + 2 > totalWidth) {
    totalWidth = header.length + 2;
  }

  // Helper to create horizontal line
  const horizontalLine = '─'.repeat(totalWidth - 2);

  // Helper to pad strings
  function padRight(str, length) {
    return str + ' '.repeat(length - str.length);
  }
  function padLeft(str, length) {
    return ' '.repeat(length - str.length) + str;
  }

  // Helper to center header text inside the box width minus 2 (for borders)
  function centerText(text, width) {
    const totalSpaces = width - text.length;
    const leftSpaces = Math.floor(totalSpaces / 2);
    const rightSpaces = totalSpaces - leftSpaces;
    return ' '.repeat(leftSpaces) + text + ' '.repeat(rightSpaces);
  }

  // Build the box lines
  const lines = [];
  lines.push(`┌${horizontalLine}┐`);
  lines.push(`│${centerText(header, totalWidth - 2)}│`);
  lines.push(`├${horizontalLine}┤`);
  lines.push(`│ ${padRight(label1, maxLabelLength)}  ${padLeft(above50Str, maxValueLength)} │`);
  lines.push(`│ ${padRight(label2, maxLabelLength)}  ${padLeft(under50Str, maxValueLength)} │`);
  lines.push(`│ ${padRight('', maxLabelLength)}  ${padLeft('', maxValueLength)} │`);
  lines.push(`│ ${padRight(label3, maxLabelLength)}  ${padLeft(winsStr, maxValueLength)} │`);
  lines.push(`│ ${padRight(label4, maxLabelLength)}  ${padLeft(lossesStr, maxValueLength)} │`);
  lines.push(`│ ${padRight('', maxLabelLength)}  ${padLeft('', maxValueLength)} │`);
  lines.push(`│ ${padRight(label5, maxLabelLength)}  ${padLeft(plusMinusStr, maxValueLength)} │`);
  lines.push(`│ ${padRight(label6, maxLabelLength)}  ${padLeft(plusMinusWinsStr, maxValueLength)} │`);
  lines.push(`│ ${padRight('', maxLabelLength)}  ${padLeft('', maxValueLength)} │`);
  lines.push(`│ ${padRight('', maxLabelLength)}  ${padLeft('', maxValueLength)} │`);
  lines.push(`│ ${padRight(label7, maxLabelLength)}  ${padLeft(totalStr, maxValueLength)} │`);
  lines.push(`│ ${padRight(label8, maxLabelLength)}  ${padLeft(itmStr, maxValueLength)} │`);
  lines.push(`└${horizontalLine}┘`);

  // Join lines with newline and return
  return lines.join('\n');
}

function frameString(str) {
  const { length } = str;
  const horizontalLine = '─'.repeat(length + 2); // +2 for padding spaces

  // Build the framed string
  const lines = [];
  lines.push(`┌${horizontalLine}┐`);
  lines.push(`│ ${str} │`);
  lines.push(`└${horizontalLine}┘`);

  return lines.join('\n');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDateShort(yyyymmdd) {
  if (typeof yyyymmdd !== 'string' || !/^\d{8}$/.test(yyyymmdd)) {
    return yyyymmdd;
  }
  const day = yyyymmdd.slice(6, 8);
  const monthIndex = Number(yyyymmdd.slice(4, 6)) - 1;
  const month = MONTHS[monthIndex];
  if (!month) {
    return yyyymmdd;
  }
  return `${day} ${month}`;
}

function formatDateLong(yyyymmdd) {
  const short = formatDateShort(yyyymmdd); // 'DD Mmm' or the raw input if malformed
  if (short === yyyymmdd) {
    return yyyymmdd;
  }
  return `${short} ${yyyymmdd.slice(0, 4)}`;
}

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

const BAR_CHAR = '▓';

// Divergent horizontal bar chart. Positive P/L extends right of a central axis
// (dim green), negative extends left (dim red). Bar length is proportional to the
// largest |pl| in the data set, capped at maxBarWidth.
function renderPLChart(dailyData, maxBarWidth = 20) {
  if (!dailyData || dailyData.length === 0) {
    return 'Nessun dato';
  }

  const maxAbs = dailyData.reduce((m, d) => Math.max(m, Math.abs(d.pl)), 0);

  const barLen = (pl) => {
    if (maxAbs === 0 || pl === 0) {
      return 0;
    }
    return Math.max(1, Math.round((Math.abs(pl) / maxAbs) * maxBarWidth));
  };

  // The left side of each row (date + record + game count) has a variable width,
  // and the colored numbers carry invisible ANSI codes. Build a plain version for
  // measuring/alignment and a colored version for display, then pad by visible width.
  // The record is bare numbers "[W ITM L]"; a legend line above maps color -> meaning.
  const rows = dailyData.map((d) => {
    const wins = d.wins || 0;
    const itm = d.itm || 0;
    const losses = d.losses || 0;
    const date = formatDateShort(d.date);

    // Record "[W(ITM) L]": bare numbers, W green, ITM (a subset of W) bright blue
    // in parentheses next to W, L red. A legend line above maps color -> meaning.
    const recordPlain = `[${wins}(${itm}) ${losses}]`;
    const recordColored = `[${chalk.green(wins)}(${chalk.blueBright(itm)}) ${chalk.red(losses)}]`;
    const games = `(${d.games})`;

    const plainLeft = `${date} ${recordPlain} ${games}`;
    const coloredLeft = `${date} ${recordColored} ${games}`;
    return {
      d, plainLeft, coloredLeft, plainWidth: plainLeft.length,
    };
  });

  const leftWidth = rows.reduce((m, r) => Math.max(m, r.plainWidth), 0);

  const lines = rows.map(({ d, coloredLeft, plainWidth }) => {
    const leftPad = ' '.repeat(leftWidth - plainWidth);
    const left = `${coloredLeft}${leftPad}`;
    const len = barLen(d.pl);
    const value = `${d.pl >= 0 ? '' : '-'}${Math.abs(d.pl).toFixed(2)}€`;

    if (d.pl < 0) {
      const bar = chalk.dim.red(BAR_CHAR.repeat(len));
      const pad = ' '.repeat(maxBarWidth - len);
      return `${left} ${pad}${bar}│ ${value}`;
    }
    const bar = chalk.dim.green(BAR_CHAR.repeat(len));
    return `${left} ${' '.repeat(maxBarWidth)}│${bar} ${value}`;
  });

  const axisPad = ' '.repeat(leftWidth + 1 + maxBarWidth);
  lines.push(`${axisPad}┴`);

  // Legend maps each colored number position to its meaning. ITM is a subset of W.
  const legend = `Legend: [${chalk.green('W')}(${chalk.blueBright('ITM')}) ${chalk.red('L')}] (games)`;

  return [legend, '', ...lines].join('\n');
}

const round2 = (n) => Math.round(n * 100) / 100;

// Summary box for the all-in EV view. luck = actualChips - evChips: green when
// running at/above expectation, red when below.
function renderEVSummary(totals) {
  const {
    count, actualChips, evChips, avgEquity,
    aheadCount = 0, actualBb = 0, evBb = 0,
    tournaments = 0, periodStart = null, periodEnd = null,
  } = totals;
  if (!count) {
    return 'No all-in showdowns found';
  }
  const luck = actualChips - evChips;
  const luckStr = `${luck >= 0 ? '+' : ''}${luck}`;
  const luckColored = luck >= 0 ? chalk.green(luckStr) : chalk.red(luckStr);

  const luckBb = Math.round((actualBb - evBb) * 10) / 10;
  const luckBbStr = `${luckBb >= 0 ? '+' : ''}${luckBb}`;
  const luckBbColored = luckBb >= 0 ? chalk.green(luckBbStr) : chalk.red(luckBbStr);

  const avgPct = (avgEquity * 100).toFixed(1);
  const aheadPct = Math.round((aheadCount / count) * 100);

  const lines = ['All-in EV summary (showdown hands only)', ''];

  if (periodStart) {
    const period = (periodEnd && periodEnd !== periodStart)
      ? `${formatDateLong(periodStart)} → ${formatDateLong(periodEnd)}`
      : formatDateLong(periodStart);
    lines.push(`  Period                 ${period}`);
  }
  lines.push(`  Tournaments            ${tournaments}`);
  lines.push('');
  lines.push(`  All-ins analyzed       ${count}`);
  lines.push(`  Actual chips won       ${actualChips}  (${actualBb} bb)`);
  lines.push(`  Expected chips (EV)    ${evChips}  (${evBb} bb)`);
  lines.push(`  Luck (actual - EV)     ${luckColored}  (${luckBbColored} bb)`);
  lines.push(`  Avg equity when all-in ${avgPct}%`);
  lines.push(`  All-in ahead (>=50%)   ${aheadPct}%`);

  if (count < 30) {
    lines.push('');
    lines.push(chalk.yellow('  ⚠ Small sample (<30 all-ins) - treat as indicative only'));
  }

  return lines.join('\n');
}

module.exports = {
  extractTimeFromFilename,
  formatDateShort,
  frameString,
  parseDateAndTime,
  prettyBoard,
  prettyHand,
  printEquityStats,
  renderEVSummary,
  renderPLChart,
  round2,
};
