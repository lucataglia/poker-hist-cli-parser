// src/lines-parser.js

// Big blind of a hand from its header "Level <roman> (<sb>/<bb>)".
function handBigBlind(handText) {
  const m = handText.match(/Level [^(]*\((\d+)\/(\d+)\)/);
  return m ? Number(m[2]) : null;
}

// Hero's starting stack for a hand: "Seat N: <name> (X in chips)".
function startStack(handText, escapedName) {
  const m = handText.match(new RegExp(`^Seat \\d+: ${escapedName} \\((\\d+) in chips\\)`, 'm'));
  return m ? Number(m[1]) : null;
}

// True if the hero reached showdown in this hand.
function heroWentToShowdown(handText, playerName, escapedName) {
  if (!handText.includes('*** SHOW DOWN ***')) {
    return false;
  }
  // Hero folded during play?
  const foldedInPlay = new RegExp(`^${escapedName}: folds`, 'm').test(handText);
  if (foldedInPlay) {
    return false;
  }
  // Summary marks hero as folded?
  const summaryFolded = new RegExp(`^Seat \\d+: ${escapedName} .*folded`, 'm').test(handText);
  if (summaryFolded) {
    return false;
  }
  return true;
}

// Method B (also used as the last-hand fallback): net = collected - contribution.
function netByActions(handText, playerName, escapedName) {
  // Sum every "<hero> collected N".
  const collectedRe = new RegExp(`^${escapedName}\\b.*collected (\\d+)`, 'gm');
  let collected = 0;
  let cm = collectedRe.exec(handText);
  while (cm) { collected += Number(cm[1]); cm = collectedRe.exec(handText); }

  // Split into streets; for each street, hero commitment = max(sum of call+bet, highest raise "to").
  // Blinds posted preflop are commitment on the preflop street.
  const streets = handText.split(/\*\*\* (?:FLOP|TURN|RIVER|SHOW DOWN|SUMMARY) \*\*\*/);
  // streets[0] contains header + hole cards + preflop actions.
  let contribution = 0;
  streets.forEach((street, idx) => {
    let sumCallBet = 0;
    let maxRaiseTo = 0;
    let blinds = 0;
    street.split('\n').forEach((line) => {
      if (!line.startsWith(`${playerName}:`)) { return; }
      const raise = line.match(/raises \d+ to (\d+)/);
      const bet = line.match(/bets (\d+)/);
      const call = line.match(/calls (\d+)/);
      const sb = line.match(/posts small blind (\d+)/);
      const bbMatch = line.match(/posts big blind (\d+)/);
      const ante = line.match(/posts the ante (\d+)/);
      if (raise) { maxRaiseTo = Math.max(maxRaiseTo, Number(raise[1])); }
      if (bet) { sumCallBet += Number(bet[1]); }
      if (call) { sumCallBet += Number(call[1]); }
      if (idx === 0 && sb) { blinds += Number(sb[1]); }
      if (idx === 0 && bbMatch) { blinds += Number(bbMatch[1]); }
      if (ante) { blinds += Number(ante[1]); }
    });
    // On the preflop street, blinds are part of the "to" for a raiser, or add to call/bet.
    const streetCommit = Math.max(sumCallBet + blinds, maxRaiseTo);
    contribution += streetCommit;
  });

  // Subtract uncalled bet returned to hero.
  const uncalledRe = new RegExp(`Uncalled bet \\((\\d+)\\) returned to ${escapedName}`, 'g');
  let uncalled = 0;
  let um = uncalledRe.exec(handText);
  while (um) { uncalled += Number(um[1]); um = uncalledRe.exec(handText); }

  return collected - (contribution - uncalled);
}

function parseShowdownSplit(fileContent, playerName) {
  const escapedName = playerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Split into hands, keep only those where the hero is seated.
  const hands = fileContent.split('PokerStars Hand')
    .map((h) => h)
    .filter((h) => new RegExp(`^Seat \\d+: ${escapedName} \\(`, 'm').test(h));

  let sdChips = 0;
  let nonSdChips = 0;
  let sdBb = 0;
  let nonSdBb = 0;

  hands.forEach((hand, i) => {
    const thisStart = startStack(hand, escapedName);
    let net;
    const nextHand = hands[i + 1];
    if (nextHand) {
      const nextStart = startStack(nextHand, escapedName);
      net = nextStart - thisStart;
    } else if (new RegExp(`^${escapedName} finished the tournament`, 'm').test(hand)) {
      net = -thisStart; // busted: lost the whole stack
    } else {
      net = netByActions(hand, playerName, escapedName); // won the tournament: last hand
    }

    const bb = handBigBlind(hand);
    const isSd = heroWentToShowdown(hand, playerName, escapedName);
    if (isSd) {
      sdChips += net;
      if (bb) { sdBb += net / bb; }
    } else {
      nonSdChips += net;
      if (bb) { nonSdBb += net / bb; }
    }
  });

  return {
    sdChips, nonSdChips, sdBb, nonSdBb, hands: hands.length,
  };
}

module.exports = { parseShowdownSplit, netByActions, heroWentToShowdown };
