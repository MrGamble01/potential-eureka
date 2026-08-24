/*
 * VOX-5 — stardust & wishes (re-runnable; classic script, no hook).
 *  A. Registration: the wish1 ach + how-to line exist.
 *  B. Shards only fall at night; one spawns hovering over the garden.
 *  C. Collecting counts toward the wish (1/3, 2/3); the third grants it:
 *     exact +20% grow-bar surge on every growing crop, wishes counter.
 *  D. An uncollected shard fades at dawn.
 *  E. 🏆 Upon a Star; stardust/wishes ride the wholesale save.
 *  Z. Zero page errors.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('vs-init')) {
      sessionStorage.setItem('vs-init', '1');
      localStorage.removeItem('voxel-garden-v1');
    }
  });
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  const t = fn => page.evaluate(fn);

  // A. registration
  const a = await t(() => ({
    ach: ACH.some(x => x[0] === 'wish1'),
    howto: document.body.innerHTML.includes('Stardust'),
  }));
  ok(a.ach && a.howto, 'Upon a Star ach + how-to line exist');

  // B. night gate + spawn
  const b = await t(() => {
    state.time = CYCLE * 0.3;              // broad daylight
    shard = null; shardNextT = 0.01;
    updateShard(1);
    const dayGate = !shard;
    state.time = CYCLE * 0.85;             // deep night
    shardNextT = 0.01;
    updateShard(0.1);
    return { dayGate, spawned: !!shard, hover: shard && shard.mesh.position.y > shard.y };
  });
  ok(b.dayGate, 'no shards in daylight');
  ok(b.spawned && b.hover, 'a shard falls at night and hovers over the garden');

  // C. collect ×3 → the wish, exact surge math
  const c = await t(() => {
    state.stardust = 0; state.wishes = 0;
    collectShard();                        // 1/3 (uses the live shard)
    const one = state.stardust;
    state.time = CYCLE * 0.85; shardNextT = 0.01; updateShard(0.1);
    collectShard();                        // 2/3
    const two = state.stardust;
    // seed a synthetic growing crop with known progress for exact math;
    // removed again before the live loop can touch it
    const key = Object.keys(PLANTS).find(k => PLANTS[k].grow);
    const fake = { type: key, x: 3, y: 6, z: 3, stage: 0, prog: 1 };
    const mapKey = k3(3, 6, 3) + '-vs-test';
    W.plants.set(mapKey, fake);
    state.time = CYCLE * 0.85; shardNextT = 0.01; updateShard(0.1);
    collectShard();                        // 3/3 → wish
    const prog = fake.prog;
    W.plants.delete(mapKey);
    return { one, two, after: state.stardust, wishes: state.wishes,
      seeded: { key, grow: PLANTS[key].grow }, prog };
  });
  ok(c.one === 1 && c.two === 2, 'shards count toward the wish (1/3, 2/3)');
  ok(c.after === 0 && c.wishes === 1, 'the third shard grants the wish and resets the count');
  ok(Math.abs(c.prog - (1 + c.seeded.grow * 0.20)) < 0.001,
    `the wish surges a growing ${c.seeded.key} by exactly grow×0.20 (prog 1→${c.prog.toFixed(1)})`);

  // D. dawn fades an uncollected shard
  const d = await t(() => {
    state.time = CYCLE * 0.85; shard = null; shardNextT = 0.01; updateShard(0.1);
    const had = !!shard;
    state.time = CYCLE * 0.3;              // morning comes
    updateShard(0.1);
    return { had, faded: !shard, stardust: state.stardust };
  });
  ok(d.had && d.faded && d.stardust === 0, 'an uncollected shard fades with the morning light');

  // E. ach + persistence
  const e1 = await t(() => { checkAch(); save(); return { ach: !!state.ach.wish1 }; });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(3000);
  const e2 = await t(() => ({ wishes: state.wishes, ach: !!state.ach.wish1 }));
  ok(e1.ach, '🏆 Upon a Star unlocks on the first wish');
  ok(e2.wishes === 1 && e2.ach, 'wishes + trophy ride the wholesale state save');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();
