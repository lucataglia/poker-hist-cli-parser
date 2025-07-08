const { TexasHoldem } = require('poker-odds-calc');
const chalk = require('chalk');
const argv = require('minimist')(process.argv.slice(2));
const { prettyHand, prettyBoard } = require('./helpers');

let lessThenFifty = 0;
let moreThanFifty = 0;
let wins = 0;
let looses = 0;
let itm = 0;
let total = 0;

const MODE = {
  init: 'INIT',
  holeCards: 'HOLE CARDS',
  flop: 'FLOP',
  turn: 'TURN',
  river: 'RIVER',
  showDown: 'SHOW DOWN',
  summary: 'SUMMARY',
};

const { name: argvName } = argv;

const allInParser = (data) => {
  total += 1;

  data
    .split('PokerStars Hand')
    .map((hand, index) => ({ hand, index }))
    // Take only the hand that contained an all-in
    .filter(({ hand }) => hand.includes('all-in') && hand.includes('and won'))
    .map(({ hand: h, index }) => {
      const res = h.split('\n').reduce((acc, row) => {
        const {
          allIn, allInResultDesc, board, hand, mode, players, totalPot,
        } = acc;

        switch (mode) {
          case MODE.init: {
            if (row.includes('is the button')) {
              const regex = /#(\d+)/;
              const match = row.match(regex);

              if (match) {
                const newDealerSeat = match[1];

                return {
                  ...acc,
                  dealerSeat: newDealerSeat,
                  handsCount: index,
                };
              }
            }

            if (row.toLowerCase().includes('small blind')) {
              const newSmallBlind = row.split(' ')[4];

              return {
                ...acc,
                handsCount: index,
                smallBlind: newSmallBlind,
              };
            }

            if (row.toLowerCase().includes('big blind')) {
              const newBigBlind = row.split(' ')[4];

              return {
                ...acc,
                bigBlind: newBigBlind,
                handsCount: index,
              };
            }

            const pattern = `(?=.*${argvName})(?=.*in chips)`;
            const regex = new RegExp(pattern);

            if (regex.test(row)) {
              const newMyChips = row.split(' ')[3].replace('(', '').trim();

              return {
                ...acc,
                myChips: newMyChips,
                handsCount: index,
              };
            }

            if (row.includes(MODE.holeCards)) {
              return {
                ...acc,
                hand: { ...hand, holeCards: row },
                handsCount: index,
                mode: MODE.holeCards,
              };
            }

            return {
              ...acc,
              handsCount: index,
            };
          }

          case MODE.holeCards: {
            if (row.includes(`${argvName}: calls`)) {
              return {
                ...acc,
                hand: { ...hand, flop: row },
                handsCount: index,
                isCaller: true,
                mode: MODE.flop,
              };
            }

            if (row.includes(MODE.flop)) {
              return {
                ...acc,
                hand: { ...hand, flop: row },
                handsCount: index,
                mode: MODE.flop,
              };
            }

            const nAllIn = row.includes('all-in') ? MODE.holeCards : allIn;

            return {
              ...acc,
              allIn: nAllIn,
              hand: { ...hand, holeCards: `${hand.holeCards}\n${row}` },
              handsCount: index,
            };
          }

          case MODE.flop: {
            if (row.includes(MODE.turn)) {
              return {
                ...acc,
                hand: { ...hand, turn: row },
                handsCount: index,
                mode: MODE.turn,
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
              ...acc,
              allIn: nAllIn,
              board: nBoard,
              hand: { ...hand, flop: `${hand.flop}\n${row}` },
              handsCount: index,
            };
          }

          case MODE.turn: {
            if (row.includes(MODE.river)) {
              return {
                ...acc,
                hand: { ...hand, river: row },
                handsCount: index,
                mode: MODE.river,
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
              ...acc,
              allIn: nAllIn,
              board: nBoard,
              hand: { ...hand, turn: `${hand.turn}\n${row}` },
              handsCount: index,
            };
          }

          case MODE.river: {
            if (row.includes(MODE.showDown)) {
              return {
                ...acc,
                hand: { ...hand, summary: row },
                handsCount: index,
                mode: MODE.showDown,
              };
            }

            if (row.includes(MODE.summary)) {
              return {
                ...acc,
                hand: { ...hand, summary: row },
                handsCount: index,
                mode: MODE.summary,
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
              ...acc,
              allIn: nAllIn,
              board: nBoard,
              hand: { ...hand, river: `${hand.river}\n${row}` },
              handsCount: index,
            };
          }

          case MODE.showDown: {
            if (row.includes(MODE.summary)) {
              return {
                ...acc,
                hand: { ...hand, showDown: row },
                handsCount: index,
                mode: MODE.summary,
              };
            }

            const cashWinningsRegex = new RegExp(`^${argvName}.*\\b(receives|received)\\b`);
            if (row.match(cashWinningsRegex)) {
              itm += 1;
              return {
                ...acc,
                cashWinnings: row,
                handsCount: index,
              };
            }

            return acc;
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
                  cards,
                  isWinner,
                  name,
                  seat,
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

            const nAllInResultDesc = (function getRecap() {
              if (row.startsWith('Seat ')) {
                const regex = new RegExp(`^Seat.*: (${argvName}.*)`);
                const match = row.match(regex);

                if (match) {
                  return match[1];
                }

                return allInResultDesc;
              }

              return allInResultDesc;
            }());

            return {
              ...acc,
              allInResultDesc: nAllInResultDesc,
              hand: { ...hand, summary: `${hand.summary}\n${row}` },
              handsCount: index,
              players: players.concat(newPlayer),
              totalPot: newTotalPot,
            };
          }
        }
      }, {
        allIn: undefined,
        allInResultDesc: undefined,
        bigBlind: undefined,
        board: undefined,
        cashWinnings: undefined,
        dealerSeat: undefined,
        hand: {
          holeCards: '', flop: '', turn: '', river: '', summary: '',
        },
        handsCount: undefined,
        isCaller: undefined,
        mode: MODE.init,
        myChips: undefined,
        players: [],
        smallBlind: undefined,
        totalPot: undefined,
      });

      return res;
    })
    .forEach(({
      allIn, allInResultDesc, bigBlind, board, cashWinnings, dealerSeat, hand, handsCount, isCaller, myChips, players, smallBlind, totalPot,
    }) => {
      const cardsRegEx = /\[(.*?)\] \[(.*?)\]/;
      const y = hand.river.match(cardsRegEx) || [];
      const fullBoard = `${y[1]} ${y[2]}`;

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

          if (!name.includes('Jeff')) {
            return;
          }

          if (isWinner) {
            wins += 1;
          } else {
            looses += 1;
          }

          const winsPerc = p.getWinsPercentage();
          const tiePerc = p.getTiesPercentage();
          const isMoreThanFifty = (tiePerc + winsPerc) >= 50;

          if (isMoreThanFifty) {
            moreThanFifty += 1;
          } else {
            lessThenFifty += 1;
          }

          const totalPotPrint = isWinner
            ? chalk.green(`${myChips} (${totalPot})`.padStart(15))
            : chalk.red(`${myChips} (${totalPot})`.padStart(15));

          const callOrRaiseIcon = isCaller ? '🎯' : '🚀';
          const colorFn = isMoreThanFifty ? chalk.green : chalk.red;
          const handPrint = prettyHand(p.getHand()).padEnd(15);
          const percentagePrint = colorFn(`${p.getWinsPercentageString().padStart(7)}   ${totalPotPrint} \t`);
          const tieStr = tiePerc > 2 ? `tie: ${tiePerc}` : '';
          const tiePrint = tieStr.padEnd(15);
          const allInStr = (allIn || 'FORCED').padStart(15);
          const boardPrint = board ? `${allInStr}:  ${prettyBoard(board)}` : allInStr;

          const otherCards = players.map(({ cards, seat }) => `(${seat}) ${cards}`).join(' - ');

          console.log(`[${handsCount}] ${callOrRaiseIcon}  ${handPrint} ${percentagePrint} ${tiePrint} ${boardPrint}`);
          console.log(`${otherCards} \t dealer: (${dealerSeat}) \t blinds: ${smallBlind}/${bigBlind}`);
          console.log(`${chalk.yellow(allInResultDesc)}: ${chalk.yellowBright(fullBoard)}`);
          console.log(cashWinnings ? `${chalk.green(cashWinnings)}\n` : '\n');
        });
    });

  return {
    moreThanFifty, lessThenFifty, wins, looses, total, itm,
  };
};

module.exports = { allInParser };
