const round2 = (n) => Math.round(n * 100) / 100;

// Parse the first "€X.XX+€Y.YY" occurrence from the header and sum both parts.
// Handles both '.' and ',' as decimal separator. Falls back to 1 EUR.
function parseBuyIn(fileContent) {
  const match = fileContent.match(/€\s*(\d+[.,]\d+)\s*\+\s*€\s*(\d+[.,]\d+)/);
  if (!match) {
    return 1;
  }
  const a = parseFloat(match[1].replace(',', '.'));
  const b = parseFloat(match[2].replace(',', '.'));
  return round2(a + b);
}

// Sum every "<player> ... receives €X" line (there is at most one per tournament,
// but summing is robust). Handles '.' and ',' decimals.
function parsePrize(fileContent, playerName) {
  const escaped = playerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${escaped}\\b.*\\breceives €\\s*(\\d+[.,]\\d+)`, 'gm');
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
