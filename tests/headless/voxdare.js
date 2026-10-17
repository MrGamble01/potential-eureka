/* Harbor dare, kiln juice, and phone camera controls.
 * The dare is a same-day local note: no server, claim pays once,
 * a bad or off-day note is refused. Touch slop keeps a short slip
 * as a tap and a longer drag as orbit.
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
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.addInitScript(() => {
      localStorage.setItem('voxel-garden-v1', JSON.stringify({
        v: 1, seed: 7, savedAt: Date.now(),
        state: {
          helpSeen: true, muted: true, musicOff: true,
          coins: 40, level: 2, xp: 0, questIdx: 99,
          buildings: {}, goods: {},
          request: { key: 'earn', goal: 1e12, text: 'hold', reward: 1 },
        },
        edits: [], wet: [], islets: [], plants: [], animals: [], workers: [],
      }));
      localStorage.setItem('voxel-dare-board', '{"nope":true}');
    });
    await page.goto(BASE + '/voxel-garden.html', { waitUntil: 'load' });
    await page.waitForFunction(() => typeof dareClaim === 'function' && typeof dareView === 'function');

    const roll = await page.evaluate(() => {
      const a = dareRoll('2026-10-17');
      const b = dareRoll('2026-10-17');
      const c = dareRoll('2026-10-18');
      const kind = dareKind(a.id);
      return {
        same: JSON.stringify(a) === JSON.stringify(b),
        diff: JSON.stringify(a) !== JSON.stringify(c),
        goalOk: a.goal >= kind.min && a.goal <= kind.max,
        ferryOk: a.ferry >= a.goal && a.ferry <= a.goal + 2,
        board: dareBoard().length,
      };
    });
    assert.equal(roll.same, true);
    assert.equal(roll.diff, true);
    assert.equal(roll.goalOk, true);
    assert.equal(roll.ferryOk, true);
    assert.equal(roll.board, 0);
    console.log('PASS dare roll is stable and a corrupt board is ignored');

    const claim = await page.evaluate(() => {
      const v = dareView();
      const kind = dareKind(v.id);
      state.dare.goal = 1;
      state.dare.paid = false;
      if (v.id === 'till') state.tills = (state.dare.base | 0) + 1;
      else if (v.id === 'plant') state.planted = (state.dare.base | 0) + 1;
      else if (v.id === 'water') state.waters = (state.dare.base | 0) + 1;
      else if (v.id === 'harvest') state.harvests = (state.dare.base | 0) + 1;
      else state.decor = (state.dare.base | 0) + 1;
      const before = state.coins;
      const first = dareClaim();
      const mid = state.coins;
      const second = dareClaim();
      SFX.play('kiln'); SFX.play('seal'); SFX.play('ripple'); SFX.play('dare');
      juiceKick(0.4);
      feel('kiln');
      return {
        first, second, mid, before, after: state.coins,
        reward: kind.reward + 1, shake: juice.t > 0,
        flash: document.getElementById('juiceFlash').className.indexOf('hot') >= 0,
      };
    });
    assert.equal(claim.first, true);
    assert.equal(claim.second, false);
    assert.equal(claim.mid, claim.before + claim.reward);
    assert.equal(claim.after, claim.mid);
    assert.equal(claim.shake, true);
    assert.equal(claim.flash, true);
    console.log('PASS claiming the dare pays once, and kiln juice runs while muted');

    const note = await page.evaluate(() => {
      state.dare.paid = false;
      const code = dareEncode('Northplot', 4);
      const decoded = dareDecode(code);
      const torn = dareImport(code.slice(0, -1) + (code.endsWith('a') ? 'b' : 'a'));
      const kept = dareImport(code);
      const v = dareView();
      const payload = JSON.stringify({ v: 1, d: '1999-01-01', k: v.id, g: v.goal, s: 2, n: 'Otherday' });
      const b = btoa(unescape(encodeURIComponent(payload))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const offDay = dareImport(b + '.' + dareHash(b).toString(36));
      const names = dareBoard().filter(r => r.n === 'Northplot').map(r => r.s);
      return { decoded, torn: torn.ok, kept: kept.ok, names, offDay: offDay.ok, offError: offDay.error };
    });
    assert.equal(note.decoded.n, 'Northplot');
    assert.equal(note.decoded.s, 4);
    assert.equal(note.torn, false);
    assert.equal(note.kept, true);
    assert.deepEqual(note.names, [4]);
    assert.equal(note.offDay, false);
    assert.match(note.offError, /different day/);
    console.log('PASS a neighbor note imports, and a torn or off-day note does not');

    const slip = await page.evaluate(() => {
      const cv = renderer.domElement;
      let release;
      for (let y = 160; y < innerHeight - 160 && !release; y += 10) {
        for (let x = 100; x < innerWidth - 80; x += 10) {
          const hit = raycastAt(x, y);
          if (!hit || !hit.object.userData.isTerrain) continue;
          const cell = cellFromHit(hit, true);
          const [bx, by, bz] = cell;
          if ((getB(bx, by, bz) === 1 || getB(bx, by, bz) === 2) && !getB(bx, by + 1, bz)) {
            release = { x, y }; break;
          }
        }
      }
      if (!release) throw new Error('no soil');
      selectTool('hoe');
      const emit = (type, px, py) => cv.dispatchEvent(new PointerEvent(type, {
        bubbles: true, pointerId: 7, pointerType: 'touch', clientX: px, clientY: py,
      }));
      const before = state.tills;
      // The tool runs at pointerup. A 10px slip must still count as that tap.
      emit('pointerdown', release.x - 10, release.y);
      emit('pointermove', release.x, release.y);
      emit('pointerup', release.x, release.y);
      const slipped = state.tills === before + 1;
      let dragTarget;
      for (let y = 160; y < innerHeight - 160 && !dragTarget; y += 10) {
        for (let x = 80; x < innerWidth - 80; x += 10) {
          const hit = raycastAt(x, y);
          if (!hit || !hit.object.userData.isTerrain) continue;
          const cell = cellFromHit(hit, true);
          const [bx, by, bz] = cell;
          if ((getB(bx, by, bz) === 1 || getB(bx, by, bz) === 2) && !getB(bx, by + 1, bz)) {
            dragTarget = { x, y }; break;
          }
        }
      }
      const tills = state.tills;
      emit('pointerdown', dragTarget.x, dragTarget.y);
      emit('pointermove', dragTarget.x + 20, dragTarget.y);
      emit('pointerup', dragTarget.x + 20, dragTarget.y);
      return { slipped, dragged: state.tills === tills };
    });
    assert.equal(slip.slipped, true);
    assert.equal(slip.dragged, true);
    console.log('PASS a 10px finger slip still tills and a 20px drag does not');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(250);
    const phone = await page.evaluate(() => {
      const hit = (id) => {
        const el = document.getElementById(id);
        const r = el.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!(top && (top === el || el.contains(top)));
      };
      const yaw = cam.tyaw;
      document.getElementById('camRight').click();
      selectTool('block');
      const dare = document.getElementById('dareChip');
      const bar = document.getElementById('buildBar').getBoundingClientRect();
      const pad = document.getElementById('camPad').getBoundingClientRect();
      const hot = document.getElementById('hotbar').getBoundingClientRect();
      const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      return {
        pad: getComputedStyle(document.getElementById('camPad')).display,
        turned: cam.tyaw > yaw,
        town: hit('townBtn'),
        help: hit('helpBtn'),
        dare: !!(dare && !dare.hidden && getComputedStyle(dare).display !== 'none' && hit('dareChip')),
        padHot: overlaps(pad, hot),
        padBar: overlaps(pad, bar),
      };
    });
    assert.equal(phone.pad, 'grid');
    assert.equal(phone.turned, true);
    assert.equal(phone.town, true);
    assert.equal(phone.help, true);
    assert.equal(phone.dare, true);
    assert.equal(phone.padHot, false);
    assert.equal(phone.padBar, false);
    console.log('PASS phone camera pad turns the isle and leaves Town, Help, and the dare tappable');

    await page.click('#dareChip');
    const sheet = await page.evaluate(() => {
      const p = document.getElementById('darePanel');
      return { open: p.classList.contains('open'), text: p.innerText };
    });
    assert.equal(sheet.open, true);
    assert.match(sheet.text, /Harbor dare/);
    assert.match(sheet.text, /Morning ferry/);
    assert.match(sheet.text, /Northplot/);
    assert.deepEqual(errors, []);
    console.log('PASS the harbor sheet lists the ferry and the pasted note, no page errors');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
