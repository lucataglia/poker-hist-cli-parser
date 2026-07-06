// src/ev-parser.js
const { TexasHoldem } = require('poker-odds-calc');

const round = (n) => Math.round(n);

// FIX 2: Snapshot the board at the HERO's FIRST all-in, not the global last all-in.
// The hero committed on a specific street; equity must be computed from that point.
// Preflop hero all-in => board is still empty ([]).
// Streets appear as "*** FLOP *** [a b c]", "*** TURN *** [a b c] [d]",
// "*** RIVER *** [a b c d] [e]".
function boardAtAllIn(lines, playerName) {
  let currentBoard = [];
  let boardSnapshot = null;
  lines.forEach((row) => {
    const flop = row.match(/^\*\*\* FLOP \*\*\* \[([^\]]+)\]/);
    const turn = row.match(/^\*\*\* TURN \*\*\* \[([^\]]+)\] \[([^\]]+)\]/);
    const river = row.match(/^\*\*\* RIVER \*\*\* \[([^\]]+)\] \[([^\]]+)\]/);
    if (flop) {
      currentBoard = flop[1].split(' ');
    } else if (turn) {
      currentBoard = [...turn[1].split(' '), turn[2]];
    } else if (river) {
      currentBoard = [...river[1].split(' '), river[2]];
    }
    // Only snapshot at the FIRST line where the HERO goes all-in.
    // Lines where a villain goes all-in later (e.g. on the flop) are ignored.
    if (boardSnapshot === null && row.startsWith(`${playerName}:`) && row.includes('is all-in')) {
      boardSnapshot = [...currentBoard];
    }
  });
  return boardSnapshot;
}

// Parse one hand's text. Returns a spot or null.
function parseHandSpot(handText, playerName) {
  if (!handText.includes('is all-in') || !handText.includes('*** SHOW DOWN ***')) {
    return null;
  }
  const lines = handText.split('\n');

  // Hero must be involved in an all-in.
  const heroAllIn = lines.some((r) => r.startsWith(`${playerName}:`) && r.includes('is all-in'));
  if (!heroAllIn) {
    return null;
  }

  // Collect shown cards per player from "<name>: shows [a b]".
  const shown = {};
  lines.forEach((row) => {
    const m = row.match(/^(.+?): shows \[([^\]]+)\]/);
    if (m) {
      shown[m[1]] = m[2].split(' ');
    }
  });
  // Need hero + at least one villain shown.
  if (!shown[playerName] || Object.keys(shown).length < 2) {
    return null;
  }

  // FIX 3: Collect every distinct player name that went all-in.
  // If any all-in player did NOT reveal their cards at showdown, we cannot
  // compute correct equity — the missing cards would be treated as deck cards,
  // inflating equity for the remaining players. Exclude such spots.
  // Known limitation: only hands where ALL all-in players reveal cards are counted.
  const allInNames = new Set();
  lines.forEach((row) => {
    const m = row.match(/^(.+?): .*is all-in/);
    if (m) {
      allInNames.add(m[1]);
    }
  });
  if (allInNames.size > Object.keys(shown).length) {
    return null;
  }

  const potMatch = handText.match(/Total pot (\d+)/);
  const pot = potMatch ? Number(potMatch[1]) : 0;

  // Big blind of this hand, from the header "Level <roman> (<sb>/<bb>)".
  const bbMatch = handText.match(/Level [^(]*\((\d+)\/(\d+)\)/);
  const bb = bbMatch ? Number(bbMatch[2]) : null;

  // FIX 1: Sum ALL "<hero> collected N" lines. In a multiway all-in the hero
  // may collect from both a side pot and the main pot on separate lines.
  const escaped = playerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const collectedRe = new RegExp(`^${escaped}\\b.*collected (\\d+)`, 'gm');
  let actual = 0;
  let cm = collectedRe.exec(handText);
  while (cm) {
    actual += Number(cm[1]);
    cm = collectedRe.exec(handText);
  }

  // FIX 2: Use the board at the HERO's first all-in (pass playerName).
  const board = boardAtAllIn(lines, playerName) || [];

  const table = new TexasHoldem();
  const names = Object.keys(shown);
  names.forEach((n) => { table.addPlayer(shown[n]); });
  if (board.length > 0) {
    table.setBoard(board);
  }

  const result = table.calculate().getPlayers();
  const heroIndex = names.indexOf(playerName);
  const heroResult = result[heroIndex];
  const equity = (heroResult.getWinsPercentage() + heroResult.getTiesPercentage() / 2) / 100;

  return {
    equity, pot, actual, bb,
  };
}

function parseAllInEV(fileContent, playerName) {
  const hands = fileContent.split('PokerStars Hand');
  const spots = [];
  hands.forEach((h) => {
    const spot = parseHandSpot(h, playerName);
    if (spot) {
      spots.push(spot);
    }
  });

  const round1 = (n) => Math.round(n * 10) / 10;

  const count = spots.length;
  const actualChips = spots.reduce((s, x) => s + x.actual, 0);
  const evChips = spots.reduce((s, x) => s + round(x.equity * x.pot), 0);
  const equitySum = spots.reduce((s, x) => s + x.equity, 0);
  const avgEquity = count === 0 ? 0 : equitySum / count;
  const aheadCount = spots.filter((x) => x.equity >= 0.5).length;
  // bb-denominated totals: per-spot chips/bb, skipping spots with no bb.
  const actualBb = round1(spots.reduce((s, x) => (x.bb ? s + x.actual / x.bb : s), 0));
  const evBb = round1(spots.reduce((s, x) => (x.bb ? s + (x.equity * x.pot) / x.bb : s), 0));

  return {
    spots,
    totals: {
      count, actualChips, evChips, avgEquity, aheadCount, actualBb, evBb,
    },
  };
}

module.exports = { parseAllInEV };
