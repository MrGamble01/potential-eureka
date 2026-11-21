const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const root = join(__dirname, '..');
const src = readFileSync(join(root, 'js/word5.js'), 'utf8');
const sandbox = {};
vm.runInContext(src + '\nglobalThis.WordFiveGame = WordFiveGame;', vm.createContext(sandbox), { filename: 'js/word5.js' });
const score = sandbox.WordFiveGame.rules.score;

function marks(guess, answer) {
  return JSON.parse(JSON.stringify(score(guess, answer)));
}

test('a solved row is all green and a miss is all dark', () => {
  assert.deepEqual(marks('crane', 'crane'), ['correct', 'correct', 'correct', 'correct', 'correct']);
  assert.deepEqual(marks('zzzzz', 'crane'), ['absent', 'absent', 'absent', 'absent', 'absent']);
});

test('duplicate letters are spent by exact hits before yellows', () => {
  assert.deepEqual(marks('babes', 'abbey'), ['present', 'present', 'correct', 'correct', 'absent']);
  assert.deepEqual(marks('aaabb', 'abcde'), ['correct', 'absent', 'absent', 'present', 'absent']);
  assert.deepEqual(marks('aabbb', 'abbbb'), ['correct', 'absent', 'correct', 'correct', 'correct']);
});
