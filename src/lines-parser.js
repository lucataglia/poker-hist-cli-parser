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
function heroWentToShowdown(handText, escapedName) {
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

  // Split into streets; for each street walk the hero's action lines IN ORDER and maintain a
  // running total of chips committed on that street:
  //   - blind / ante post  → running += amount   (preflop only; ante applies any street idx=0)
  //   - "bets N"           → running += N         (first wager on a postflop street, running was 0)
  //   - "calls N"          → running += N         (N is the INCREMENT the hero adds)
  //   - "raises X to M"    → running  = M         (M is already the TOTAL committed that street)
  // streetCommit = final running value.  Both "raise-then-call" and "call-then-raise" shapes
  // are handled correctly because raises always write the cumulative total ("to M"), so any
  // prior calls/blinds on that street are already embedded in M.
  const streets = handText.split(/\*\*\* (?:FLOP|TURN|RIVER|SHOW DOWN|SUMMARY) \*\*\*/);
  // streets[0] contains header + hole cards + preflop actions.
  let contribution = 0;
  streets.forEach((street, idx) => {
    let running = 0;
    street.split('\n').forEach((line) => {
      if (!line.startsWith(`${playerName}:`)) { return; }
      const raise = line.match(/raises \d+ to (\d+)/);
      const bet = line.match(/bets (\d+)/);
      const call = line.match(/calls (\d+)/);
      const sb = line.match(/posts small blind (\d+)/);
      const bbMatch = line.match(/posts big blind (\d+)/);
      const ante = line.match(/posts the ante (\d+)/);
      if (raise) { running = Number(raise[1]); }
      if (bet) { running += Number(bet[1]); }
      if (call) { running += Number(call[1]); }
      if (idx === 0 && sb) { running += Number(sb[1]); }
      if (idx === 0 && bbMatch) { running += Number(bbMatch[1]); }
      if (ante) { running += Number(ante[1]); }
    });
    contribution += running;
  });

  // Subtract uncalled bet returned to hero.
  const uncalledRe = new RegExp(`Uncalled bet \\((\\d+)\\) returned to ${escapedName}`, 'g');
  let uncalled = 0;
  let um = uncalledRe.exec(handText);
  while (um) { uncalled += Number(um[1]); um = uncalledRe.exec(handText); }

  return collected - (contribution - uncalled);
}

// Assumes one file = one complete single-table tournament (SNG).
// Multi-file MTTs where a tournament spans files would misattribute the first hand
// as a fresh buy-in.
function parseShowdownSplit(fileContent, playerName) {
  const escapedName = playerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Split into hands, keep only those where the hero is seated.
  const hands = fileContent.split('PokerStars Hand')
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
    const isSd = heroWentToShowdown(hand, escapedName);
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
