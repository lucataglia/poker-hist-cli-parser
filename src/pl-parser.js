const { round2 } = require('./helpers');

// Parse the buy-in span (€amount+€amount+... followed by a space and currency code)
// and sum ALL €-parts. Handles both '.' and ',' as decimal separator. Falls back to 1 EUR.
function parseBuyIn(fileContent) {
  // Match the full buy-in expression: one or more "€amount" separated by "+"
  // that appears before " EUR" (or end-of-line) in the header.
  const spanMatch = fileContent.match(/(€\s*\d+(?:[.,]\d+)?(?:\s*\+\s*€\s*\d+(?:[.,]\d+)?)+)/);
  if (!spanMatch) {
    return 1;
  }
  const span = spanMatch[1];
  const parts = span.match(/€\s*(\d+(?:[.,]\d+)?)/g);
  if (!parts) {
    return 1;
  }
  const total = parts.reduce((sum, part) => {
    const num = parseFloat(part.replace(/€\s*/, '').replace(',', '.'));
    return sum + num;
  }, 0);
  return round2(total);
}

// Sum every "<player> ... receives €X" line (there is at most one per tournament,
// but summing is robust). Handles '.' and ',' decimals.
function parsePrize(fileContent, playerName) {
  const escaped = playerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${escaped}\\b.*\\breceives €\\s*(\\d+(?:[.,]\\d+)?)`, 'gm');
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
