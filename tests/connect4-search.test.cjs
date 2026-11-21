const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/connect4.js'), 'utf8');
const sandbox = { Utils: { sfx() {} } };
vm.runInContext(src + '\nglobalThis.ConnectFourGame = ConnectFourGame;', vm.createContext(sandbox), { filename: 'js/connect4.js' });
const rules = sandbox.ConnectFourGame.rules;

function empty() {
  return Array.from({ length: rules.rows }, () => Array(rules.cols).fill(0));
}

test('the in-place window score matches the boards the search already knew', () => {
  const threat = empty();
  threat[5] = [1, 1, 1, 0, 2, 2, 0];
  threat[4] = [2, 0, 0, 0, 0, 0, 0];
  assert.equal(rules.heuristic(threat), -47);

  const centre = empty();
  for (let r = 0; r < rules.rows; r++) centre[r][3] = rules.ai;
  assert.equal(rules.heuristic(centre), 18);

  const player = empty();
  player[5][0] = rules.player;
  player[5][1] = rules.player;
  player[4][0] = rules.player;
  assert.equal(rules.heuristic(player), -12);
  assert.equal(rules.heuristic(empty()), 0);
});

test('the search still spends its discs and puts them back', () => {
  const threat = empty();
  threat[5][0] = rules.player;
  threat[5][1] = rules.player;
  threat[5][2] = rules.player;
  const before = JSON.stringify(threat);
  assert.equal(rules.bestMove(threat, 2), 3);
  assert.equal(JSON.stringify(threat), before);
});
