const { TexasHoldem } = require('poker-odds-calc');
const chalk = require('chalk');
const argv = require('minimist')(process.argv.slice(2));
const { prettyHand, prettyBoard } = require('./helpers');

let lessThenFifty = 0;
let moreThanFifty = 0;
let wins = 0;
let looses = 0;

const MODE = {
  init: 'INIT',
  holeCards: 'HOLE CARDS',
  flop: 'FLOP',
  turn: 'TURN',
  river: 'RIVER',
  summary: 'SUMMARY',
};

const { name: argvName } = argv;

const allInParser = (data) => {
  data
    .split('PokerStars Hand')
    .map((hand, index) => ({ hand, index }))
    // Take only the hand that contained an all-in
    .filter(({ hand }) => hand.includes('all-in') && hand.includes('and won'))
    .map(({ hand: h, index }) => {
      const res = h.split('\n').reduce(({
        hand, mode, allIn, board, players, totalPot, myChips, smallBlind, bigBlind, dealerSeat, isCaller,
      }, row) => {
        switch (mode) {
          case MODE.init: {
            if (row.includes('is the button')) {
              const regex = /#(\d+)/;
              const match = row.match(regex);

              if (match) {
                const newDealerSeat = match[1];
                return {
                  allIn,
                  board,
                  hand,
                  mode,
                  players,
                  totalPot,
                  myChips,
                  smallBlind,
                  bigBlind,
                  handsCount: index + 1,
                  dealerSeat: newDealerSeat,
                  isCaller,
                };
              }
            }

            if (row.toLowerCase().includes('small blind')) {
              const newSmallBlind = row.split(' ')[4];
              return {
                allIn,
                board,
                hand,
                mode,
                players,
                totalPot,
                myChips,
                smallBlind: newSmallBlind,
                bigBlind,
                handsCount: index + 1,
                dealerSeat,
                isCaller,
              };
            }

            if (row.toLowerCase().includes('big blind')) {
              const newBigBlind = row.split(' ')[4];
              return {
                allIn,
                board,
                hand,
                mode,
                players,
                totalPot,
                myChips,
                smallBlind,
                bigBlind: newBigBlind,
                handsCount: index + 1,
                dealerSeat,
                isCaller,
              };
            }

            const pattern = `(?=.*${argvName})(?=.*in chips)`;
            const regex = new RegExp(pattern);

            if (regex.test(row)) {
              const newMyChips = row.split(' ')[3].replace('(', '').trim();

              return {
                allIn,
                board,
                hand,
                mode,
                players,
                totalPot,
                myChips: newMyChips,
                smallBlind,
                bigBlind,
                handsCount: index + 1,
                dealerSeat,
                isCaller,
              };
            }

            if (row.includes(MODE.holeCards)) {
              return {
                allIn,
                board,
                hand: { ...hand, holeCards: row },
                mode: MODE.holeCards,
                players,
                totalPot,
                myChips,
                smallBlind,
                bigBlind,
                handsCount: index + 1,
                dealerSeat,
                isCaller,
              };
            }

            return {
              allIn,
              board,
              hand,
              mode,
              players,
              totalPot,
              myChips,
              smallBlind,
              bigBlind,
              handsCount: index + 1,
              dealerSeat,
              isCaller,
            };
          }

          case MODE.holeCards: {
            if (row.includes(`${argvName}: calls`)) {
              return {
                allIn,
                board,
                hand: { ...hand, flop: row },
                mode: MODE.flop,
                players,
                totalPot,
                myChips,
                smallBlind,
                bigBlind,
                handsCount: index + 1,
                dealerSeat,
                isCaller: true,
              };
            }

            if (row.includes(MODE.flop)) {
              return {
                allIn,
                board,
                hand: { ...hand, flop: row },
                mode: MODE.flop,
                players,
                totalPot,
                myChips,
                smallBlind,
                bigBlind,
                handsCount: index + 1,
                dealerSeat,
                isCaller,
              };
            }

            const nAllIn = row.includes('all-in') ? MODE.holeCards : allIn;

            return {
              allIn: nAllIn,
              board,
              hand: { ...hand, holeCards: `${hand.holeCards}\n${row}` },
              mode,
              players,
              totalPot,
              myChips,
              smallBlind,
              bigBlind,
              handsCount: index + 1,
              dealerSeat,
              isCaller,
            };
          }

          case MODE.flop: {
            if (row.includes(MODE.turn)) {
              return {
                allIn,
                board,
                hand: { ...hand, turn: row },
                mode: MODE.turn,
                players,
                totalPot,
                myChips,
                smallBlind,
                bigBlind,
                handsCount: index + 1,
                dealerSeat,
                isCaller,
              };
            }

            const [nAllIn, nBoard] = (function isAllIn() {
              if (row.includes('all-in')) {
                const cardsRegEx = /\[(.*?)\]/;
                const y = hand.flop.match(cardsRegEx) || [];

                return [MODE.flop, y[1]];
              }

              return [allIn, board];
            }());

            return {
              allIn: nAllIn,
              board: nBoard,
              hand: { ...hand, flop: `${hand.flop}\n${row}` },
              mode,
              players,
              totalPot,
              myChips,
              smallBlind,
              bigBlind,
              handsCount: index + 1,
              dealerSeat,
              isCaller,
            };
          }

          case MODE.turn: {
            if (row.includes(MODE.river)) {
              return {
                allIn,
                board,
                hand: { ...hand, river: row },
                mode: MODE.river,
                players,
                totalPot,
                myChips,
                smallBlind,
                bigBlind,
                handsCount: index + 1,
                dealerSeat,
                isCaller,
              };
            }

            const [nAllIn, nBoard] = (function isAllIn() {
              if (board) {
                return [allIn, board];
              }

              if (row.includes('all-in')) {
                const cardsRegEx = /\[(.*?)\] \[(.*?)\]/;
                const y = hand.turn.match(cardsRegEx) || [];

                return [MODE.turn, `${y[1]} ${y[2]}`];
              }

              return [allIn, board];
            }());

            return {
              allIn: nAllIn,
              board: nBoard,
              hand: { ...hand, turn: `${hand.turn}\n${row}` },
              mode,
              players,
              totalPot,
              myChips,
              smallBlind,
              bigBlind,
              handsCount: index + 1,
              dealerSeat,
              isCaller,
            };
          }

          case MODE.river: {
            if (row.includes(MODE.summary)) {
              return {
                allIn,
                board,
                hand: { ...hand, summary: row },
                mode: MODE.summary,
                players,
                totalPot,
                myChips,
                smallBlind,
                bigBlind,
                handsCount: index + 1,
                dealerSeat,
                isCaller,
              };
            }

            const [nAllIn, nBoard] = (function isAllIn() {
              if (board) {
                return [allIn, board];
              }

              if (row.includes('all-in')) {
                const cardsRegEx = /\[(.*?)\] \[(.*?)\]/;
                const y = hand.river.match(cardsRegEx) || [];

                return [MODE.river, `${y[1]} ${y[2]}`];
              }

              return [allIn, board];
            }());

            return {
              allIn: nAllIn,
              board: nBoard,
              hand: { ...hand, river: `${hand.river}\n${row}` },
              mode,
              players,
              totalPot,
              myChips,
              smallBlind,
              bigBlind,
              handsCount: index + 1,
              dealerSeat,
              isCaller,
            };
          }

          default: {
            const newPlayer = (function getPlayer() {
              if (row.startsWith('Seat ') && !row.includes('folded')) {
                const regex = /Seat (\d+): ([^(]+).*(?:showed|mucked) \[([^\]]+)\]/;

                const match = row.match(regex);

                const seat = match[1];
                const name = match[2].trim();
                const cards = match[3];

                const isWinner = row.includes('and won');

                return {
                  name, cards, seat, isWinner,
                };
              }

              return [];
            }());

            const newTotalPot = (function getTotalPot() {
              if (row.startsWith('Total pot ')) {
                return row.split(' ')[2].trim();
              }

              return totalPot;
            }());

            return {
              allIn,
              board,
              hand: { ...hand, summary: `${hand.summary}\n${row}` },
              mode,
              players: players.concat(newPlayer),
              totalPot: newTotalPot,
              myChips,
              smallBlind,
              bigBlind,
              handsCount: index + 1,
              dealerSeat,
              isCaller,
            }; }
        }
      }, {
        allIn: undefined,
        board: undefined,
        hand: {
          holeCards: '', flop: '', turn: '', river: '', summary: '',
        },
        mode: MODE.init,
        players: [],
        totalPot: undefined,
        myChips: undefined,
        smallBlind: undefined,
        bigBlind: undefined,
        handsCount: undefined,
        dealerSeat: undefined,
        isCaller: undefined,
      });

      return res;
    })
    .forEach(({
      allIn, players, board, totalPot, myChips, smallBlind, bigBlind, handsCount, dealerSeat, isCaller,
    }) => {
      const table = new TexasHoldem();

      players.forEach(({ cards }) => { table.addPlayer(cards.split(' ')); });

      if (board) {
        table.setBoard(board.split(' '));
      }

      table
        .calculate()
        .getPlayers()
        .forEach((p, index) => {
          const { name, isWinner } = players[index];

          const otherCards = players.map(({ cards, seat }) => `(${seat}) ${cards}`).join(' - ');
          if (!name.includes('Jeff')) {
            return;
          }

          const tieStr = p.getTiesPercentage() > 2 ? `tie: ${p.getTiesPercentageString()}` : '';

          const totalPotPrint = isWinner
            ? chalk.green(`${myChips} (${totalPot})`.padStart(15))
            : chalk.red(`${myChips} (${totalPot})`.padStart(15));

          if (isWinner) {
            wins += 1;
          } else {
            looses += 1;
          }

          if (p.getWinsPercentage() >= 50) {
            moreThanFifty += 1;
          } else {
            lessThenFifty += 1;
          }

          const callOrRaiseIcon = isCaller ? '🎯' : '🚀';
          const colorFn = p.getWinsPercentage() >= 50 ? chalk.green : chalk.red;
          const handPrint = prettyHand(p.getHand()).padEnd(15);
          const percentagePrint = colorFn(`${p.getWinsPercentageString().padStart(7)}   ${totalPotPrint} \t`);
          const tiePrint = tieStr.padEnd(15);
          const allInPrint = allIn?.padEnd(15);
          const boardPrint = board ? `${allInPrint} ${prettyBoard(board)}` : allInPrint || 'FORCED';

          console.log(`[${handsCount}] ${callOrRaiseIcon}  ${handPrint} ${percentagePrint} ${tiePrint} \t ${boardPrint}`);
          console.log(`${otherCards} \t dealer: (${dealerSeat}) \t blinds: ${smallBlind}/${bigBlind}\n`);
        });
    });

  return {
    moreThanFifty, lessThenFifty, wins, looses,
  };
};

module.exports = { allInParser };
