const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/wordcascade.js'), 'utf8');
const sandbox = { Utils: { sfx() {} } };
vm.runInContext(src + '\nglobalThis.WordCascadeGame = WordCascadeGame;', vm.createContext(sandbox), { filename: 'js/wordcascade.js' });
const rules = sandbox.WordCascadeGame.rules;

function board(rows) {
  const width = Math.max(...rows.map(row => row.length));
  return rows.map(row => row.padEnd(width, '.').split('').map(ch => (ch === '.' ? null : ch)));
}

test('dictionary words count, and ordinary inflections do too', () => {
  assert.equal(rules.isWord('cat'), true);
  assert.equal(rules.isWord('cats'), true);
  assert.equal(rules.isWord('baked'), true);
  assert.equal(rules.isWord('digging'), true);
  assert.equal(rules.isWord('zzz'), false);
  assert.equal(rules.isWord('thes'), false);
  assert.equal(rules.isWord('ands'), false);
});

test('the best clear is the longest word, then the highest letter value', () => {
  const cats = rules.findBest(board(['cats', '....']));
  assert.equal(cats.word, 'cats');
  assert.equal(cats.val, rules.vals.c + rules.vals.a + rules.vals.t + rules.vals.s);

  const split = rules.findBest(board(['cat.dog']));
  assert.ok(split.word === 'cat' || split.word === 'dog');
  assert.equal(split.word.length, 3);

  const valued = rules.findBest(board(['zoo', 'cat']));
  assert.equal(valued.word, 'zoo');

  const down = rules.findBest(board(['c..', 'a..', 't..']));
  assert.equal(down.word, 'cat');
  assert.equal(rules.findBest(board(['ab', 'cd'])), null);
});
