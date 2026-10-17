/* North Fen kiln and the build controls that feed it.
 * Hook-free: the page's own functions, a real build-bar click, and Z.
 *
 * A. Clay, moss, brick and sea glass are buildable, and the fen is a
 *    fourth islet with its own moss, clay and a cracked brick ring.
 * B. Sealing the ring pays the seal purse once. Firing pays 27, then
 *    refuses until the next day, then pays 30. A second seal does not
 *    pay again.
 * C. Occupied ground still refuses without a second charge.
 * D. A line and a floor are one undo. Shift-replace nets the cost
 *    difference. R copies the block under the cursor.
 * E. The build bar and Z undo a real placement. The kiln survives reload.
 * Z. Zero page errors.
 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.addInitScript(() => {
      if (sessionStorage.getItem('voxkiln-init')) return;
      sessionStorage.setItem('voxkiln-init', '1');
      localStorage.setItem('voxel-garden-v1', JSON.stringify({
        v: 1, seed: 7, savedAt: Date.now(),
        state: {
          helpSeen: true, muted: true, musicOff: true,
          coins: 5000, level: 13, xp: 99999, questIdx: 99,
          buildings: {}, goods: {},
          request: { key: 'earn', goal: 1e12, text: 'hold', reward: 1 },
        },
        edits: [], wet: [], islets: [], plants: [], animals: [], workers: [],
      }));
    });
    await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
    await page.waitForFunction(() => typeof placeSelected === 'function' && kilnOk());

    const world = await page.evaluate(() => {
      const it = ISLETS.find(i => i.biome === 'fen');
      const gapSet = new Set(state.kiln.gaps.map(c => c.join(',')));
      const standing = state.kiln.cells.filter(c => !gapSet.has(c.join(',')));
      let moss = 0, clay = 0;
      for (const [key, id] of W.blocks) {
        const [x, , z] = key.split(',').map(Number);
        if (Math.hypot(x - it.x, z - it.z) > it.r + 2) continue;
        if (id === 10) moss++;
        if (id === 9) clay++;
      }
      const fenWater = (W.pondCells || []).filter(c => c[2] != null && c[1] > 20);
      const arch = ACH.find(a => a[0] === 'islet3');
      return {
        blocks: [9, 10, 11, 12].map(id => ({
          id, name: BLOCKS[id] && BLOCKS[id].name, cost: BLOCKS[id] && BLOCKS[id].cost,
          buildable: BUILDABLE.includes(id),
        })),
        islets: ISLETS.length,
        risen: W.islets.includes(3),
        gaps: state.kiln.gaps.length,
        standing: standing.length,
        standingBrick: standing.every(c => getB(c[0], c[1], c[2]) === 11),
        gapsEmpty: state.kiln.gaps.every(c => getB(c[0], c[1], c[2]) === 0),
        moss, clay, fenWater: fenWater.length,
        pay1: kilnPay(1), pay2: kilnPay(2), payCap: kilnPay(99),
        seal: KILN_SEAL_COINS,
        arch: arch[4](),
      };
    });
    assert.deepEqual(world.blocks.map(b => b.buildable), [true, true, true, true]);
    assert.ok(world.blocks.every(b => b.cost > 0 && b.name));
    assert.equal(world.islets, 4);
    assert.equal(world.risen, true);
    assert.equal(world.gaps, 3);
    assert.equal(world.standing, 5);
    assert.equal(world.standingBrick, true);
    assert.equal(world.gapsEmpty, true);
    assert.ok(world.moss > 8, 'fen grows moss, saw ' + world.moss);
    assert.ok(world.clay > 8, 'fen grows clay, saw ' + world.clay);
    assert.ok(world.fenWater > 0, 'fen pool has its own water line');
    assert.equal(world.pay1, 27);
    assert.equal(world.pay2, 30);
    assert.equal(world.payCap, 54);
    assert.equal(world.seal, 40);
    assert.equal(world.arch[1], 4);
    console.log('PASS fen biome, four blocks, cracked kiln, firing math');

    const sealed = await page.evaluate(() => {
      state.blockSel = 11;
      state.level = 13;
      const gaps = state.kiln.gaps.map(c => c.slice());
      const before = state.coins;
      for (let i = 0; i < gaps.length - 1; i++) placeSelected(gaps[i][0], gaps[i][1], gaps[i][2]);
      const mid = { coins: state.coins, sealed: state.kiln.sealed, paid: !!state.kiln.paid };
      const last = gaps[gaps.length - 1];
      const placed = placeSelected(last[0], last[1], last[2]);
      return {
        placed, mid,
        coins: state.coins,
        sealed: !!state.kiln.sealed,
        paid: !!state.kiln.paid,
        brickCost: BLOCKS[11].cost,
        before,
        gaps: gaps.length,
      };
    });
    assert.equal(sealed.mid.sealed, false);
    assert.equal(sealed.mid.paid, false);
    assert.equal(sealed.mid.coins, sealed.before - sealed.brickCost * (sealed.gaps - 1));
    assert.equal(sealed.placed, true);
    assert.equal(sealed.sealed, true);
    assert.equal(sealed.paid, true);
    assert.equal(sealed.coins, sealed.mid.coins - sealed.brickCost + world.seal);
    console.log('PASS sealing the ring pays the purse once');

    const fired = await page.evaluate(() => {
      const before = state.coins;
      const first = fireKiln();
      const afterFirst = state.coins;
      const second = fireKiln();
      const afterSecond = state.coins;
      state.day += 1;
      const third = fireKiln();
      return {
        first, second, third,
        pay1: afterFirst - before,
        pay2: afterSecond - afterFirst,
        pay3: state.coins - afterSecond,
        fires: state.kiln.fires,
        hot: document.querySelector('#toasts .toast') && document.getElementById('kilnTxt').textContent,
      };
    });
    assert.equal(fired.first, true);
    assert.equal(fired.pay1, 27);
    assert.equal(fired.second, false);
    assert.equal(fired.pay2, 0);
    assert.equal(fired.third, true);
    assert.equal(fired.pay3, 30);
    assert.equal(fired.fires, 2);
    console.log('PASS daily firing pays 27, waits for dawn, then pays 30');

    const reseal = await page.evaluate(() => {
      const gap = state.kiln.gaps[state.kiln.gaps.length - 1];
      const coins = state.coins;
      undoBuild();
      const open = getB(gap[0], gap[1], gap[2]) === 0 && state.kiln.sealed === false;
      const coinsOpen = state.coins;
      state.blockSel = 11;
      placeSelected(gap[0], gap[1], gap[2]);
      return { open, paid: state.kiln.paid, sealed: state.kiln.sealed,
        coins, coinsOpen, coinsAfter: state.coins, cost: BLOCKS[11].cost };
    });
    assert.equal(reseal.open, true);
    assert.equal(reseal.sealed, true);
    assert.equal(reseal.paid, true);
    assert.equal(reseal.coinsAfter, reseal.coinsOpen - reseal.cost);
    console.log('PASS cracking and resealing does not pay the purse again');

    const occupied = await page.evaluate(() => {
      const ground = [...W.blocks.keys()].map(k => k.split(',').map(Number)).find(([x, y, z]) =>
        Math.abs(x) < 8 && Math.abs(z) < 8 && !getB(x, y + 1, z) && !W.plants.has(x + ',' + (y + 1) + ',' + z));
      const [x, gy, z] = ground, y = gy + 1;
      state.blockSel = 2;
      document.getElementById('toasts').replaceChildren();
      const coins = state.coins, decor = state.decor;
      placeSelected(x, y, z);
      const once = { block: getB(x, y, z), coins: state.coins, decor: state.decor };
      document.getElementById('toasts').replaceChildren();
      const again = placeSelected(x, y, z);
      const toast = document.querySelector('#toasts .toast') && document.querySelector('#toasts .toast').textContent;
      return { once, again, toast, coins, decor, cost: BLOCKS[2].cost, block: getB(x, y, z) };
    });
    assert.equal(occupied.once.block, 2);
    assert.equal(occupied.once.coins, occupied.coins - occupied.cost);
    assert.equal(occupied.once.decor, occupied.decor + 1);
    assert.equal(occupied.again, false);
    assert.equal(occupied.toast, 'Something is in the way');
    assert.equal(occupied.block, 2);
    assert.equal(occupied.once.coins, occupied.coins - occupied.cost);
    console.log('PASS occupied ground still refuses without a second charge');

    const shapes = await page.evaluate(() => {
      const ground = [...W.blocks.keys()].map(k => k.split(',').map(Number)).find(([x, y, z]) => {
        if (Math.abs(x) > 6 || Math.abs(z) > 6) return false;
        for (let i = 0; i < 4; i++) if (getB(x + i, y + 1, z) || W.plants.has((x + i) + ',' + (y + 1) + ',' + z)) return false;
        for (let dz = 0; dz < 2; dz++) for (let dx = 0; dx < 2; dx++) {
          if (getB(x + dx, y + 2, z + 3 + dz)) return false;
        }
        return true;
      });
      if (!ground) throw new Error('no clear pad');
      const [x, gy, z] = ground, y = gy + 1;
      state.blockSel = 2;
      const line = strokeCells({ x, y, z }, { x: x + 3, y, z }, 'line');
      const before = state.coins;
      const n = commitStroke(line);
      const laid = line.every(c => getB(c[0], c[1], c[2]) === 2);
      undoBuild();
      const cleared = line.every(c => getB(c[0], c[1], c[2]) === 0);
      const refunded = state.coins === before;
      const floorCells = strokeCells({ x, y: y + 1, z: z + 3 }, { x: x + 1, y: y + 4, z: z + 4 }, 'floor');
      const fn = commitStroke(floorCells);
      const floorLaid = floorCells.every(c => getB(c[0], c[1], c[2]) === 2 && c[1] === y + 1);
      undoBuild();
      const floorGone = floorCells.every(c => getB(c[0], c[1], c[2]) === 0);
      const cap = strokeCells({ x: 0, y: 5, z: 0 }, { x: 30, y: 9, z: 40 }, 'floor');
      state.blockSel = 3;
      setB(x, y, z, 2);
      const coins = state.coins;
      const replaced = replaceBlock(x, y, z);
      const afterReplace = { block: getB(x, y, z), coins: state.coins };
      undoBuild();
      const restored = { block: getB(x, y, z), coins: state.coins };
      setB(x, y, z, 0);
      return {
        line: line.map(c => c.join(',')), n, laid, cleared, refunded,
        floorN: fn, floorLen: floorCells.length, floorLaid, floorGone,
        cap: cap.length, capY: cap.every(c => c[1] === 5),
        replaced, afterReplace, restored, coins,
        stone: BLOCKS[3].cost, dirt: BLOCKS[2].cost,
      };
    });
    assert.equal(shapes.line.length, 4);
    assert.equal(shapes.n, 4);
    assert.equal(shapes.laid, true);
    assert.equal(shapes.cleared, true);
    assert.equal(shapes.refunded, true);
    assert.equal(shapes.floorLen, 4);
    assert.equal(shapes.floorN, 4);
    assert.equal(shapes.floorLaid, true);
    assert.equal(shapes.floorGone, true);
    assert.equal(shapes.cap, 64);
    assert.equal(shapes.capY, true);
    assert.equal(shapes.replaced, true);
    assert.equal(shapes.afterReplace.block, 3);
    assert.equal(shapes.afterReplace.coins, shapes.coins - shapes.stone + shapes.dirt);
    assert.equal(shapes.restored.block, 2);
    assert.equal(shapes.restored.coins, shapes.coins);
    console.log('PASS line, floor, undo and shift-replace');

    const copied = await page.evaluate(() => {
      const ground = [...W.blocks.keys()].map(k => k.split(',').map(Number)).find(([x, y, z]) =>
        getB(x, y, z) === 1 && Math.abs(x) < 10 && Math.abs(z) < 10);
      const [x, y, z] = ground;
      state.blockSel = 2;
      const hit = {
        object: { userData: { isTerrain: true } },
        face: { normal: { x: 0, y: 1, z: 0 } },
        point: { x: x + 0.5, y: y + 1, z: z + 0.5 },
      };
      const ok = eyedropBlock(hit);
      return { ok, sel: state.blockSel, tool: state.tool };
    });
    assert.equal(copied.ok, true);
    assert.equal(copied.sel, 1);
    assert.equal(copied.tool, 'block');
    console.log('PASS eyedropper copies the block you are looking at');

    await page.evaluate(() => { selectTool('block'); state.blockSel = 4; });
    await page.click('#buildBar button[data-mode="line"]');
    const ui = await page.evaluate(() => ({
      mode: state.buildMode,
      shown: document.getElementById('buildBar').hidden === false,
      lineOn: document.querySelector('#buildBar [data-mode="line"]').classList.contains('on'),
    }));
    assert.equal(ui.mode, 'line');
    assert.equal(ui.shown, true);
    assert.equal(ui.lineOn, true);
    const zUndo = await page.evaluate(() => {
      state.buildMode = 'single';
      const ground = [...W.blocks.keys()].map(k => k.split(',').map(Number)).find(([x, y, z]) =>
        Math.abs(x) < 8 && Math.abs(z) < 8 && !getB(x, y + 1, z));
      const [x, gy, z] = ground;
      state.blockSel = 4;
      const before = state.coins;
      placeSelected(x, gy + 1, z);
      return { x, y: gy + 1, z, before, coins: state.coins, block: getB(x, gy + 1, z) };
    });
    await page.keyboard.press('z');
    await page.waitForFunction((cell) => getB(cell.x, cell.y, cell.z) === 0, zUndo);
    const afterZ = await page.evaluate((cell) => ({
      block: getB(cell.x, cell.y, cell.z), coins: state.coins,
    }), zUndo);
    assert.equal(zUndo.block, 4);
    assert.equal(afterZ.block, 0);
    assert.equal(afterZ.coins, zUndo.before);
    console.log('PASS build bar switches to Line and Z undoes a placement');

    const nav = await page.evaluate(() => {
      const hit = (id) => {
        const el = document.getElementById(id);
        const r = el.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!(top && (top === el || el.contains(top)));
      };
      return { town: hit('townBtn'), help: hit('helpBtn'), quest: hit('qKiln') || hit('quests') };
    });
    assert.equal(nav.town, true);
    assert.equal(nav.help, true);
    assert.equal(nav.quest, true);
    console.log('PASS kiln goal leaves town and help tappable');

    const kept = await page.evaluate(() => ({
      fires: state.kiln.fires, paid: state.kiln.paid, sealed: state.kiln.sealed, coins: state.coins,
    }));
    await page.evaluate(() => save());
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => typeof kilnOk === 'function' && kilnOk() && state.kiln.paid);
    const loaded = await page.evaluate(() => ({
      fires: state.kiln.fires, paid: state.kiln.paid, sealed: !!state.kiln.sealed,
      gaps: state.kiln.gaps.every(c => getB(c[0], c[1], c[2]) === 11),
    }));
    assert.equal(loaded.fires, kept.fires);
    assert.equal(loaded.paid, true);
    assert.equal(loaded.sealed, true);
    assert.equal(loaded.gaps, true);
    assert.deepEqual(errors, []);
    console.log('PASS kiln survives reload, no page errors');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
