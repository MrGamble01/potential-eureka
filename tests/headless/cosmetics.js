/* Spark shop: earn from XP, trophies, dailies and bosses; spend;
 * the unlock survives a new read of the same progress document.
 *
 * The browser half opens the trophy-room shop, previews, buys, and
 * checks the equipped look is still there for Hearthvale and Age of War.
 */
const { chromium } = require('playwright');
const Persist = require('../../js/persist.js');
const Progress = require('../../js/progression.js');
const Cosmetics = require('../../js/cosmetics.js');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

function mem() {
  const m = new Map();
  return {
    getItem(k) { return m.has(k) ? m.get(k) : null; },
    setItem(k, v) { m.set(String(k), String(v)); },
    removeItem(k) { m.delete(k); },
    get length() { return m.size; },
    key(i) { return Array.from(m.keys())[i] || null; },
  };
}

function shop(box) {
  const store = box || mem();
  const persist = Persist.create(store);
  const ids = function () { return Progress.ACHIEVEMENTS.map(function (a) { return a.id; }); };
  const cosmetics = Cosmetics.create(persist, { storage: store, achievementIds: ids, now: function () { return 1700000000000; } });
  const progress = Progress.create(persist, {
    cosmetics: function (doc) { return cosmetics.fold(doc); },
  });
  return { store: store, persist: persist, cosmetics: cosmetics, progress: progress };
}

const trailCost = Cosmetics.CATALOG.filter(function (i) { return i.id === 'trail-cinder'; })[0].cost;
const voidCost = Cosmetics.CATALOG.filter(function (i) { return i.id === 'skin-void'; })[0].cost;

{
  const s = shop();
  ok(s.cosmetics.purse().sparks === 0 && s.store.getItem(Persist.PROGRESS_KEY) == null,
    'a fresh career has no sparks and reading it does not write');
  const broke = s.cosmetics.buy('trail-cinder');
  ok(!broke.ok && broke.reason === 'broke' && s.cosmetics.purse().sparks === 0, 'buying with an empty purse spends nothing');
  ok(s.cosmetics.preview('trail-cinder').name === 'Cinder Trail' && s.cosmetics.purse().sparks === 0,
    'preview does not spend sparks');
  ok(!s.cosmetics.buy('not-a-look').ok, 'an unknown cosmetic is refused');
  ok(!s.cosmetics.equip('skin-void').ok && !s.cosmetics.look().skin, 'an unowned cosmetic cannot be equipped');
}

{
  const s = shop();
  s.progress.emit('hearthvale', 'found', 1);
  const once = Math.floor(25 / Cosmetics.RATES.xp) + Cosmetics.RATES.ach;
  ok(s.cosmetics.purse().sparks === once && s.progress.profile().sparks === once,
    'founding a valley pays XP sparks and the trophy (' + once + ')');
  s.progress.emit('hearthvale', 'found', 1);
  ok(s.cosmetics.purse().sparks === once, 'the same event does not pay sparks twice');
  ok(s.cosmetics.settle() === 0 && s.cosmetics.purse().sparks === once, 'settling again does not mint more');
}

{
  const s = shop();
  s.progress.emit('hearthvale', 'boss', 1);
  const profile = s.progress.profile();
  const trophies = Object.keys(profile.unlocked).length;
  const expected = Math.floor(profile.xp / Cosmetics.RATES.xp) + trophies * Cosmetics.RATES.ach + Cosmetics.RATES.boss;
  ok(profile.unlocked['hearth-wolf'] && profile.unlocked['cross-boss'] && s.cosmetics.purse().sparks === expected,
    'a boss kill pays its trophies and a boss bounty (' + expected + ')');
  s.progress.emit('hearthvale', 'boss', 1);
  ok(s.cosmetics.purse().sparks === expected, 'the same stand does not pay the bounty twice');
}

{
  const s = shop();
  ok(s.cosmetics.grantDaily('flag', '2026-10-17') === Cosmetics.RATES.flag, 'a flagship daily mints sparks once');
  ok(s.cosmetics.grantDaily('flag', '2026-10-17') === 0, 'the same flagship daily does not pay again');
  s.store.setItem('arcade-daily-snake-2026-10-17', '40');
  ok(s.cosmetics.grantDaily('arcade', '2026-10-17') === Cosmetics.RATES.arcade, 'an arcade daily mints sparks once');
  ok(s.cosmetics.settle() === 0, 'scanning the stored arcade daily does not pay twice');
  ok(s.cosmetics.grantDaily('nope', '2026-10-17') === 0 && s.cosmetics.grantDaily('flag', 'yesterday') === 0,
    'a bad daily kind or date is ignored');
}

{
  const s = shop();
  s.store.setItem('eureka-flag-daily-v1', JSON.stringify({ v: 1, days: { '2026-01-02': { met: true, game: 'tycoon' } } }));
  ok(s.cosmetics.settle() === Cosmetics.RATES.flag, 'a flagship daily already on disk pays when the purse settles');
  ok(s.cosmetics.settle() === 0, 'that disk daily stays paid');
}

{
  const s = shop();
  s.progress.emit('tycoon', 'visit', 1);
  s.progress.emit('tycoon', 'hire');
  s.progress.emit('hearthvale', 'found', 1);
  const before = s.cosmetics.purse().sparks;
  const cloakCost = Cosmetics.CATALOG.filter(function (i) { return i.id === 'palette-orchard'; })[0].cost;
  ok(before < voidCost && before >= trailCost + cloakCost, 'early trophies afford a trail and a cloak, not the void banner (' + before + ')');
  const refused = s.cosmetics.buy('skin-void');
  ok(!refused.ok && refused.reason === 'broke' && s.cosmetics.purse().sparks === before, 'a short purse does not buy the void banner');
  const trail = s.cosmetics.buy('trail-cinder');
  const cloak = s.cosmetics.buy('palette-orchard');
  ok(trail.ok && cloak.ok && s.cosmetics.look().trail.id === 'trail-cinder' && s.cosmetics.look().palette.id === 'palette-orchard',
    'a trail and a cloak equip together');
  ok(s.cosmetics.purse().sparks === before - trailCost - cloakCost, 'the two prices leave the purse');
  ok(s.cosmetics.buy('trail-cinder').reason === 'owned', 'buying an owned cosmetic does not spend again');
  s.progress.setName('Ada Lovelace');
  const reloaded = Cosmetics.create(Persist.create(s.store), {
    storage: s.store,
    achievementIds: function () { return Progress.ACHIEVEMENTS.map(function (a) { return a.id; }); },
  });
  ok(reloaded.look().palette.id === 'palette-orchard' && reloaded.look().trail.id === 'trail-cinder'
    && reloaded.purse().sparks === s.cosmetics.purse().sparks && reloaded.purse().owned['trail-cinder'] > 1e12,
    'a new read keeps the unlocks, the equipped looks, and the balance');
  ok(s.persist.progress.get('tycoon') == null, 'buying a cosmetic does not invent a Tycoon continue');
  reloaded.unequip('trail');
  ok(!reloaded.look().trail && reloaded.look().palette.id === 'palette-orchard', 'taking a trail off leaves the cloak');
  ok(reloaded.equip('trail-cinder').ok && reloaded.look().trail.id === 'trail-cinder', 'an owned trail can be worn again');
}

{
  const box = mem();
  box.setItem(Persist.PROGRESS_KEY, JSON.stringify({
    v: 1,
    games: { hearthvale: { savedAt: 5, summary: { day: 2 }, badge: 'oak' } },
    career: { name: 'Ada', xp: 40, unlocked: { 'hearth-found': 5 }, stats: {} },
  }));
  const persist = Persist.create(box);
  const cosmetics = Cosmetics.create(persist, {
    storage: box,
    achievementIds: function () { return ['hearth-found']; },
  });
  const gained = cosmetics.settle();
  ok(gained === Math.floor(40 / Cosmetics.RATES.xp) + Cosmetics.RATES.ach, 'an old career pays sparks for the XP and trophy it already had');
  const raw = JSON.parse(box.getItem(Persist.PROGRESS_KEY));
  ok(raw.career.name === 'Ada' && raw.games.hearthvale.summary.day === 2 && raw.games.hearthvale.badge === 'oak'
    && raw.career.sparks === gained && raw.career.owned && !raw.career.unlocked['nope!'],
    'settling sparks keeps the name and the other game');
  const messy = mem();
  messy.setItem(Persist.PROGRESS_KEY, JSON.stringify({
    v: 1,
    games: {},
    career: { sparks: -9, ledger: 'nope', owned: [1], equipped: { cape: 'void', trail: 'trail-cinder' }, xp: 0 },
  }));
  let threw = false;
  let purse = null;
  let worn = null;
  try {
    const api = Cosmetics.create(Persist.create(messy), { storage: messy, achievementIds: function () { return []; } });
    purse = api.purse();
    worn = api.look();
  } catch (e) { threw = true; }
  ok(!threw && purse.sparks === 0 && !purse.equipped.cape && !worn.trail && !worn.skin,
    'a messy purse is clamped and does not throw');
  const cloth = Cosmetics.CATALOG.filter(function (i) { return i.id === 'tarp-ward'; })[0];
  ok(cloth && cloth.slot === 'tarp' && cloth.cost === 44 && cloth.color === '#6d4cff' && cloth.accent === '#ff4ad2'
    && cloth.games[0] === 'Homeless Village',
    'ward cloth is a tarp look priced in sparks');
  const wardBox = mem();
  wardBox.setItem(Persist.PROGRESS_KEY, JSON.stringify({
    v: 1,
    games: {},
    career: { sparks: 12, owned: { 'tarp-ward': 1 }, equipped: { tarp: 'tarp-ward' } },
  }));
  const dyed = Cosmetics.create(Persist.create(wardBox), { storage: wardBox, achievementIds: function () { return []; } }).look();
  ok(dyed.tarp && dyed.tarp.id === 'tarp-ward' && dyed.tarp.color === '#6d4cff' && dyed.tarp.accent === '#ff4ad2' && !dyed.skin,
    'an equipped ward cloth survives a read and does not become a banner');
  const stripped = mem();
  stripped.setItem(Persist.PROGRESS_KEY, JSON.stringify({
    v: 1,
    games: {},
    career: { sparks: 12, owned: {}, equipped: { tarp: 'tarp-ward', cape: 'nope' } },
  }));
  const undyed = Cosmetics.create(Persist.create(stripped), { storage: stripped, achievementIds: function () { return []; } });
  ok(!undyed.look().tarp && !undyed.purse().equipped.cape && undyed.purse().equipped.tarp === 'tarp-ward',
    'a ward cloth that was never bought is not worn, and the slot is kept');

  const shade = Cosmetics.CATALOG.filter(function (i) { return i.id === 'stand-hearth'; })[0];
  ok(shade && shade.slot === 'stand' && shade.cost === 44 && shade.color === '#1d4ed8' && shade.accent === '#3ec6ff'
    && shade.games[0] === 'Startup Tycoon',
    'hearth shade is a standing-lamp look priced in sparks');
  const standBox = mem();
  standBox.setItem(Persist.PROGRESS_KEY, JSON.stringify({
    v: 1,
    games: {},
    career: { sparks: 12, owned: { 'stand-hearth': 1 }, equipped: { stand: 'stand-hearth' } },
  }));
  const wornShade = Cosmetics.create(Persist.create(standBox), { storage: standBox, achievementIds: function () { return []; } }).look();
  ok(wornShade.stand && wornShade.stand.id === 'stand-hearth' && wornShade.stand.color === '#1d4ed8'
    && wornShade.stand.accent === '#3ec6ff' && !wornShade.skin,
    'an equipped hearth shade survives a read and does not become a banner');
  const bareStand = mem();
  bareStand.setItem(Persist.PROGRESS_KEY, JSON.stringify({
    v: 1,
    games: {},
    career: { sparks: 12, owned: {}, equipped: { stand: 'stand-hearth', cape: 'nope' } },
  }));
  const undressed = Cosmetics.create(Persist.create(bareStand), { storage: bareStand, achievementIds: function () { return []; } });
  ok(!undressed.look().stand && !undressed.purse().equipped.cape && undressed.purse().equipped.stand === 'stand-hearth',
    'a hearth shade that was never bought is not worn, and the slot is kept');

  const ink = Cosmetics.CATALOG.filter(function (i) { return i.id === 'board-ink'; })[0];
  ok(ink && ink.slot === 'board' && ink.cost === 44 && ink.color === '#1b3a8a' && ink.accent === '#ff4fd8'
    && ink.games[0] === 'Startup Tycoon',
    'ink board is a whiteboard look priced in sparks');
  const boardBox = mem();
  boardBox.setItem(Persist.PROGRESS_KEY, JSON.stringify({
    v: 1,
    games: {},
    career: { sparks: 12, owned: { 'board-ink': 1 }, equipped: { board: 'board-ink' } },
  }));
  const wornBoard = Cosmetics.create(Persist.create(boardBox), { storage: boardBox, achievementIds: function () { return []; } }).look();
  ok(wornBoard.board && wornBoard.board.id === 'board-ink' && wornBoard.board.color === '#1b3a8a'
    && wornBoard.board.accent === '#ff4fd8' && !wornBoard.skin,
    'an equipped ink board survives a read and does not become a banner');
  const bareBoard = mem();
  bareBoard.setItem(Persist.PROGRESS_KEY, JSON.stringify({
    v: 1,
    games: {},
    career: { sparks: 12, owned: {}, equipped: { board: 'board-ink', cape: 'nope' } },
  }));
  const wiped = Cosmetics.create(Persist.create(bareBoard), { storage: bareBoard, achievementIds: function () { return []; } });
  ok(!wiped.look().board && !wiped.purse().equipped.cape && wiped.purse().equipped.board === 'board-ink',
    'an ink board that was never bought is not worn, and the slot is kept');
}

{
  const cloth = Cosmetics.CATALOG.filter(function (i) { return i.id === 'kitchen-supper'; })[0];
  ok(cloth && cloth.slot === 'kitchen' && cloth.cost === 44 && cloth.color === '#e23b6a' && cloth.accent === '#3ef0d0'
    && cloth.games[0] === 'Homeless Village',
    'the supper cloth is a soup-kitchen look priced in sparks');
  const box = mem();
  box.setItem(Persist.PROGRESS_KEY, JSON.stringify({
    v: 1,
    games: {},
    career: { sparks: 12, owned: { 'kitchen-supper': 1 }, equipped: { kitchen: 'kitchen-supper' } },
  }));
  const worn = Cosmetics.create(Persist.create(box), { storage: box, achievementIds: function () { return []; } }).look();
  ok(worn.kitchen && worn.kitchen.id === 'kitchen-supper' && worn.kitchen.color === '#e23b6a' && worn.kitchen.accent === '#3ef0d0' && !worn.skin,
    'an equipped supper cloth survives a read and does not become a banner');
  const stripped = mem();
  stripped.setItem(Persist.PROGRESS_KEY, JSON.stringify({
    v: 1,
    games: {},
    career: { sparks: 12, owned: {}, equipped: { kitchen: 'kitchen-supper', cape: 'nope' } },
  }));
  const bare = Cosmetics.create(Persist.create(stripped), { storage: stripped, achievementIds: function () { return []; } });
  ok(!bare.look().kitchen && !bare.purse().equipped.cape && bare.purse().equipped.kitchen === 'kitchen-supper',
    'a supper cloth that was never bought is not worn, and the slot is kept');
}

{
  const lantern = Cosmetics.CATALOG.filter(function (i) { return i.id === 'tent-lantern'; })[0];
  ok(lantern && lantern.slot === 'tent' && lantern.cost === 44 && lantern.color === '#e8a04a'
    && lantern.games.indexOf('Homeless Village') >= 0,
    'the lantern canvas is a Homeless Village shop look priced in sparks');
  const box = mem();
  box.setItem(Persist.PROGRESS_KEY, JSON.stringify({
    v: 1,
    games: {},
    career: {
      sparks: 80,
      owned: { 'tent-lantern': 1700000000000 },
      equipped: { tent: 'tent-lantern', cape: 'nope' },
      xp: 0,
    },
  }));
  const api = Cosmetics.create(Persist.create(box), { storage: box, achievementIds: function () { return []; } });
  const worn = api.look();
  const before = api.purse().sparks;
  ok(worn.tent && worn.tent.id === 'tent-lantern' && worn.tent.accent === '#ffe38a'
    && api.purse().equipped.tent === 'tent-lantern' && !api.purse().equipped.cape,
    'a saved tent canvas survives the purse and a foreign slot does not');
  ok(api.unequip('tent').ok && !api.look().tent && api.purse().sparks === before && api.purse().owned['tent-lantern'],
    'taking the canvas off spends no sparks and keeps the unlock');
}

{
  const lamp = Cosmetics.CATALOG.filter(function (i) { return i.id === 'lamp-founder'; })[0];
  ok(lamp && lamp.slot === 'lamp' && lamp.cost === 44 && lamp.color === '#ffb24a' && lamp.accent === '#ffe7a8'
    && lamp.games[0] === 'Startup Tycoon',
    'the founder lamp is a desk look priced in sparks');
  const lampBox = mem();
  lampBox.setItem(Persist.PROGRESS_KEY, JSON.stringify({
    v: 1,
    games: {},
    career: { sparks: 12, owned: { 'lamp-founder': 1 }, equipped: { lamp: 'lamp-founder' } },
  }));
  const lampWorn = Cosmetics.create(Persist.create(lampBox), { storage: lampBox, achievementIds: function () { return []; } }).look();
  ok(lampWorn.lamp && lampWorn.lamp.id === 'lamp-founder' && lampWorn.lamp.color === '#ffb24a' && lampWorn.lamp.accent === '#ffe7a8' && !lampWorn.skin,
    'an equipped founder lamp survives a read and does not become a banner');
  const lampStripped = mem();
  lampStripped.setItem(Persist.PROGRESS_KEY, JSON.stringify({
    v: 1,
    games: {},
    career: { sparks: 12, owned: {}, equipped: { lamp: 'lamp-founder', cape: 'nope' } },
  }));
  const lampBare = Cosmetics.create(Persist.create(lampStripped), { storage: lampStripped, achievementIds: function () { return []; } });
  ok(!lampBare.look().lamp && !lampBare.purse().equipped.cape && lampBare.purse().equipped.lamp === 'lamp-founder',
    'a lamp that was never bought is not worn, and the slot is kept');
}


{
  const tide = Cosmetics.CATALOG.filter(function (i) { return i.id === 'pendant-tide'; })[0];
  ok(tide && tide.slot === 'pendant' && tide.cost === 44 && tide.color === '#149e86' && tide.accent === '#2ee6c7'
    && tide.games[0] === 'Startup Tycoon',
    'tide glass is a pendant look priced in sparks');
  const tideBox = mem();
  tideBox.setItem(Persist.PROGRESS_KEY, JSON.stringify({
    v: 1,
    games: {},
    career: { sparks: 12, owned: { 'pendant-tide': 1 }, equipped: { pendant: 'pendant-tide' } },
  }));
  const tideWorn = Cosmetics.create(Persist.create(tideBox), { storage: tideBox, achievementIds: function () { return []; } }).look();
  ok(tideWorn.pendant && tideWorn.pendant.id === 'pendant-tide' && tideWorn.pendant.color === '#149e86' && tideWorn.pendant.accent === '#2ee6c7' && !tideWorn.skin,
    'an equipped tide glass survives a read and does not become a banner');
  const tideStripped = mem();
  tideStripped.setItem(Persist.PROGRESS_KEY, JSON.stringify({
    v: 1,
    games: {},
    career: { sparks: 12, owned: {}, equipped: { pendant: 'pendant-tide', cape: 'nope' } },
  }));
  const tideBare = Cosmetics.create(Persist.create(tideStripped), { storage: tideStripped, achievementIds: function () { return []; } });
  ok(!tideBare.look().pendant && !tideBare.purse().equipped.cape && tideBare.purse().equipped.pendant === 'pendant-tide',
    'a tide glass that was never bought is not worn, and the slot is kept');
}


(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const errs = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 240)));
    await page.goto(BASE + '/#trophy', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#view-trophy.active #spark-shop', { timeout: 15000 });
    const fresh = await page.evaluate(() => ({
      balance: document.querySelector('.spark-balance').textContent,
      cards: document.querySelectorAll('.spark-card').length,
      shelves: document.querySelectorAll('.trophy-shelf').length,
    }));
    ok(/✦\s*0/.test(fresh.balance) && fresh.cards === Cosmetics.CATALOG.length && fresh.shelves === 7,
      'the shop lists every cosmetic beside the trophy shelves (' + fresh.cards + ')');

    await page.locator('.spark-card[data-id="trail-cinder"] .spark-preview').click();
    await page.waitForSelector('#spark-reveal', { timeout: 5000 });
    const preview = await page.evaluate(() => ({
      kicker: document.getElementById('spark-reveal-kicker').textContent,
      name: document.getElementById('spark-reveal-name').textContent,
      buy: document.getElementById('spark-reveal-buy').textContent,
      disabled: document.getElementById('spark-reveal-buy').disabled,
      sparks: EurekaCosmetics.purse().sparks,
    }));
    ok(preview.kicker === 'Preview' && preview.name === 'Cinder Trail' && preview.disabled && preview.sparks === 0,
      'preview shows the trail and will not sell it for free');
    await page.locator('#spark-reveal-close').click();
    await page.waitForSelector('#spark-reveal', { state: 'detached', timeout: 5000 });

    const earned = await page.evaluate(() => {
      EurekaProgress.setName('Ada');
      EurekaProgress.emit('tycoon', 'visit', 1);
      EurekaProgress.emit('hearthvale', 'found', 1);
      return EurekaCosmetics.purse().sparks;
    });
    ok(earned >= trailCost, 'signing, a visit, and a valley earn enough for a trail (' + earned + ')');
    await page.waitForFunction((cost) => {
      const n = (document.querySelector('.spark-balance') || {}).textContent || '';
      return n.indexOf(String(cost)) === -1 && /✦\s*[1-9]/.test(n);
    }, trailCost);

    await page.locator('.spark-card[data-id="trail-cinder"] .spark-buy').click();
    await page.waitForSelector('#spark-reveal.is-reveal', { timeout: 5000 });
    const reveal = await page.evaluate(() => ({
      kicker: document.getElementById('spark-reveal-kicker').textContent,
      trail: EurekaCosmetics.look().trail && EurekaCosmetics.look().trail.id,
      sparks: EurekaCosmetics.purse().sparks,
    }));
    ok(reveal.kicker === 'Unlocked' && reveal.trail === 'trail-cinder' && reveal.sparks === earned - trailCost,
      'buying plays the unlock and equips the trail');
    await page.locator('#spark-reveal-close').click();

    const saved = await ctx.storageState();
    await ctx.close();

    const again = await browser.newContext({ viewport: { width: 1280, height: 800 }, storageState: saved });
    const page2 = await again.newPage();
    page2.on('pageerror', (e) => errs.push(String(e).slice(0, 240)));
    await page2.goto(BASE + '/#trophy', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page2.waitForSelector('.spark-card[data-id="trail-cinder"].is-on', { timeout: 15000 });
    const kept = await page2.evaluate(() => EurekaCosmetics.look().trail && EurekaCosmetics.look().trail.id);
    ok(kept === 'trail-cinder', 'reloading the hub keeps the equipped trail');
    await again.close();

    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, storageState: saved });
    const pp = await phone.newPage();
    pp.on('pageerror', (e) => errs.push(String(e).slice(0, 240)));
    await pp.goto(BASE + '/#trophy', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await pp.waitForSelector('#spark-shop .spark-buy', { timeout: 15000 });
    const fit = await pp.evaluate(() => {
      const preview = document.querySelector('.spark-preview');
      const buy = document.querySelector('.spark-buy');
      const filter = document.querySelector('.spark-filter');
      return {
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        preview: preview.getBoundingClientRect().height,
        buy: buy.getBoundingClientRect().height,
        filter: filter.getBoundingClientRect().height,
        font: parseFloat(getComputedStyle(buy).fontSize),
      };
    });
    ok(!fit.overflow && fit.preview >= 44 && fit.buy >= 44 && fit.filter >= 44 && fit.font >= 16,
      `phone shop fits (${Math.round(fit.buy)}px buttons, ${fit.font}px type, overflow ${fit.overflow})`);
    await phone.close();

    const game = await browser.newContext({ viewport: { width: 1280, height: 800 }, storageState: saved });
    const hv = await game.newPage();
    hv.on('pageerror', (e) => errs.push(String(e).slice(0, 240)));
    await hv.goto(BASE + '/hearthvale.html', { waitUntil: 'load', timeout: 30000 });
    const hvLook = await hv.evaluate(() => ({
      trail: EurekaCosmetics.look().trail && EurekaCosmetics.look().trail.id,
      painter: true,
    }));
    ok(hvLook.trail === 'trail-cinder', 'Hearthvale reads the equipped trail');
    await hv.locator('#welcome-close').click({ timeout: 15000 });
    await hv.waitForTimeout(600);
    const hvPaint = await hv.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return 0;
      const ctx = canvas.getContext('2d');
      if (!ctx) return 0;
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let lit = 0;
      for (let i = 0; i < data.length; i += 16) {
        if (data[i] > 180 && data[i + 1] > 120 && data[i + 2] < 80) lit++;
      }
      return lit;
    });
    ok(hvPaint > 0, 'Hearthvale paints the cinder trail on the valley (' + hvPaint + ' warm pixels)');

    const aow = await game.newPage();
    aow.on('pageerror', (e) => errs.push(String(e).slice(0, 240)));
    await aow.goto(BASE + '/ageofwar/', { waitUntil: 'load', timeout: 30000 });
    const aowLook = await aow.evaluate(() => EurekaCosmetics.look().trail && EurekaCosmetics.look().trail.id);
    ok(aowLook === 'trail-cinder', 'Age of War reads the equipped trail');
    const started = await aow.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const go = buttons.find((b) => /play|start|begin|march/i.test(b.textContent || ''));
      if (go) go.click();
      return true;
    });
    ok(started, 'Age of War welcome can be dismissed');
    await aow.waitForTimeout(800);
    const recruit = aow.locator('button', { hasText: /Club|Slinger|Warrior|Recruit/i }).first();
    if (await recruit.count()) {
      try { await recruit.click({ timeout: 4000 }); } catch (e) { /* the field may already be marching */ }
    }
    await aow.waitForTimeout(1200);
    const aowPaint = await aow.evaluate(() => {
      const canvas = document.querySelector('#game') || document.querySelector('canvas');
      if (!canvas) return 0;
      const ctx = canvas.getContext('2d');
      if (!ctx) return 0;
      const w = canvas.width, h = canvas.height;
      const data = ctx.getImageData(0, 0, w, h).data;
      let lit = 0;
      for (let i = 0; i < data.length; i += 24) {
        if (data[i] > 200 && data[i + 1] > 120 && data[i + 2] < 90) lit++;
      }
      return lit;
    });
    ok(aowPaint > 0, 'Age of War paints the cinder trail on friendly units (' + aowPaint + ' warm pixels)');
    await game.close();
  } catch (e) {
    ok(false, 'browser shop: ' + String(e && e.message || e).split('\n')[0]);
  } finally {
    await browser.close();
  }
  ok(errs.length === 0, `no page errors${errs.length ? ' — ' + errs[0] : ''}`);
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
