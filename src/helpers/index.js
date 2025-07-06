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

  // Labels
  const label1 = 'All-in ≥ 50% Equity';
  const label2 = 'All-in < 50% Equity';
  const label3 = 'Wins';
  const label4 = 'Losses';
  const label5 = 'Plus/Minus';
  const label6 = 'Plus/Minus Wins';

  // Calculate max label length and max value length to align nicely
  const maxLabelLength = Math.max(
    label1.length,
    label2.length,
    label3.length,
    label4.length,
    label5.length,
  );

  const maxValueLength = Math.max(
    above50Str.length,
    under50Str.length,
    plusMinusStr.length,
    winsStr.length,
    lossesStr.length,
    plusMinusWinsStr.length,
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

module.exports = {
  extractTimeFromFilename,
  frameString,
  parseDateAndTime,
  prettyBoard,
  prettyHand,
  printEquityStats,
};
