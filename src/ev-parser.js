// src/ev-parser.js
const { TexasHoldem } = require('poker-odds-calc');

const round = (n) => Math.round(n);

// Extract the board visible at the moment of the LAST all-in in the hand.
// Streets appear as "*** FLOP *** [a b c]", "*** TURN *** [a b c] [d]",
// "*** RIVER *** [a b c d] [e]". The board known when the all-in happens is
// the board of the street on which the last "is all-in" line sits.
function boardAtAllIn(lines) {
  let currentBoard = [];
  let boardAtLastAllIn = null;
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
    if (row.includes('is all-in')) {
      boardAtLastAllIn = [...currentBoard];
    }
  });
  return boardAtLastAllIn;
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

  const potMatch = handText.match(/Total pot (\d+)/);
  const pot = potMatch ? Number(potMatch[1]) : 0;

  const escaped = playerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const collectedMatch = handText.match(new RegExp(`^${escaped}\\b.*collected (\\d+)`, 'm'));
  const actual = collectedMatch ? Number(collectedMatch[1]) : 0;

  const board = boardAtAllIn(lines) || [];

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

  return { equity, pot, actual };
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

  const count = spots.length;
  const actualChips = spots.reduce((s, x) => s + x.actual, 0);
  const evChips = round(spots.reduce((s, x) => s + x.equity * x.pot, 0));
  const avgEquity = count === 0 ? 0 : spots.reduce((s, x) => s + x.equity, 0) / count;

  return {
    spots,
    totals: {
      count, actualChips, evChips, avgEquity,
    },
  };
}

module.exports = { parseAllInEV };
