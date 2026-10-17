/* Stub provider for the flagship booth.
   Run: node tests/ai/stub.js
   No browser, no network, no key. */

const assert = require('assert');
const AI = require('../../js/ai/arcade-ai');
const route = require('../../api/ai');

let pass = 0;
let fail = 0;
function ok(cond, name) {
  if (cond) { pass += 1; console.log('PASS  ' + name); }
  else { fail += 1; console.log('FAIL  ' + name); }
}

function countTile(map, id) {
  let n = 0;
  for (let y = 0; y < map.tiles.length; y++) {
    for (let x = 0; x < map.tiles[y].length; x++) if (map.tiles[y][x] === id) n += 1;
  }
  return n;
}

(async function () {
  const stub = AI.createStubProvider();
  ok(stub.id === 'stub' && stub.label === 'offline stub', 'the default provider is the offline stub');

  ok(AI.createAiProvider({}).id === 'stub', 'a missing key stays on the stub');
  ok(AI.createAiProvider({ AI_API_KEY: '' }).id === 'stub', 'an empty key stays on the stub');
  ok(AI.createAiProvider({ AI_API_KEY: '   ' }).id === 'stub', 'a blank key stays on the stub');
  ok(AI.createAiProvider({ AI_API_KEY: 'present' }).id === 'remote', 'a key selects the remote adapter');
  ok(AI.createAiProvider({ OPENAI_API_KEY: 'present' }).id === 'stub', 'only AI_API_KEY selects the adapter');

  const games = ['ageofwar', 'tycoon', 'beagle', 'growop', 'homeless', 'hearthvale', 'voxel'];
  ok(games.every((id) => AI.games.indexOf(id) !== -1), 'all six flagships, Beagle included, are in the catalog');
  games.forEach((id) => {
    const roster = AI.npcs(id);
    ok(roster.length >= 2 && roster.every((p) => p.id && p.name && p.role), id + ' has a named roster');
  });

  const hungry = await stub.talk({ game: 'homeless', npcId: 'marisol', context: { food: '0', days: 'Day 3' }, turn: 0 });
  const fed = await stub.talk({ game: 'homeless', npcId: 'marisol', context: { food: '12', days: 'Day 3' }, turn: 0 });
  const hungryAgain = await stub.talk({ game: 'homeless', npcId: 'marisol', context: { food: '0', days: 'Day 3' }, turn: 0 });
  ok(hungry.line === 'Food is 0. Trade me something honest and I will send leftovers.', 'a thin camp changes what Marisol says');
  ok(fed.line === '12 food. The recycling run can wait until you are ready.', 'a stocked camp gets the other line');
  ok(hungry.line === hungryAgain.line && hungry.provider === 'stub', 'the same talk is byte-for-byte the same');
  ok(hungry.name === 'Marisol' && hungry.mood === 'worried' && fed.mood === 'pleased', 'the reply names her and the mood');

  const broke = await stub.talk({ game: 'ageofwar', npcId: 'bram', context: { gold: '10', era: 'Stone Age' } });
  const later = await stub.talk({ game: 'ageofwar', npcId: 'bram', context: { gold: '90', era: 'Stone Age' } });
  ok(broke.line === 'Gold is 10. Buy bodies, not banners.', 'Bram mentions a thin purse');
  ok(later.line === 'Stone Age still needs a wall before it needs a speech.', 'Bram drops the purse line once gold recovers');

  const vale = await stub.talk({ game: 'hearthvale', npcId: 'wren', context: { food: '0', day: '2' } });
  ok(/stores show 0 food/.test(vale.line), 'Hearthvale dialogue uses the board');

  const rook = await stub.talk({ game: 'growop', npcId: 'rook', context: { heat: '70', cash: '10' } });
  ok(/Heat is 70/.test(rook.line) && !/synthesis|recipe|cook the/i.test(rook.line), 'Grow Op talk stays on the board');

  const pup = await stub.talk({ game: 'beagle', npcId: 'biscuit', context: { cash: '20' } });
  ok(/bowl fund is 20/.test(pup.line), 'Beagle Sim has its own roster, not the tycoon lines');
  const casey = await stub.talk({ game: 'tycoon', npcId: 'casey', context: { cash: '20' } });
  ok(/Cash reads 20/.test(casey.line) && casey.line !== pup.line, 'Startup Tycoon dialogue is not the beagle line');

  const wave = await stub.announce({ game: 'ageofwar', event: { type: 'wave', detail: 'WAVE 4' } });
  const waveAgain = await stub.announce({ game: 'ageofwar', event: { type: 'wave', detail: 'WAVE 4' } });
  ok(wave.line === 'Wave call: WAVE 4. Dress the line.', 'the announcer calls the wave');
  ok(wave.line === waveAgain.line, 'the same event is the same call');
  const crier = await stub.announce({ game: 'hearthvale', event: { type: 'state', detail: 'Day 2 · 3 food' } });
  ok(crier.line === 'Town crier: Day 2 · 3 food.', 'a hearthvale state is a town crier line');
  const quiet = await stub.announce({ game: 'voxel', event: { type: 'toast', detail: '' } });
  ok(/listening/.test(quiet.line) && quiet.line.length < 170, 'an empty event still returns a short line');

  for (const id of games) {
    const call = await stub.announce({ game: id, event: { type: 'state', detail: 'ready' } });
    ok(call.line.indexOf('ready') !== -1 && call.line.length <= 170, id + ' call stays short and keeps the detail');
  }

  const river = await stub.generateMap({ game: 'hearthvale', seed: 'oak', prompt: 'river' });
  const riverAgain = await stub.generateMap({ game: 'hearthvale', seed: 'oak', prompt: 'river' });
  const quarry = await stub.generateMap({ game: 'hearthvale', seed: 'oak', prompt: 'quarry rock' });
  const otherSeed = await stub.generateMap({ game: 'hearthvale', seed: 'elm', prompt: 'river' });
  const bare = await stub.generateMap({ game: 'voxel', seed: 'cove-5', prompt: '' });
  const need = Math.ceil(AI.WIDTH * AI.HEIGHT * AI.STAMP);
  ok(river.width === 12 && river.height === 8 && river.tiles.length === 8 && river.tiles[0].length === 12, 'a layout is 12 by 8');
  ok(JSON.stringify(river.tiles) === JSON.stringify(riverAgain.tiles) && river.title === riverAgain.title, 'the same seed and prompt rebuild the same layout');
  ok(JSON.stringify(river.tiles) !== JSON.stringify(quarry.tiles), 'the prompt changes the layout');
  ok(countTile(river, 'river') >= need && countTile(quarry, 'rock') >= need, 'the prompt claims a majority of the cells');
  ok(JSON.stringify(river.tiles) !== JSON.stringify(otherSeed.tiles), 'a different seed changes the river layout');
  ok(river.title.indexOf('River') === 0 && river.summary.indexOf('Seed oak') === 0 && river.summary.indexOf('river') !== -1, 'the title and summary name the seed and the prompt');
  ok(river.provider === 'stub', 'the layout is marked as the stub');
  const allowed = {};
  river.legend.forEach((item) => { allowed[item.id] = true; });
  const foreign = river.tiles.some((row) => row.some((cell) => !allowed[cell]));
  ok(!foreign && bare.tiles.every((row) => row.every((cell) => ['grass', 'sand', 'water', 'tree', 'farm', 'path', 'stone'].indexOf(cell) !== -1)), 'every cell is a tile from that game');
  ok(bare.title.indexOf('—') === -1, 'an empty prompt does not invent a theme word');

  let fetched = false;
  const quietProvider = AI.createAiProvider({}, { fetch: function () { fetched = true; return Promise.reject(new Error('no')); } });
  await quietProvider.generateMap({ game: 'voxel', seed: 'isle', prompt: 'cove' });
  await quietProvider.talk({ game: 'voxel', npcId: 'fern', context: { day: '1' } });
  ok(fetched === false && quietProvider.id === 'stub', 'the stub never calls the network');

  let seenAuth = '';
  let seenBody = '';
  let seenUrl = '';
  const remote = AI.createRemoteProvider({
    AI_API_KEY: 'super-secret-key',
    AI_API_BASE_URL: 'http://example.test/v1/',
    AI_MODEL: 'test-model',
  }, {
    fetch: function (url, init) {
      seenUrl = url;
      seenAuth = init.headers.authorization;
      seenBody = init.body;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async function () {
          return { choices: [{ message: { content: '```json\n{"line":"Hold the ridge.","mood":"dry"}\n```' } }] };
        },
      });
    },
  });
  const live = await remote.talk({ game: 'ageofwar', npcId: 'lira', context: { wave: 'WAVE 2' } });
  ok(remote.id === 'remote', 'the adapter identifies itself as remote');
  ok(seenAuth === 'Bearer super-secret-key', 'the key is sent only as the bearer token');
  ok(seenBody.indexOf('super-secret-key') === -1 && seenBody.indexOf('test-model') !== -1, 'the key is not in the request body');
  ok(live.line === 'Hold the ridge.' && live.provider === 'remote' && live.name === 'Lira', 'a fenced JSON reply becomes a line');
  ok(seenUrl === 'http://example.test/v1/chat/completions', 'the adapter posts to the configured completions url');

  const broken = AI.createRemoteProvider({ AI_API_KEY: 'k', AI_API_BASE_URL: 'http://example.test/v1' }, {
    fetch: function () {
      return Promise.resolve({ ok: true, status: 200, json: async function () { return { choices: [{ message: { content: 'not json' } }] }; } });
    },
  });
  const wrapped = AI.withStubFallback(broken, stub);
  const saved = await wrapped.announce({ game: 'voxel', event: { type: 'day', detail: 'Day 4' } });
  ok(saved.fallback === true && saved.provider === 'stub' && saved.line.indexOf('Day 4') !== -1, 'a bad model reply falls back to the stub line');

  const ping = await AI.dispatchAi(stub, { op: 'ping' });
  ok(ping.provider === 'stub', 'dispatch reports the stub on ping');
  let unknown = false;
  try { await AI.dispatchAi(stub, { op: 'nope' }); } catch (e) { unknown = e.status === 400; }
  ok(unknown, 'an unknown op is a 400');

  const prev = process.env.AI_API_KEY;
  delete process.env.AI_API_KEY;
  const resBox = { status: 0, body: '', headers: {} };
  const res = {
    setHeader: function (k, v) { resBox.headers[k] = v; },
    end: function (payload) { resBox.body = payload || ''; },
  };
  Object.defineProperty(res, 'statusCode', { set: function (v) { resBox.status = v; }, get: function () { return resBox.status; } });
  await route({ method: 'POST', body: { op: 'ping' } }, res);
  ok(resBox.status === 200 && JSON.parse(resBox.body).provider === 'stub', 'the route reports the stub when no key is set');
  resBox.body = '';
  await route({ method: 'POST', body: { op: 'talk', req: { game: 'voxel', npcId: 'fern' } } }, res);
  ok(resBox.status === 204 && resBox.body === '', 'without a key the route does not run a talk');
  resBox.body = '';
  await route({ method: 'GET' }, res);
  ok(resBox.status === 405, 'the route refuses anything but POST');
  if (prev == null) delete process.env.AI_API_KEY;
  else process.env.AI_API_KEY = prev;

  console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
  process.exit(fail ? 1 : 0);
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
