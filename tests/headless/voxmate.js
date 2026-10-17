/* Voxel Isle — the deckhand.
 * Follows the last place you worked, speaks from a state machine, and
 * takes four orders. No network. Phone dock stays off the hotbar.
 *
 * Hook-free. Drives the production page.
 */
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const SAVE = {
  v: 1, seed: 3, savedAt: Date.now(),
  state: { helpSeen: true, muted: true, musicOff: true, mateMet: true, coins: 40, buildings: {}, goods: {} },
  edits: [], wet: [], islets: [], plants: [], animals: [], workers: [],
};

(async () => {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const errs = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(String(e).slice(0, 240)));
  await page.addInitScript(save => {
    localStorage.setItem('voxel-garden-v1', JSON.stringify(save));
  }, SAVE);
  await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof isleMate !== 'undefined' && isleMate && typeof updateMate === 'function');
  await page.waitForTimeout(600);

  const born = await page.evaluate(() => ({
    name: isleMate.name,
    known: MATE_NAMES.includes(isleMate.name),
    order: isleMate.order,
    parent: isleMate.mesh.parent === scene,
    booth: mateBoothOn(),
    help: [...document.querySelectorAll('#helpOv li')].some(li => /Deckhand/.test(li.textContent)),
    orders: [...document.querySelectorAll('#mateDock [data-order]')].map(b => b.dataset.order),
  }));
  ok(born.known && born.parent && born.order === 'follow', `deckhand ${born.name} stands on the isle, following`);
  ok(born.orders.join(',') === 'follow,gather,build,wait', 'four orders: follow, gather, build, wait');
  ok(born.help, 'help names the deckhand');
  ok(born.booth === false, 'booth voice is off — no key, no network');

  const greeted = await page.evaluate(() => {
    mateGreet();
    const text = document.getElementById('mateBubbleText').textContent;
    const shown = !document.getElementById('mateBubble').hidden;
    return { text, shown, who: document.getElementById('mateBubbleWho').textContent };
  });
  ok(greeted.shown && greeted.who === born.name && greeted.text.length > 0 && greeted.text.length < 80,
    `speech bubble: ${greeted.who} — ${greeted.text}`);

  const waited = await page.evaluate(() => {
    document.getElementById('mateWait').click();
    isleMate.x = 3; isleMate.z = 3;
    playerAnchor.x = -4; playerAnchor.z = 6;
    for (let i = 0; i < 25; i++) updateMate(0.1);
    return {
      order: isleMate.order,
      saved: state.mateOrder,
      x: isleMate.x, z: isleMate.z,
      pressed: document.getElementById('mateWait').getAttribute('aria-pressed'),
    };
  });
  ok(waited.order === 'wait' && waited.saved === 'wait' && waited.pressed === 'true', 'Wait is an order the button can give');
  ok(Math.abs(waited.x - 3) < 0.05 && Math.abs(waited.z - 3) < 0.05, `waiting holds ground (${waited.x.toFixed(2)}, ${waited.z.toFixed(2)})`);

  const followed = await page.evaluate(() => {
    mateSetOrder('follow', true);
    isleMate.x = 0.5; isleMate.z = 0.5; isleMate.path = null; isleMate.goalx = null;
    playerAnchor.x = 9.5; playerAnchor.z = 0.5;
    const d0 = Math.hypot(isleMate.x - playerAnchor.x, isleMate.z - playerAnchor.z);
    for (let i = 0; i < 40; i++) updateMate(0.1);
    const d1 = Math.hypot(isleMate.x - playerAnchor.x, isleMate.z - playerAnchor.z);
    return { d0, d1 };
  });
  ok(followed.d1 < followed.d0 - 1.5, `follow closes the gap ${followed.d0.toFixed(1)} → ${followed.d1.toFixed(1)}`);

  const gathered = await page.evaluate(() => {
    const x = Math.round(isleMate.x) + 2, z = Math.round(isleMate.z);
    const gy = (surfaceY(x, z) == null ? 4 : surfaceY(x, z)) + 1;
    const mesh = new THREE.Mesh(dropGeo(), new THREE.MeshLambertMaterial({ color: 0xf3e9c0 }));
    const d = { type: 'chicken', x: x + 0.5, z: z + 0.5, y: gy, mesh, age: 0, bob: 0 };
    mesh.userData.dropRef = d;
    mesh.position.set(d.x, gy + 0.3, d.z);
    scene.add(mesh);
    W.drops.push(d);
    const before = state.coins;
    isleMate.cd = {}; isleMate.job = null; isleMate.toldEmpty = false;
    document.getElementById('mateGather').click();
    for (let i = 0; i < 80; i++) updateMate(0.1);
    return { left: W.drops.length, coins: state.coins - before, order: isleMate.order, said: isleMate.bubbleText };
  });
  ok(gathered.left === 0 && gathered.coins >= 3, `gather picked up the egg (+${gathered.coins} coins)`);

  const built = await page.evaluate(() => {
    state.coins = 80; state.level = 1; state.blockSel = 2; state.tool = 'block';
    let run = null;
    for (let x = -6; x <= 4 && !run; x++) for (let z = -4; z <= 4 && !run; z++) {
      const y = surfaceY(x, z);
      if (y == null) continue;
      const cells = [];
      let clear = true;
      for (let i = 0; i < 4; i++) {
        if (explainPlace(x + i, y + 1, z)) { clear = false; break; }
        cells.push([x + i, y + 1, z]);
      }
      if (clear) run = { anchor: { x, y: y + 1, z }, cells };
    }
    if (!run) return { missing: true };
    setBuildMode('line', true);
    buildAnchor = run.anchor;
    playerAnchor.x = run.anchor.x + 6.5; playerAnchor.z = run.anchor.z + 0.5;
    isleMate.x = run.anchor.x + 0.5; isleMate.z = run.anchor.z + 1.5;
    isleMate.path = null; isleMate.goalx = null; isleMate.planBuild = false;
    document.getElementById('mateBuild').click();
    for (let i = 0; i < 140; i++) updateMate(0.1);
    const placed = run.cells.filter(([x, y, z]) => getB(x, y, z) === 2).length;
    return { placed, cells: run.cells.length, order: isleMate.order, anchor: !!buildAnchor, said: isleMate.bubbleText };
  });
  ok(!built.missing && built.placed >= 2, `build here laid ${built.placed} of the open line`);
  ok(!built.missing && built.order === 'follow' && !built.anchor, 'a finished run hands the lead back');

  const warned = await page.evaluate(() => {
    mateSetOrder('follow', true);
    isleMate.cd = {}; isleMate.crowId = null; isleMate.bubbleT = 0; isleMate.rain = false;
    const y = surfaceY(2, 2);
    if (y != null && !W.plants.has(k3(2, y + 1, 2))) {
      setB(2, y, 2, 5, true);
      addPlant(2, y + 1, 2, 'sunflower', true, 1, 1);
    }
    playerAnchor.x = 2.5; playerAnchor.z = 2.5;
    spawnCrow();
    updateMate(0.05);
    const crowLine = document.getElementById('mateBubbleText').textContent;
    if (crow && crow.mesh) { scene.remove(crow.mesh); crow = null; }
    isleMate.rain = false; isleMate.bubbleT = 0;
    rainActive = true;
    updateMate(0.05);
    const rainLine = document.getElementById('mateBubbleText').textContent;
    rainActive = false; isleMate.rain = false;
    let rim = null;
    for (let x = 0; x < 24 && !rim; x++) {
      if (surfaceY(x, 0) != null && surfaceY(x + 1, 0) == null) rim = x + 0.2;
    }
    isleMate.cd = {}; isleMate.bubbleT = 0;
    playerAnchor.x = rim; playerAnchor.z = 0.5;
    updateMate(0.05);
    const edgeLine = document.getElementById('mateBubbleText').textContent;
    playerAnchor.x = 1.5; playerAnchor.z = 1.2;
    isleMate.watch = null;
    updateMate(0.05);
    state.harvests = (state.harvests || 0) + 1;
    updateMate(0.05);
    const harvestLine = document.getElementById('mateBubbleText').textContent;
    return { crowLine, rainLine, edgeLine, harvestLine, rim };
  });
  ok(/crow/i.test(warned.crowLine), `crow warning: ${warned.crowLine}`);
  ok(/rain/i.test(warned.rainLine), `rain warning: ${warned.rainLine}`);
  ok(warned.rim != null && /edge|drop|sky/i.test(warned.edgeLine), `cliff warning: ${warned.edgeLine}`);
  ok(/good one|basket|ripe/i.test(warned.harvestLine), `reacts to a harvest: ${warned.harvestLine}`);

  const kept = await page.evaluate(() => {
    mateSetOrder('wait', true);
    save();
    const raw = JSON.parse(localStorage.getItem('voxel-garden-v1'));
    return raw.state.mateOrder;
  });
  ok(kept === 'wait', 'the order rides the save');

  const net = await page.evaluate(() => performance.getEntriesByType('resource').some(r => /3001|\/api\/chat/.test(r.name)));
  ok(!net, 'playing never calls the booth');

  const covered = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('#mateDock button').forEach(el => {
      const b = el.getBoundingClientRect();
      const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      if (!hit || (hit !== el && !el.contains(hit))) out.push(el.id + ' <- ' + (hit && (hit.id || hit.className)));
    });
    return out;
  });
  ok(covered.length === 0, `desktop orders own their centres${covered.length ? ' — ' + covered.join(', ') : ''}`);

  await ctx.close();

  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true, hasTouch: true, deviceScaleFactor: 2,
  });
  const pp = await phone.newPage();
  pp.on('pageerror', e => errs.push('phone ' + String(e).slice(0, 200)));
  await pp.addInitScript(save => {
    localStorage.setItem('voxel-garden-v1', JSON.stringify(save));
  }, SAVE);
  await pp.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
  await pp.waitForFunction(() => typeof isleMate !== 'undefined' && isleMate);
  await pp.waitForTimeout(500);
  const layout = await pp.evaluate(() => {
    const box = el => el.getBoundingClientRect();
    const hit = el => {
      const b = box(el);
      const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      return !!(top && (top === el || el.contains(top)));
    };
    const overlaps = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
    const dock = box(document.getElementById('mateDock'));
    const buttons = [...document.querySelectorAll('#mateDock button')].map(el => {
      const b = box(el);
      return { id: el.id, w: b.width, h: b.height, owns: hit(el) };
    });
    selectTool('block');
    const bar = box(document.getElementById('buildBar'));
    const town = box(document.getElementById('townBtn'));
    return {
      buttons,
      hot: overlaps(dock, box(document.getElementById('hotbar'))),
      pad: overlaps(dock, box(document.getElementById('camPad'))),
      bar: overlaps(dock, bar),
      town: overlaps(dock, town),
      help: hit(document.getElementById('helpBtn')),
      onScreen: dock.top >= -1 && dock.left >= -1 && dock.right <= innerWidth + 1 && dock.bottom <= innerHeight + 1,
    };
  });
  ok(layout.buttons.every(b => b.w >= 44 && b.h >= 44 && b.owns),
    'phone orders are thumb-sized and own their centres ' + layout.buttons.map(b => `${b.id}:${Math.round(b.w)}x${Math.round(b.h)}`).join(' '));
  ok(layout.onScreen && !layout.hot && !layout.pad && !layout.bar && !layout.town && layout.help,
    'phone dock stays on screen, off the hotbar, camera pad, build bar, and town');

  await browser.close();
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
