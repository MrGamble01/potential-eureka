const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');

const src = readFileSync(join(__dirname, '..', 'js/crateescape.js'), 'utf8');
const sandbox = { Utils: { sfx() {} } };
vm.runInContext(src + '\nglobalThis.CrateEscapeGame = CrateEscapeGame;', vm.createContext(sandbox), { filename: 'js/crateescape.js' });
const rules = sandbox.CrateEscapeGame.rules;
const host = (value) => JSON.parse(JSON.stringify(value));

function wallRoom() {
  return [
    [true, true, true, true, true],
    [true, false, false, false, true],
    [true, false, false, false, true],
    [true, true, true, true, true],
  ];
}

test('a flood stops at walls and crates', () => {
  const wall = wallRoom();
  const open = rules.flood(1, 1, wall, new Set(), 5, 4);
  assert.equal(open.size, 6);
  const blocked = rules.flood(1, 1, wall, new Set(['3,1']), 5, 4);
  assert.equal(blocked.has('3,1'), false);
  assert.equal(blocked.has('3,2'), true);
  assert.equal(blocked.has('0,1'), false);
});

test('a push stops on a wall or a second crate, and a free step does not', () => {
  const wall = wallRoom();
  const crates = [[2, 1]];
  const player = [1, 1];
  assert.equal(rules.tryPush(wall, crates, player, 'left'), null);
  const intoCrate = rules.tryPush(wall, [[2, 1], [3, 1]], player, 'right');
  assert.equal(intoCrate, null);
  const pushed = rules.tryPush(wall, crates, player, 'right');
  assert.deepEqual(host(pushed.player), [2, 1]);
  assert.deepEqual(host(pushed.crates), [[3, 1]]);
  assert.equal(pushed.pushed, true);
  assert.deepEqual(host(crates), [[2, 1]]);
  const walked = rules.tryPush(wall, crates, player, 'down');
  assert.deepEqual(host(walked.player), [1, 2]);
  assert.equal(walked.pushed, false);
  assert.equal(walked.crates, crates);
  assert.equal(rules.cratesHome([[3, 1]], [[3, 1]]), true);
  assert.equal(rules.cratesHome([[2, 1]], [[3, 1]]), false);
});

test('the first rungs of the ladder are solvable', () => {
  function solvable(level) {
    const room = rules.genLevel(level);
    assert.equal(rules.cratesHome(room.crates, room.goals), false, 'level ' + level + ' starts solved');
    const seen = new Set();
    const queue = [{ player: room.player, crates: room.crates.map(c => c.slice()) }];
    const dirs = ['up', 'down', 'left', 'right'];
    let guard = 0;
    while (queue.length) {
      if (++guard > 200000) return false;
      const cur = queue.shift();
      if (rules.cratesHome(cur.crates, room.goals)) return true;
      for (const dir of dirs) {
        const next = rules.tryPush(room.wall, cur.crates, cur.player, dir);
        if (!next) continue;
        const stamp = next.player.join(',') + '|' + next.crates.map(c => c.join(',')).join(';');
        if (seen.has(stamp)) continue;
        seen.add(stamp);
        queue.push({ player: next.player, crates: next.crates });
      }
    }
    return false;
  }
  assert.equal(solvable(1), true);
  assert.equal(solvable(2), true);
  assert.equal(solvable(3), true);
});
