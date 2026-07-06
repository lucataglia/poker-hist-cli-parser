// test/lines-crosscheck.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { netByActions } = require('../src/lines-parser');

const FIXTURES = path.join(__dirname, 'fixtures', 'crosscheck');

function heroHands(fileContent, escapedName) {
  return fileContent.split('PokerStars Hand')
    .filter((h) => new RegExp(`^Seat \\d+: ${escapedName} \\(`, 'm').test(h));
}
function startStack(hand, escapedName) {
  const m = hand.match(new RegExp(`^Seat \\d+: ${escapedName} \\((\\d+) in chips\\)`, 'm'));
  return m ? Number(m[1]) : null;
}

// Every synthetic + real fixture; hero is TestHero for synthetic, but the all-in
// fixtures use TestHero too. Use TestHero across the board.
const FILES = fs.readdirSync(FIXTURES).filter((f) => f.startsWith('HH'));

test('method A (stack delta) equals method B (actions) for every mid-tournament hand', () => {
  const name = 'TestHero';
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let checked = 0;
  FILES.forEach((f) => {
    const content = fs.readFileSync(path.join(FIXTURES, f), 'utf8');
    const hands = heroHands(content, escaped);
    for (let i = 0; i < hands.length - 1; i += 1) {
      const a = startStack(hands[i + 1], escaped) - startStack(hands[i], escaped);
      const b = netByActions(hands[i], name, escaped);
      assert.strictEqual(b, a, `mismatch in ${f} hand index ${i}: A=${a} B=${b}`);
      checked += 1;
    }
  });
  assert.ok(checked > 0, 'at least one hand cross-checked');
});
