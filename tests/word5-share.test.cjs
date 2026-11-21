const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/word5.js'), 'utf8');
const sandbox = {};
vm.runInContext(src + '\nglobalThis.WordFiveGame = WordFiveGame;', vm.createContext(sandbox), { filename: 'js/word5.js' });
const rules = sandbox.WordFiveGame.rules;

test('a win counts the rows, and a loss is an X', () => {
  const row = ['correct', 'present', 'absent', 'correct', 'absent'];
  assert.equal(rules.shareLines([row], true, rules.rows), 'Word Five 1/6\n\n🟩🟨⬛🟩⬛');
  assert.equal(rules.shareLines([row, row], false, rules.rows), 'Word Five X/6\n\n🟩🟨⬛🟩⬛\n🟩🟨⬛🟩⬛');
});
