// Beagle Sim only. Loaded by play.html when ?theme=beagle.
// The yard is a second game layered on the office: dig for bones,
// spend them on the pack, and watch the beagles actually speed up.

export const YARD_KEY = 'beagle:yard';

const RANKS = [
  { at: 0, name: 'Pup', perk: 'Dig the yard. Bones buy speed.' },
  { at: 12, name: 'Scout', perk: 'The dog park opens. Combos of ×3 find an extra bone.' },
  { at: 30, name: 'Good Boy', perk: 'Howls come back 8s sooner.' },
  { at: 60, name: 'Yard Boss', perk: 'Office bones pay double.' },
  { at: 100, name: 'Best in Show', perk: 'Dirt refills 20% faster.' },
  { at: 160, name: 'Legend', perk: '+5% pack speed and longer zoomies.' },
];

const SHOP = [
  { id: 'bowl', icon: '🥣', name: 'Water Bowls', max: 5, costs: [8, 14, 22, 34, 48], blurb: '+3% pack speed each' },
  { id: 'bed', icon: '🛏️', name: 'Orthopedic Beds', max: 3, costs: [12, 26, 44], blurb: '+4% pack speed each' },
  { id: 'agility', icon: '➰', name: 'Agility Weave', max: 3, costs: [10, 20, 36], blurb: 'Zoomies last longer and hit harder' },
  { id: 'squeaker', icon: '🧸', name: 'Squeaker Bin', max: 3, costs: [6, 14, 24], blurb: 'Dirt piles refill faster' },
  { id: 'ribbon', icon: '🎀', name: 'Show Ribbon', max: 1, costs: [28], blurb: 'Combo window widens and caps at ×6' },
  { id: 'trophy', icon: '🏆', name: 'Trophy Case', max: 1, costs: [55], blurb: 'Golden bones show up more and pay $90' },
];

const NAMES = ['Biscuit', 'Maple', 'Noodle', 'Pickle', 'Waffles', 'Moose', 'Penny', 'Cowboy', 'Dumpling', 'Beans', 'Mochi', 'Peanut', 'Hank', 'Olive', 'Cheddar', 'Pudding'];
const PARK_AT = 12;
const STRAY = { name: 'Scout', stray: true, style: 'fetch', coat: 1 };

const SPOTS = [
  { x: 4.8, z: 4.4 },
  { x: -5.2, z: 4.6 },
  { x: 6.1, z: -5.5 },
  { x: -6.1, z: -5.3 },
  { x: 1.6, z: 6.1 },
  { x: -3.6, z: 5.9 },
];

const COATS = [
  { body: 0x8d5a32, ear: 0x6e4124, saddle: 0x1c140f },
  { body: 0xc4a36a, ear: 0xa68448, saddle: null },
  { body: 0x6b4630, ear: 0x4a2e1c, saddle: 0x140e0c },
  { body: 0x9a6238, ear: 0x7a4a28, saddle: 0x221812 },
];

export function buildBeagle(THREE, opts) {
  const g = new THREE.Group();
  g.name = 'beagle';
  const coat = COATS[(opts.coat == null ? Math.floor(Math.random() * COATS.length) : opts.coat) % COATS.length];
  const bodyMat = new THREE.MeshLambertMaterial({ color: coat.body });
  const earMat = new THREE.MeshLambertMaterial({ color: coat.ear });
  const white = new THREE.MeshLambertMaterial({ color: 0xf4efe6 });
  const black = new THREE.MeshLambertMaterial({ color: coat.saddle == null ? 0x2a2118 : coat.saddle });
  const noseMat = new THREE.MeshBasicMaterial({ color: 0x1a120e });
  const tongueMat = new THREE.MeshBasicMaterial({ color: 0xd46a7a });

  for (const sx of [-0.12, 0.12]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.28, 3, 6), bodyMat);
    leg.position.set(sx, 0.28, 0.02);
    leg.castShadow = true;
    g.add(leg);
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), bodyMat);
    paw.scale.set(1.1, 0.55, 1.35);
    paw.position.set(sx, 0.06, 0.06);
    g.add(paw);
  }

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.42, 4, 8), bodyMat);
  torso.position.y = 0.92;
  torso.castShadow = true;
  g.add(torso);

  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.12), white);
  chest.position.set(0, 0.9, 0.2);
  g.add(chest);

  if (coat.saddle != null) {
    const saddle = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), black);
    saddle.scale.set(0.9, 0.38, 1.05);
    saddle.position.set(0, 1.18, -0.02);
    g.add(saddle);
  }

  for (const [sx, key] of [[-0.24, 'armL'], [0.24, 'armR']]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx, 1.12, 0.1);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.2, 3, 6), bodyMat);
    arm.position.y = -0.14;
    pivot.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), white);
    hand.position.y = -0.28;
    pivot.add(hand);
    g.add(pivot);
    g.userData[key] = pivot;
  }

  const head = new THREE.Group();
  head.position.y = 1.58;
  head.scale.y = 1.05;
  g.add(head);
  g.userData.head = head;
  g.userData.breathOffset = Math.random() * Math.PI * 2;

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), bodyMat);
  skull.castShadow = true;
  head.add(skull);

  const blaze = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.26), white);
  blaze.position.set(0, 0.2, 0.02);
  head.add(blaze);

  const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.14), white);
  muzzle.position.set(0, -0.06, 0.18);
  head.add(muzzle);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), noseMat);
  nose.scale.set(1.25, 0.75, 0.9);
  nose.position.set(0, -0.02, 0.26);
  head.add(nose);
  const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.06), tongueMat);
  tongue.position.set(0, -0.12, 0.2);
  head.add(tongue);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a120e });
  const shine = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const sx of [-0.08, 0.08]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), eyeMat);
    eye.position.set(sx, 0.04, 0.2);
    head.add(eye);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), shine);
    dot.position.set(sx + 0.012, 0.05, 0.228);
    head.add(dot);
  }

  for (const [sx, key] of [[-1, 'earL'], [1, 'earR']]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.16, 0.12, 0);
    const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.3, 4, 6), earMat);
    ear.position.set(sx * 0.12, -0.06, 0);
    ear.rotation.z = sx * -1.15;
    ear.castShadow = true;
    pivot.add(ear);
    head.add(pivot);
    g.userData[key] = pivot;
  }

  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.95, -0.22);
  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.32, 3, 6), bodyMat);
  tail.position.set(0, 0.12, -0.12);
  tail.rotation.x = 0.8;
  tailPivot.add(tail);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), white);
  tip.position.set(0, 0.26, -0.22);
  tailPivot.add(tip);
  g.add(tailPivot);
  g.userData.tail = tailPivot;

  if (opts.isCollared) {
    const gold = new THREE.MeshBasicMaterial({ color: 0xf5c542 });
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.028, 6, 14), gold);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 1.4;
    g.add(collar);
    const tag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.02), gold);
    tag.position.set(0, 1.3, 0.16);
    g.add(tag);
  }

  if (opts.bodyScale !== false) {
    const h = 0.93 + Math.random() * 0.14;
    const w = 0.95 + Math.random() * 0.1;
    g.scale.set(w, h, w);
  }
  g.userData.species = 'beagle';
  return g;
}

function emptyShop() {
  const shop = {};
  for (const item of SHOP) shop[item.id] = 0;
  return shop;
}

export function create(api) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state = {
    bones: 0,
    lifetime: 0,
    bond: 0,
    bondLevel: 0,
    dug: 0,
    goldens: 0,
    bestCombo: 0,
    worldFinds: 0,
    shop: emptyShop(),
    open: true,
    parkWins: 0,
    patrol: false,
  };
  let dead = false;
  let saveTimer = 0;
  let combo = 0;
  let comboT = 0;
  let zoomiesT = 0;
  let howlT = 0;
  let howlCdT = 0;
  let petCdT = 0;
  let treatCdT = 0;
  let bannerT = 0;
  let bannerText = '';
  let spawnIn = 7;
  let findIn = 16;
  let pawAcc = 0;
  let knownDogs = null;
  let shopOpen = false;
  let shopSig = '';
  let parkOpen = false;
  let parkSig = '';
  let alphaOn = false;
  let alphaGrit = 100;
  let alphaLeft = 0;
  let alphaCd = 0;
  let ballLoose = false;
  let companionIn = 2.4;
  let companionCursor = 0;
  let patrolIn = 18;
  let lastLine = '';
  let lastPal = '';
  const parkLog = [];
  let overlay = null;
  const slots = [];
  const world = [];

  let ctx = null;
  let master = null;

  load();
  injectStyle();
  const root = buildDom();
  const fx = document.createElement('div');
  fx.id = 'bgl-fx';
  document.body.appendChild(fx);
  seedSlots();
  buildMoundButtons();
  spawnMound();
  paint();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveNow();
  });
  window.addEventListener('pagehide', saveNow);
  document.addEventListener('keydown', onKey);

  const debug = {
    ready: true,
    bones: () => state.bones,
    lifetime: () => state.lifetime,
    dug: () => state.dug,
    bond: () => state.bond,
    bondLevel: () => state.bondLevel,
    workMult: () => workMult(),
    rank: () => RANKS[rankIndex(state.lifetime)].name,
    shop: () => Object.assign({}, state.shop),
    zoomies: () => zoomiesT,
    howl: () => howlT,
    dogs() {
      return safeWorkers().filter((w) => w.group && w.group.userData && w.group.userData.species === 'beagle').length;
    },
    park() {
      return {
        unlocked: parkUnlocked(),
        open: parkOpen,
        patrol: state.patrol,
        wins: state.parkWins,
        grit: alphaGrit,
        running: alphaOn,
        lastLine,
        companions: companionRoster().map((c) => ({ name: c.name, stray: c.stray, style: c.style })),
      };
    },
    companionStep() { return companionStep(); },
    routAlpha() { return routAlpha(); },
    grant(n) { gainBones(Math.max(0, Math.floor(Number(n) || 0))); },
    dig(i) { return dig(i); },
    buy(id) { return buy(id); },
    forceBone() {
      const spot = SPOTS.find((_, i) => !world.some((w) => w.spot === i));
      if (!spot) return world.length;
      spawnAt(spot, SPOTS.indexOf(spot));
      return world.length;
    },
  };
  window.__beagle = debug;

  return { tick, workMult, tryCollect, wipe, debug };

  function load() {
    try {
      const raw = localStorage.getItem(YARD_KEY);
      if (!raw) return;
      const p = JSON.parse(raw);
      if (!p || typeof p !== 'object') return;
      const num = (v, min, max) => (Number.isFinite(v) ? Math.max(min, Math.min(max, Math.floor(v))) : null);
      const bones = num(p.bones, 0, 1e7);
      const lifetime = num(p.lifetime, 0, 1e7);
      if (bones != null) state.bones = bones;
      if (lifetime != null) state.lifetime = lifetime;
      const bond = num(p.bond, 0, 100);
      const bondLevel = num(p.bondLevel, 0, 20);
      if (bond != null) state.bond = bond;
      if (bondLevel != null) state.bondLevel = bondLevel;
      const dug = num(p.dug, 0, 1e7);
      const goldens = num(p.goldens, 0, 1e7);
      const best = num(p.bestCombo, 0, 99);
      const finds = num(p.worldFinds, 0, 1e7);
      if (dug != null) state.dug = dug;
      if (goldens != null) state.goldens = goldens;
      if (best != null) state.bestCombo = best;
      if (finds != null) state.worldFinds = finds;
      const wins = num(p.parkWins, 0, 1e7);
      if (wins != null) state.parkWins = wins;
      if (p.patrol === true) state.patrol = true;
      if (p.shop && typeof p.shop === 'object') {
        for (const item of SHOP) {
          const n = num(p.shop[item.id], 0, item.max);
          if (n != null) state.shop[item.id] = n;
        }
      }
      if (typeof p.open === 'boolean') state.open = p.open;
    } catch { /* damaged save: keep the fresh yard */ }
  }

  function payload() {
    return {
      v: 1,
      bones: state.bones,
      lifetime: state.lifetime,
      bond: state.bond,
      bondLevel: state.bondLevel,
      dug: state.dug,
      goldens: state.goldens,
      bestCombo: state.bestCombo,
      worldFinds: state.worldFinds,
      shop: state.shop,
      open: state.open,
      parkWins: state.parkWins,
      patrol: state.patrol,
    };
  }

  function saveSoon() {
    if (dead) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 200);
  }

  function saveNow() {
    if (dead) return;
    try { localStorage.setItem(YARD_KEY, JSON.stringify(payload())); } catch { /* private mode */ }
  }

  function wipe() {
    dead = true;
    clearTimeout(saveTimer);
    try { localStorage.removeItem(YARD_KEY); } catch { /* ignore */ }
  }

  function rankIndex(life) {
    let i = 0;
    for (let k = 0; k < RANKS.length; k++) if (life >= RANKS[k].at) i = k;
    return i;
  }

  function rank() { return RANKS[rankIndex(state.lifetime)]; }

  function nextRank() {
    const i = rankIndex(state.lifetime);
    return RANKS[i + 1] || null;
  }

  function workMult() {
    let m = 1 + 0.03 * state.shop.bowl + 0.04 * state.shop.bed + 0.01 * state.bondLevel;
    if (state.patrol) m += 0.03;
    if (state.lifetime >= 160) m += 0.05;
    if (zoomiesT > 0) m *= 1.35 + 0.08 * state.shop.agility;
    if (howlT > 0) m *= 1.5;
    if (!Number.isFinite(m) || m < 1) return 1;
    return Math.min(3, m);
  }

  function refillTime() {
    const dogs = safeWorkers().length;
    let t = 7.4 - state.shop.squeaker * 1.05 - Math.min(2.1, dogs * 0.32);
    if (state.lifetime >= 100) t *= 0.8;
    return Math.max(2.2, t);
  }

  function comboWindow() { return state.shop.ribbon ? 2.35 : 1.65; }
  function comboCap() { return state.shop.ribbon ? 6 : 5; }
  function howlCooldown() { return rankIndex(state.lifetime) >= 2 ? 28 : 36; }
  function zoomiesLen() {
    return 18 + state.shop.agility * 5 + (state.lifetime >= 160 ? 8 : 0);
  }

  function rollKind() {
    const golden = state.shop.trophy ? 6 : 2.4;
    const bag = [
      ['bone', 48],
      ['bone2', 16],
      ['ball', 12],
      ['treat', 12],
      ['whiff', 9],
      ['golden', golden],
    ];
    let total = 0;
    for (const row of bag) total += row[1];
    let r = Math.random() * total;
    for (const [kind, w] of bag) {
      r -= w;
      if (r <= 0) return kind;
    }
    return 'bone';
  }

  function seedSlots() {
    const first = state.lifetime === 0 && state.dug === 0;
    const ready = first
      ? ['bone', 'ball', 'bone2', 'treat', 'golden']
      : ['bone', rollKind(), rollKind(), rollKind(), rollKind()];
    for (const kind of ready) slots.push({ kind, cd: 0 });
    slots.push({ kind: null, cd: 3.2 });
    slots.push({ kind: null, cd: 5.5 });
    slots.push({ kind: null, cd: 7.2 });
  }

  function safeWorkers() {
    try { return api.getWorkers() || []; } catch { return []; }
  }

  function nameOf(w, i) {
    const g = w && w.group;
    if (!g) return NAMES[i % NAMES.length];
    if (!g.userData.dogName) g.userData.dogName = NAMES[i % NAMES.length];
    return g.userData.dogName;
  }

  function gainBones(n) {
    n = Math.floor(n);
    if (!Number.isFinite(n) || n <= 0) return 0;
    const prev = rankIndex(state.lifetime);
    state.bones += n;
    state.lifetime += n;
    const next = rankIndex(state.lifetime);
    if (next > prev) celebrateRank(next);
    if (prev < 1 && next >= 1) announcePark();
    saveSoon();
    return n;
  }

  function celebrateRank(i) {
    const r = RANKS[i];
    sound('rank');
    shout(r.name.toUpperCase());
    toast(`🏅 Pack rank: ${r.name} — ${r.perk}`, 'milestone', 'critical');
    feed(`🏅 The pack is now ${r.name}. ${r.perk}`);
    burstConfetti(56);
    buzz('milestone');
  }

  function bumpBond(n) {
    state.bond += n;
    let leveled = false;
    while (state.bond >= 100 && state.bondLevel < 20) {
      state.bond -= 100;
      state.bondLevel += 1;
      leveled = true;
    }
    if (state.bondLevel >= 20) state.bond = Math.min(100, state.bond);
    if (leveled) {
      sound('rank');
      toast(`💛 Pack bond ${state.bondLevel} — the kennel works +${state.bondLevel}%`, 'good');
      buzz('milestone');
    }
  }

  function dig(i) {
    const s = slots[i];
    if (!s || s.cd > 0 || !s.kind) return { ok: false };
    const kind = s.kind;
    s.kind = null;
    s.cd = refillTime();
    state.dug += 1;
    const btn = moundButton(i);
    const rect = btn ? btn.getBoundingClientRect() : root.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    burst(x, y, kind === 'golden' ? '#fcd34d' : '#8d5a32');
    buzz('hire');

    if (kind === 'whiff') {
      combo = 0;
      comboT = 0;
      sound('whimper');
      floater('empty', x, y);
      banner('Just dirt', 0.7);
      saveSoon();
      paint();
      return { ok: true, kind, bones: state.bones };
    }

    if (comboT > 0) combo = Math.min(comboCap(), combo + 1);
    else combo = 1;
    comboT = comboWindow();
    if (combo > state.bestCombo) state.bestCombo = combo;

    if (kind === 'ball') {
      startZoomies(8);
      bumpBond(4);
      floater('🎾', x, y);
    } else if (kind === 'treat') {
      const dogs = safeWorkers();
      if (dogs.length) {
        try { api.changeMorale(6, 'A treat in the dirt'); } catch { /* morale off */ }
      }
      bumpBond(6);
      sound('yip');
      floater('🍖', x, y);
      hearts();
    } else {
      let n = kind === 'bone2' ? 2 : kind === 'golden' ? 3 : 1;
      n *= combo;
      if (combo >= 3 && rankIndex(state.lifetime) >= 1) n += 1;
      gainBones(n);
      bumpBond(kind === 'golden' ? 12 : 6);
      floater('+' + n + ' 🦴', x, y);
      if (kind === 'golden') onGolden(n);
      else {
        sound('bone');
        if (combo >= 2) banner('GOOD BOY ×' + combo, 0.9);
      }
    }
    saveSoon();
    paint();
    return { ok: true, kind, bones: state.bones };
  }

  function onGolden(n) {
    state.goldens += 1;
    const cash = state.shop.trophy ? 90 : 45;
    try { api.addCash(cash, 'event'); } catch { /* cash path failed */ }
    sound('howl');
    shout('GOLDEN BONE');
    shake();
    flash();
    banner('GOLDEN BONE +$' + cash, 1.8);
    burstConfetti(70);
    toast(`✨ Golden bone! +${n} 🦴 and $${cash}`, 'milestone', 'critical');
    feed(`✨ Golden bone — +${n} bones and $${cash}`);
    buzz('milestone');
  }

  function startZoomies(seconds) {
    const fresh = zoomiesT <= 0;
    zoomiesT = Math.min(40, zoomiesT + seconds);
    sound('squeak');
    if (fresh) {
      shout('ZOOMIES');
      toast('🎾 Zoomies! The pack digs faster', 'good');
      buzz('sprint');
    }
  }

  function throwBall() {
    if (state.bones < 2) { need(2, 'a tennis ball'); return; }
    state.bones -= 2;
    startZoomies(zoomiesLen());
    bumpBond(4);
    saveSoon();
    paint();
  }

  function giveTreat() {
    if (treatCdT > 0) return;
    const dogs = safeWorkers();
    if (!dogs.length) {
      toast('Adopt a beagle before you open the treat bag', '');
      sound('whimper');
      return;
    }
    if (state.bones < 3) { need(3, 'treats'); return; }
    state.bones -= 3;
    treatCdT = 4;
    try { api.changeMorale(8, 'Treats for the pack'); } catch { /* ignore */ }
    bumpBond(6);
    sound('yip');
    hearts();
    toast('🍖 The pack crunches through a round of treats', 'good');
    saveSoon();
    paint();
  }

  function pet() {
    if (petCdT > 0) return;
    petCdT = 6;
    const dogs = safeWorkers();
    bumpBond(8);
    buzz('purchase');
    if (dogs.length) {
      const name = nameOf(dogs[0], 0);
      try { api.changeMorale(3, name + ' got a belly rub'); } catch { /* ignore */ }
      sound('yip');
      hearts();
      if (Math.random() < 0.25) {
        gainBones(1);
        toast('🦴 A coin under ' + name + "'s collar", 'good');
      } else {
        toast('🐾 ' + name + ' flops over for belly rubs', 'good');
      }
    } else {
      sound('whimper');
      toast('You fluffed an empty bed. Adopt a beagle.', '');
    }
    saveSoon();
    paint();
  }

  function startHowl() {
    if (howlCdT > 0) { toast('The pack is catching its breath', ''); return; }
    if (state.bones < 4) { need(4, 'a howl'); return; }
    state.bones -= 4;
    howlT = 10;
    howlCdT = howlCooldown();
    sound('howl');
    shout('AWOOO');
    shake();
    flash();
    toast('🐺 The pack howls — ×1.5 for 10s', 'milestone');
    buzz('win');
    saveSoon();
    paint();
  }

  function need(n, what) {
    sound('whimper');
    toast('Need ' + n + ' bones for ' + what, '');
  }

  function buy(id) {
    const item = SHOP.find((s) => s.id === id);
    if (!item) return { ok: false };
    const lvl = state.shop[id] || 0;
    if (lvl >= item.max) {
      toast(item.name + ' is fully stocked', '');
      return { ok: false, reason: 'max' };
    }
    const cost = item.costs[lvl];
    if (state.bones < cost) {
      need(cost, item.name);
      return { ok: false, reason: 'bones' };
    }
    state.bones -= cost;
    state.shop[id] = lvl + 1;
    sound('buy');
    buzz('purchase');
    toast(`${item.icon} ${item.name} ${lvl + 1}/${item.max}`, 'good');
    feed(`${item.icon} Kennel shop: ${item.name} upgraded`);
    shopSig = '';
    saveSoon();
    paint();
    return { ok: true };
  }

  function setShop(on) {
    shopOpen = !!on;
    const shop = document.getElementById('bgl-shop');
    const mounds = document.getElementById('bgl-mounds');
    if (shop) shop.hidden = !shopOpen;
    if (mounds) mounds.hidden = shopOpen;
    shopSig = '';
    paint();
  }

  function setOpen(on) {
    state.open = !!on;
    root.classList.toggle('is-open', state.open);
    const toggle = document.getElementById('bgl-toggle');
    if (toggle) toggle.setAttribute('aria-expanded', state.open ? 'true' : 'false');
    const chev = document.getElementById('bgl-chev');
    if (chev) chev.textContent = state.open ? '▾' : '▸';
    saveSoon();
  }

  function tick(dt) {
    if (dead) return;
    if (!Number.isFinite(dt) || dt < 0) return;
    for (const s of slots) {
      if (s.cd > 0) {
        s.cd -= dt;
        if (s.cd <= 0) {
          s.cd = 0;
          s.kind = rollKind();
        }
      }
    }
    if (zoomiesT > 0) {
      zoomiesT -= dt;
      if (zoomiesT <= 0) { zoomiesT = 0; sound('done'); }
    }
    if (howlT > 0) {
      howlT -= dt;
      if (howlT <= 0) { howlT = 0; sound('done'); }
    }
    if (howlCdT > 0) howlCdT = Math.max(0, howlCdT - dt);
    if (petCdT > 0) petCdT = Math.max(0, petCdT - dt);
    if (treatCdT > 0) treatCdT = Math.max(0, treatCdT - dt);
    if (comboT > 0) {
      comboT -= dt;
      if (comboT <= 0) { comboT = 0; combo = 0; }
    }
    if (bannerT > 0) bannerT = Math.max(0, bannerT - dt);

    spawnIn -= dt;
    if (spawnIn <= 0) {
      spawnIn = 11;
      if (world.length < 3) spawnMound();
    }
    findIn -= dt;
    if (findIn <= 0) {
      findIn = 22;
      const dogs = safeWorkers();
      if (dogs.length) {
        const idx = Math.floor(Math.random() * dogs.length);
        const name = nameOf(dogs[idx], idx);
        gainBones(1);
        bumpBond(2);
        toast('🦴 ' + name + ' nosed a bone out of the couch', 'good');
        feed('🦴 ' + name + ' found a bone');
        sound('yip');
      }
    }

    const player = safePlayer();
    if (player) {
      for (const rec of world.slice()) {
        if (Math.hypot(player.x - rec.x, player.z - rec.z) < 1.35) collect(rec);
      }
    }

    const t = performance.now() / 1000;
    const fast = zoomiesT > 0 || howlT > 0;
    for (const w of safeWorkers()) {
      const g = w.group;
      if (!g || !g.userData) continue;
      const tail = g.userData.tail;
      if (tail) {
        const spd = fast ? 16 : 6.5;
        const amp = fast ? 0.75 : 0.38;
        tail.rotation.y = Math.sin(t * spd + (g.userData.breathOffset || 0)) * amp;
      }
      const earL = g.userData.earL;
      const earR = g.userData.earR;
      if (earL && earR) {
        const flop = Math.sin(t * (fast ? 9 : 2.4) + (g.userData.breathOffset || 0)) * (fast ? 0.22 : 0.07);
        earL.rotation.z = flop;
        earR.rotation.z = -flop;
      }
    }

    for (const rec of world) {
      rec.mesh.position.y = Math.sin(t * 3 + rec.x) * 0.07;
      rec.mesh.rotation.y += dt * 0.7;
      placeTag(rec);
    }

    noteRoster();
    pawAcc += dt;
    if (zoomiesT > 0 && pawAcc > 0.32) {
      pawAcc = 0;
      dropPaw();
    }
    tickPark(dt);
    root.classList.toggle('zoomies', zoomiesT > 0);
    root.classList.toggle('howling', howlT > 0);
    root.dataset.rank = String(rankIndex(state.lifetime));
    paintMounds();
    paint();
  }

  function tryCollect(raycaster) {
    if (!world.length || !raycaster) return false;
    let hits = [];
    try { hits = raycaster.intersectObjects(world.map((w) => w.mesh), true); } catch { return false; }
    if (!hits.length) return false;
    let obj = hits[0].object;
    while (obj && !(obj.userData && obj.userData.bglMound)) obj = obj.parent;
    const rec = obj && world.find((w) => w.mesh === obj);
    if (!rec) return false;
    collect(rec);
    return true;
  }

  function noteRoster() {
    const dogs = safeWorkers();
    if (knownDogs == null) { knownDogs = dogs.length; return; }
    if (dogs.length > knownDogs) {
      const w = dogs[dogs.length - 1];
      const name = nameOf(w, dogs.length - 1);
      sound('bark');
      toast('🐶 ' + name + ' joins the pack', 'milestone');
    }
    knownDogs = dogs.length;
  }

  function safePlayer() {
    try { return api.getPlayer(); } catch { return null; }
  }

  function spawnMound() {
    const free = SPOTS.findIndex((_, i) => !world.some((w) => w.spot === i));
    if (free < 0 || world.length >= 3) return false;
    spawnAt(SPOTS[free], free);
    return true;
  }

  function spawnAt(spot, index) {
    const THREE = api.THREE;
    const mesh = new THREE.Group();
    mesh.userData.bglMound = true;
    const dirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.46, 0.62, 0.16, 8),
      new THREE.MeshLambertMaterial({ color: 0x6b4428 }),
    );
    dirt.position.y = 0.08;
    mesh.add(dirt);
    const boneMat = new THREE.MeshBasicMaterial({ color: 0xfff6e4 });
    for (const z of [0.7, -0.7]) {
      const bone = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.26, 3, 6), boneMat);
      bone.position.y = 0.32;
      bone.rotation.z = z;
      mesh.add(bone);
    }
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.58, 0.04, 6, 18),
      new THREE.MeshBasicMaterial({ color: 0xf5b042 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.045;
    mesh.add(ring);
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 8, 6),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    hit.position.y = 0.3;
    mesh.add(hit);
    mesh.position.set(spot.x, 0, spot.z);
    api.scene.add(mesh);
    const tag = document.createElement('div');
    tag.className = 'bgl-bone-tag';
    tag.textContent = '🦴';
    fx.appendChild(tag);
    const rec = { mesh, tag, x: spot.x, z: spot.z, spot: index };
    world.push(rec);
    placeTag(rec);
  }

  function placeTag(rec) {
    let p = null;
    try { p = api.worldToScreen(rec.x, 0.9, rec.z); } catch { p = null; }
    if (!p || p.x < 28 || p.y < 28 || p.x > window.innerWidth - 28 || p.y > window.innerHeight - 28) {
      rec.tag.style.display = 'none';
      return;
    }
    rec.tag.style.display = 'block';
    rec.tag.style.left = p.x + 'px';
    rec.tag.style.top = p.y + 'px';
  }

  function collect(rec) {
    const i = world.indexOf(rec);
    if (i < 0) return;
    world.splice(i, 1);
    api.scene.remove(rec.mesh);
    const geos = new Set();
    const mats = new Set();
    rec.mesh.traverse((o) => {
      if (o.geometry && !geos.has(o.geometry)) { geos.add(o.geometry); o.geometry.dispose(); }
      if (o.material && !mats.has(o.material)) { mats.add(o.material); o.material.dispose(); }
    });
    rec.tag.remove();
    const n = rankIndex(state.lifetime) >= 3 ? 2 : 1;
    gainBones(n);
    bumpBond(5);
    state.worldFinds += 1;
    let p = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    try {
      const q = api.worldToScreen(rec.x, 0.9, rec.z);
      if (q && q.x > 0) p = q;
    } catch { /* keep center */ }
    floater('+' + n + ' 🦴', p.x, p.y);
    burst(p.x, p.y, '#fff6e4');
    sound('bone');
    buzz('hire');
    if (state.worldFinds === 1) toast('🦴 Bones glow in the office — walk over them or tap', 'good');
    saveSoon();
    paint();
  }

  function onKey(e) {
    if (dead || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const ae = document.activeElement;
    if (ae && (/^(input|textarea|select)$/i.test(ae.tagName) || ae.isContentEditable)) return;
    if (parkOpen) {
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') closePark();
      return;
    }
    if (document.querySelector('#welcome-modal.open, #win-modal.open, #tip-modal.open, #help-modal.open, #ipo-modal.open, #theme-modal.open, #dash-modal.open, #achievements-modal.open, #founder-modal.open, #board-modal.open, #wall-modal.open, #elevator-modal.open, #offline-modal.open')) return;
    const k = e.key;
    if (k === '1') { const i = slots.findIndex((s) => s.cd <= 0 && s.kind); if (i >= 0) dig(i); }
    else if (k === '2') throwBall();
    else if (k === '3') giveTreat();
    else if (k === '4') pet();
    else if (k === '5') startHowl();
    else if (k === 'p' || k === 'P') openPark();
  }

  function moundButton(i) {
    const box = document.getElementById('bgl-mounds');
    return box ? box.children[i] : null;
  }

  function buildMoundButtons() {
    const box = document.getElementById('bgl-mounds');
    box.innerHTML = '';
    slots.forEach((_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bgl-mound';
      b.addEventListener('click', () => dig(i));
      box.appendChild(b);
    });
  }

  function paintMounds() {
    slots.forEach((s, i) => {
      const btn = moundButton(i);
      if (!btn) return;
      const sec = s.cd > 0 ? Math.ceil(s.cd) : 0;
      const sig = (s.kind || '') + ':' + sec;
      if (btn.dataset.sig === sig) return;
      btn.dataset.sig = sig;
      btn.className = 'bgl-mound' + (sec ? ' hole' : ' ready') + (s.kind === 'golden' && !sec ? ' glint' : '');
      btn.disabled = sec > 0;
      btn.textContent = sec ? sec + 's' : '🟤';
      btn.setAttribute('aria-label', sec ? 'Refilling, ' + sec + ' seconds' : 'Dig this dirt pile');
    });
  }

  function paint() {
    const ri = rankIndex(state.lifetime);
    const nxt = nextRank();
    setText('bgl-rank', RANKS[ri].name);
    setText('bgl-next', nxt ? nxt.name + ' at ' + nxt.at : 'Top of the yard');
    setText('bgl-bones', state.bones + ' 🦴');
    const mult = workMult();
    setText('bgl-mult', '×' + mult.toFixed(2));
    const multEl = document.getElementById('bgl-mult');
    if (multEl) multEl.classList.toggle('hot', mult > 1.01);
    setText('bgl-perk', RANKS[ri].perk);
    const fill = document.getElementById('bgl-bond-fill');
    if (fill) fill.style.width = Math.max(0, Math.min(100, state.bond)) + '%';
    const bond = document.getElementById('bgl-bond');
    if (bond) bond.title = 'Pack bond ' + state.bondLevel + ' · ' + state.bond + '/100 · +' + state.bondLevel + '% speed';

    const ball = document.getElementById('bgl-act-ball');
    const treat = document.getElementById('bgl-act-treat');
    const petBtn = document.getElementById('bgl-act-pet');
    const howl = document.getElementById('bgl-act-howl');
    const shopBtn = document.getElementById('bgl-act-shop');
    labelAct(ball, '🎾', zoomiesT > 0 ? Math.ceil(zoomiesT) + 's' : '2🦴', state.bones < 2 && zoomiesT <= 0);
    labelAct(treat, '🍖', treatCdT > 0 ? Math.ceil(treatCdT) + 's' : '3🦴', state.bones < 3 || treatCdT > 0);
    labelAct(petBtn, '🐾', petCdT > 0 ? Math.ceil(petCdT) + 's' : 'Pet', petCdT > 0);
    labelAct(howl, '🐺', howlT > 0 ? Math.ceil(howlT) + 's' : (howlCdT > 0 ? Math.ceil(howlCdT) + 's' : '4🦴'), state.bones < 4 || howlCdT > 0);
    labelAct(shopBtn, shopOpen ? '←' : '🏪', shopOpen ? 'Dig' : 'Shop', false);
    paintParkButton();
    if (ball) ball.classList.toggle('on', zoomiesT > 0);
    if (howl) howl.classList.toggle('on', howlT > 0);

    const bits = [];
    if (zoomiesT > 0) bits.push('Zoomies ' + Math.ceil(zoomiesT) + 's');
    if (howlT > 0) bits.push('Howl ' + Math.ceil(howlT) + 's');
    else if (howlCdT > 0) bits.push('Howl in ' + Math.ceil(howlCdT) + 's');
    if (combo >= 2) bits.push('Combo ×' + combo);
    bits.push('Dug ' + state.dug);
    if (state.goldens) bits.push('Gold ' + state.goldens);
    setText('bgl-status', bits.join(' · '));
    paintBanner();
    paintShop();
    paintMounds();
  }

  function paintBanner() {
    const el = document.getElementById('bgl-banner');
    if (!el) return;
    let text = '';
    if (bannerT > 0) text = bannerText;
    else if (combo >= 2) text = 'GOOD BOY ×' + combo;
    else if (state.dug === 0) text = 'Tap a dirt pile';
    el.hidden = !text;
    if (el.textContent !== text) el.textContent = text;
  }

  function paintShop() {
    if (!shopOpen) return;
    const sig = SHOP.map((s) => (state.shop[s.id] || 0) + ':' + afford(s)).join('|')
      + '|' + state.bones + '|' + state.dug + '|' + state.bestCombo + '|' + state.goldens;
    if (sig === shopSig) return;
    const list = document.getElementById('bgl-shop-list');
    if (!list) return;
    list.innerHTML = '';
    for (const item of SHOP) {
      const lvl = state.shop[item.id] || 0;
      const maxed = lvl >= item.max;
      const cost = maxed ? null : item.costs[lvl];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bgl-buy';
      btn.dataset.buy = item.id;
      btn.disabled = false;
      const poor = !maxed && state.bones < cost;
      if (poor) btn.classList.add('poor');
      btn.innerHTML = '<span class="bgl-buy-name">' + item.icon + ' ' + item.name
        + ' <small>' + lvl + '/' + item.max + '</small></span><span class="bgl-buy-cost">'
        + (maxed ? 'MAX' : cost + ' 🦴') + '</span>';
      btn.title = item.blurb;
      btn.addEventListener('click', () => buy(item.id));
      list.appendChild(btn);
    }
    setText('bgl-shop-stats', 'Lifetime ' + state.lifetime + ' bones · best combo ×' + state.bestCombo
      + ' · ' + state.goldens + ' golden');
    shopSig = sig;
  }

  function afford(item) {
    const lvl = state.shop[item.id] || 0;
    if (lvl >= item.max) return 'max';
    return state.bones >= item.costs[lvl] ? 'yes' : 'no';
  }

  function labelAct(el, icon, sub, poor) {
    if (!el) return;
    const want = icon + '\n' + sub;
    if (el.dataset.sig !== want) {
      el.dataset.sig = want;
      el.innerHTML = '<span class="bgl-ico">' + icon + '</span><span class="bgl-sub">' + sub + '</span>';
    }
    el.classList.toggle('poor', !!poor);
    el.setAttribute('aria-disabled', poor ? 'true' : 'false');
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el && el.textContent !== text) el.textContent = text;
  }

  function banner(text, sec) {
    bannerText = text;
    bannerT = sec;
  }

  function buildDom() {
    const el = document.createElement('section');
    el.id = 'bgl-yard';
    el.className = state.open ? 'is-open' : '';
    el.dataset.rank = String(rankIndex(state.lifetime));
    el.setAttribute('aria-label', 'Beagle yard');
    el.innerHTML = [
      '<div id="bgl-head">',
      '<button id="bgl-toggle" type="button" aria-expanded="' + (state.open ? 'true' : 'false') + '" aria-controls="bgl-body">',
      '<span class="bgl-pup" aria-hidden="true"><i class="ear l"></i><i class="ear r"></i><i class="face"></i><i class="eye l"></i><i class="eye r"></i><i class="nose"></i></span>',
      '<span class="bgl-toggle-copy"><strong id="bgl-rank">Pup</strong><span id="bgl-next"></span></span>',
      '<span id="bgl-bones">0 🦴</span><span id="bgl-mult">×1.00</span><span id="bgl-chev" aria-hidden="true">' + (state.open ? '▾' : '▸') + '</span>',
      '</button>',
      '<button type="button" id="bgl-park">🌳<span class="bgl-sub">Park</span></button>',
      '</div>',
      '<div id="bgl-body">',
      '<div id="bgl-bond" title="Pack bond"><i id="bgl-bond-fill"></i></div>',
      '<div id="bgl-perk"></div>',
      '<div id="bgl-banner" role="status"></div>',
      '<div id="bgl-mounds"></div>',
      '<div id="bgl-actions">',
      '<button type="button" id="bgl-act-ball" class="bgl-act" title="Throw a tennis ball. 2 bones."></button>',
      '<button type="button" id="bgl-act-treat" class="bgl-act" title="Treat the pack. 3 bones."></button>',
      '<button type="button" id="bgl-act-pet" class="bgl-act" title="Belly rubs. Free."></button>',
      '<button type="button" id="bgl-act-howl" class="bgl-act" title="Howl for ×1.5 speed. 4 bones."></button>',
      '<button type="button" id="bgl-act-shop" class="bgl-act" title="Spend bones on the kennel."></button>',
      '</div>',
      '<div id="bgl-shop" hidden><div id="bgl-shop-list"></div><p id="bgl-shop-stats"></p></div>',
      '<div id="bgl-status"></div>',
      '<div class="bgl-keys">1 dig · 2 ball · 3 treat · 4 pet · 5 howl · P park</div>',
      '</div>',
    ].join('');
    document.body.appendChild(el);
    el.querySelector('#bgl-toggle').addEventListener('click', () => setOpen(!state.open));
    el.querySelector('#bgl-act-ball').addEventListener('click', throwBall);
    el.querySelector('#bgl-act-treat').addEventListener('click', giveTreat);
    el.querySelector('#bgl-act-pet').addEventListener('click', pet);
    el.querySelector('#bgl-act-howl').addEventListener('click', startHowl);
    el.querySelector('#bgl-act-shop').addEventListener('click', () => setShop(!shopOpen));
    el.querySelector('#bgl-park').addEventListener('click', () => { if (parkOpen) closePark(); else openPark(); });
    overlay = buildParkOverlay();
    return el;
  }

  function parkUnlocked() { return state.lifetime >= PARK_AT; }

  function announcePark() {
    shout('DOG PARK');
    toast('🌳 Scout rank opens the dog park. Duke the Alpha has the hill.', 'milestone', 'critical');
    feed('🌳 The pack may enter the dog park.');
    banner('DOG PARK OPEN', 1.8);
    buzz('milestone');
  }

  function companionRoster() {
    const dogs = safeWorkers();
    if (!dogs.length) return [STRAY];
    return dogs.slice(0, 3).map((w, i) => ({
      name: nameOf(w, i),
      stray: false,
      style: ['fetch', 'dig', 'bark'][i % 3],
      coat: i % 4,
    }));
  }

  function decideAct(c) {
    if (ballLoose && c.style !== 'dig') {
      ballLoose = false;
      return { grit: 11, line: c.name + ' snags the loose ball and bowls Duke over' };
    }
    if (c.style === 'dig' && alphaGrit < 75) {
      return { grit: 8, bones: 1, line: c.name + ' rips up a toy Duke had buried' };
    }
    if (c.style === 'bark' || alphaGrit > 60) {
      return { grit: 6, line: c.name + ' plants both paws and howls in Duke\'s face' };
    }
    return { grit: 7, line: c.name + ' circles in and nips Duke\'s bandana' };
  }

  function pushLog(line) {
    lastLine = line;
    parkLog.unshift(line);
    if (parkLog.length > 4) parkLog.pop();
  }

  function applyHit(n, line) {
    if (!alphaOn) return;
    alphaGrit = Math.max(0, alphaGrit - Math.max(0, Math.floor(n) || 0));
    if (line) pushLog(line);
    const duke = document.getElementById('bgl-duke');
    if (duke && !reduced) {
      duke.classList.remove('hit');
      void duke.offsetWidth;
      duke.classList.add('hit');
    }
    if (alphaGrit <= 0) endAlpha(true);
    else paintPark();
  }

  function companionStep() {
    if (!alphaOn) return null;
    const roster = companionRoster();
    const c = roster[companionCursor % roster.length];
    companionCursor += 1;
    lastPal = c.name;
    const act = decideAct(c);
    if (act.bones) gainBones(act.bones);
    const line = (c.stray ? 'Stray ' : '') + act.line;
    applyHit(act.grit, line);
    sound(c.style === 'bark' ? 'bark' : c.style === 'dig' ? 'bone' : 'yip');
    return { name: c.name, line, grit: alphaGrit, stray: c.stray };
  }

  function tickPark(dt) {
    if (alphaCd > 0) alphaCd = Math.max(0, alphaCd - dt);
    if (alphaOn && parkOpen) {
      alphaLeft -= dt;
      companionIn -= dt;
      if (companionIn <= 0 && alphaOn) {
        companionIn = 2.6;
        companionStep();
      }
      if (alphaOn && alphaLeft <= 0) endAlpha(false);
      else if (parkOpen) paintPark();
    }
    if (state.patrol && !alphaOn) {
      patrolIn -= dt;
      if (patrolIn <= 0) {
        patrolIn = 18;
        const pal = companionRoster()[0];
        gainBones(1);
        bumpBond(1);
        toast('🦴 ' + pal.name + ' patrols a bone back from the park', 'good');
        sound('yip');
      }
    }
  }

  function startAlpha() {
    if (!parkUnlocked()) return { ok: false, reason: 'locked' };
    if (alphaCd > 0 || alphaOn) return { ok: false, reason: alphaOn ? 'busy' : 'cd' };
    alphaOn = true;
    alphaGrit = 100;
    alphaLeft = 42;
    ballLoose = false;
    companionIn = 1.8;
    companionCursor = 0;
    parkSig = '';
    const lead = companionRoster()[0];
    pushLog(lead.stray
      ? 'Scout the stray slips under the fence to help'
      : lead.name + ' takes the flank. The pack is with you');
    sound('bark');
    shout('DUKE');
    paintPark();
    return { ok: true };
  }

  function endAlpha(won) {
    alphaOn = false;
    ballLoose = false;
    parkSig = '';
    if (won) {
      const first = !state.patrol;
      state.parkWins += 1;
      state.patrol = true;
      alphaCd = 12;
      gainBones(first ? 24 : 12);
      try { api.addCash(first ? 80 : 40, 'event'); } catch { /* cash path failed */ }
      sound('rank');
      shout(first ? 'PARK PATROL' : 'DUKE YIELDS');
      burstConfetti(first ? 80 : 48);
      toast(first
        ? '👑 Duke yields the hill. Pack Patrol unlocked — companions fetch bones home, +3% speed'
        : '👑 Duke yields again. The pack keeps the hill', 'milestone', 'critical');
      feed(first
        ? '👑 Duke the Alpha is beaten. Pack Patrol begins.'
        : '👑 The pack chases Duke off the hill again.');
      pushLog(first
        ? 'Duke drops the hill. Your companions start patrolling.'
        : 'Duke slinks off. The patrol keeps its route.');
      buzz('win');
    } else {
      const lost = Math.min(4, state.bones);
      state.bones -= lost;
      alphaCd = 16;
      sound('whimper');
      shout('DUKE HOLDS');
      toast('Duke keeps the hill and noses off ' + lost + ' bones', '');
      pushLog('Duke plants his paws. The pack needs another go.');
      saveSoon();
      buzz('purchase');
    }
    paintPark();
    paint();
  }

  function routAlpha() {
    if (!parkUnlocked()) return parkView();
    if (!parkOpen) openPark();
    if (!alphaOn) startAlpha();
    applyHit(999, 'The pack buries Duke under a pile of paws');
    return parkView();
  }

  function parkView() {
    return {
      unlocked: parkUnlocked(),
      open: parkOpen,
      patrol: state.patrol,
      wins: state.parkWins,
      grit: alphaGrit,
      running: alphaOn,
      lastLine,
    };
  }

  function parkThrow() {
    if (!alphaOn) return;
    ballLoose = true;
    sound('squeak');
    applyHit(9, 'You whip a tennis ball past Duke\'s nose');
  }

  function parkDig() {
    if (!alphaOn) return;
    sound('bone');
    gainBones(1);
    applyHit(7, 'You kick up the bone Duke was sitting on');
  }

  function parkHowl() {
    if (!alphaOn) return;
    sound('howl');
    shout('AWOOO');
    applyHit(14, 'The whole hill answers your howl');
  }

  function callPack() {
    if (!alphaOn) return;
    const count = companionRoster().length;
    for (let i = 0; i < count && alphaOn; i++) companionStep();
  }

  function openPark() {
    if (!parkUnlocked()) {
      sound('whimper');
      toast('The dog park opens at Scout — dig up 12 bones', '');
      return false;
    }
    parkOpen = true;
    parkSig = '';
    if (overlay) overlay.hidden = false;
    paintPark();
    return true;
  }

  function closePark() {
    parkOpen = false;
    parkSig = '';
    if (overlay) overlay.hidden = true;
    paintParkButton();
  }

  function paintParkButton() {
    const btn = document.getElementById('bgl-park');
    if (!btn) return;
    const on = parkUnlocked();
    const label = !on ? '12🦴' : state.patrol ? 'Patrol' : alphaOn ? 'Duke' : 'Park';
    btn.classList.toggle('locked', !on);
    btn.classList.toggle('hot', !!state.patrol || alphaOn);
    btn.setAttribute('aria-label', on ? 'Enter the dog park' : 'Dog park opens at Scout, 12 bones');
    if (btn.dataset.sig !== label) {
      btn.dataset.sig = label;
      btn.innerHTML = '<span class="bgl-ico">🌳</span><span class="bgl-sub">' + label + '</span>';
    }
  }

  function paintPark() {
    if (!overlay) return;
    overlay.hidden = !parkOpen;
    if (!parkOpen) return;
    const roster = companionRoster();
    const names = roster.map((c) => c.name).join(',');
    const sig = [
      names, alphaOn ? '1' : '0', alphaGrit, Math.ceil(Math.max(0, alphaLeft)),
      ballLoose ? 'b' : '', lastLine, state.patrol ? 'p' : '', state.parkWins,
      Math.ceil(alphaCd), lastPal,
    ].join('|');
    if (sig === parkSig) return;
    parkSig = sig;
    const sub = document.getElementById('bgl-park-sub');
    if (sub) {
      sub.textContent = alphaOn
        ? 'Duke\'s grit ' + alphaGrit + ' · ' + Math.ceil(Math.max(0, alphaLeft)) + 's'
        : state.patrol
          ? 'Pack Patrol is out. Ring again to rematch Duke.'
          : 'Duke the Alpha holds the hill. Your companions fight beside you.';
    }
    const fill = document.getElementById('bgl-grit-fill');
    if (fill) fill.style.width = Math.max(0, Math.min(100, alphaGrit)) + '%';
    const duke = document.getElementById('bgl-duke');
    if (duke) duke.style.setProperty('--grit', String(Math.max(0.35, alphaGrit / 100)));
    const ball = document.getElementById('bgl-ball');
    if (ball) ball.hidden = !ballLoose;
    const log = document.getElementById('bgl-park-log');
    if (log) log.textContent = parkLog.slice(0, 2).join('  ·  ') || 'Grass, a crooked fence, and one very large beagle.';
    const start = document.getElementById('bgl-alpha-start');
    if (start) {
      start.hidden = alphaOn;
      start.disabled = alphaCd > 0;
      start.textContent = state.parkWins
        ? (alphaCd > 0 ? 'Resting ' + Math.ceil(alphaCd) + 's' : 'Rematch Duke')
        : 'Ring the bell';
    }
    for (const id of ['bgl-park-throw', 'bgl-park-dig', 'bgl-park-howl', 'bgl-park-call']) {
      const b = document.getElementById(id);
      if (b) b.hidden = !alphaOn;
    }
    const pals = document.getElementById('bgl-pals');
    if (pals && pals.dataset.sig !== names + lastPal) {
      pals.dataset.sig = names + lastPal;
      pals.replaceChildren();
      for (const c of roster) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'bgl-pal' + (c.name === lastPal ? ' go' : '') + (c.stray ? ' stray' : '');
        card.dataset.pal = c.name;
        card.innerHTML = '<i class="ear l"></i><i class="ear r"></i><i class="face"></i><b></b>';
        card.querySelector('b').textContent = c.stray ? c.name + ' · stray' : c.name;
        card.setAttribute('aria-label', c.stray
          ? 'Scout the stray fetches on solo visits'
          : c.name + ' helps on their own, ' + c.style);
        card.addEventListener('click', () => callPack());
        pals.appendChild(card);
      }
    }
  }

  function buildParkOverlay() {
    const el = document.createElement('div');
    el.id = 'bgl-park-overlay';
    el.hidden = true;
    el.innerHTML = [
      '<section class="bgl-park-sheet" role="dialog" aria-label="Dog park">',
      '<header class="bgl-park-top">',
      '<div><h2>Dog Park</h2><p id="bgl-park-sub"></p></div>',
      '<button type="button" id="bgl-park-close">Close</button>',
      '</header>',
      '<div class="bgl-park-stage">',
      '<i class="bgl-sun" aria-hidden="true"></i>',
      '<i class="bgl-cloud" aria-hidden="true"></i>',
      '<i class="bgl-tree one" aria-hidden="true"></i>',
      '<i class="bgl-tree two" aria-hidden="true"></i>',
      '<i class="bgl-fence" aria-hidden="true"></i>',
      '<div id="bgl-duke" aria-hidden="true"><i class="crown"></i><i class="ear l"></i><i class="ear r"></i><i class="face"></i><i class="bandana"></i><i class="tail"></i></div>',
      '<div id="bgl-ball" hidden>🎾</div>',
      '<div id="bgl-pals"></div>',
      '</div>',
      '<div id="bgl-grit" title="Duke\'s grit"><i id="bgl-grit-fill"></i></div>',
      '<p id="bgl-park-log"></p>',
      '<div class="bgl-park-actions">',
      '<button type="button" id="bgl-alpha-start">Ring the bell</button>',
      '<button type="button" id="bgl-park-throw" hidden>Throw</button>',
      '<button type="button" id="bgl-park-dig" hidden>Dig</button>',
      '<button type="button" id="bgl-park-howl" hidden>Howl</button>',
      '<button type="button" id="bgl-park-call" hidden>Call pack</button>',
      '</div>',
      '</section>',
    ].join('');
    document.body.appendChild(el);
    el.querySelector('#bgl-park-close').addEventListener('click', closePark);
    el.querySelector('#bgl-alpha-start').addEventListener('click', startAlpha);
    el.querySelector('#bgl-park-throw').addEventListener('click', parkThrow);
    el.querySelector('#bgl-park-dig').addEventListener('click', parkDig);
    el.querySelector('#bgl-park-howl').addEventListener('click', parkHowl);
    el.querySelector('#bgl-park-call').addEventListener('click', callPack);
    return el;
  }

  function floater(text, x, y) {
    const el = document.createElement('div');
    el.className = 'bgl-floater';
    el.textContent = text;
    el.style.left = Math.max(24, Math.min(window.innerWidth - 24, x)) + 'px';
    el.style.top = Math.max(24, Math.min(window.innerHeight - 24, y)) + 'px';
    fx.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  function burst(x, y, color) {
    if (reduced) return;
    for (let i = 0; i < 7; i++) {
      const p = document.createElement('i');
      p.className = 'bgl-bit';
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      p.style.background = color;
      p.style.setProperty('--dx', ((Math.random() - 0.5) * 70) + 'px');
      p.style.setProperty('--dy', (-20 - Math.random() * 48) + 'px');
      fx.appendChild(p);
      setTimeout(() => p.remove(), 560);
    }
  }

  function hearts() {
    const r = root.getBoundingClientRect();
    for (let i = 0; i < 6; i++) floater('💛', r.left + r.width * (0.15 + Math.random() * 0.7), r.top + 16);
  }

  function dropPaw() {
    if (reduced || fx.querySelectorAll('.bgl-paw').length > 8) return;
    const el = document.createElement('div');
    el.className = 'bgl-paw';
    el.textContent = '🐾';
    el.style.left = (12 + Math.random() * 76) + '%';
    el.style.top = (18 + Math.random() * 58) + '%';
    fx.appendChild(el);
    setTimeout(() => el.remove(), 800);
  }

  function shout(text) {
    const el = document.createElement('div');
    el.className = 'bgl-shout';
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 760);
  }

  function shake() {
    if (reduced) return;
    root.classList.remove('shake');
    void root.offsetWidth;
    root.classList.add('shake');
  }

  function flash() {
    if (reduced) return;
    const el = document.createElement('div');
    el.className = 'bgl-flash';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 300);
  }

  function burstConfetti(pieces) {
    try {
      api.confetti({ pieces, duration: 1800, palette: ['#f59e0b', '#fcd34d', '#fff7e6', '#8d5a32', '#f4efe6'] });
    } catch { /* confetti is decorative */ }
  }

  function toast(msg, cls, level) {
    try { api.showToast(msg, cls || '', level || 'standard'); } catch { /* hud not ready */ }
  }

  function feed(msg) {
    try { api.addFeedEntry(msg); } catch { /* ignore */ }
  }

  function buzz(kind) {
    try {
      const h = api.haptics;
      if (h && typeof h[kind] === 'function') h[kind]();
    } catch { /* no vibration */ }
  }

  function audioScale() {
    try { return api.sfxScale(); } catch { return 1; }
  }

  function ensureCtx() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    } catch { ctx = null; }
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo) {
    const scale = audioScale();
    if (!scale || scale <= 0) return;
    const ac = ensureCtx();
    if (!ac) return;
    if (ac.state === 'suspended') { try { ac.resume(); } catch { /* gesture later */ } }
    const t0 = ac.currentTime;
    const osc = ac.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(Math.max(40, freq), t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol * scale, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  function noise(dur, vol) {
    const scale = audioScale();
    if (!scale || scale <= 0) return;
    const ac = ensureCtx();
    if (!ac) return;
    const len = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buffer = ac.createBuffer(1, len, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 540;
    const g = ac.createGain();
    g.gain.value = vol * scale;
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start();
  }

  function sound(kind) {
    if (kind === 'dig' || kind === 'bone') {
      noise(0.09, 0.18);
      tone(180, 0.07, 'triangle', 0.12, 90);
      if (kind === 'bone') {
        tone(520, 0.08, 'sine', 0.12, 760);
        setTimeout(() => tone(780, 0.1, 'sine', 0.1), 60);
      }
    } else if (kind === 'bark') {
      tone(220, 0.08, 'square', 0.1, 110);
      setTimeout(() => tone(340, 0.1, 'sawtooth', 0.07, 180), 70);
    } else if (kind === 'yip') {
      tone(660, 0.07, 'sine', 0.12, 920);
      setTimeout(() => tone(880, 0.08, 'sine', 0.08), 50);
    } else if (kind === 'squeak') {
      tone(1180, 0.05, 'square', 0.07, 1680);
      setTimeout(() => tone(900, 0.06, 'square', 0.05, 1400), 40);
    } else if (kind === 'whimper') {
      tone(420, 0.16, 'sine', 0.08, 180);
    } else if (kind === 'howl') {
      tone(262, 0.5, 'sine', 0.14, 196);
      setTimeout(() => tone(330, 0.62, 'sine', 0.12, 220), 90);
      setTimeout(() => tone(392, 0.7, 'triangle', 0.1, 180), 180);
    } else if (kind === 'buy') {
      tone(523, 0.08, 'triangle', 0.12);
      setTimeout(() => tone(784, 0.12, 'triangle', 0.12), 70);
    } else if (kind === 'rank') {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.13), i * 80));
    } else if (kind === 'done') {
      tone(520, 0.16, 'sine', 0.08, 240);
    }
  }

  function injectStyle() {
    if (document.getElementById('bgl-style')) return;
    const style = document.createElement('style');
    style.id = 'bgl-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  }
}

const CSS = `
#bgl-yard {
  position: fixed; z-index: 100; left: 236px; bottom: 14px; width: 336px;
  max-height: min(460px, calc(100vh - 24px));
  display: flex; flex-direction: column; box-sizing: border-box;
  background: linear-gradient(180deg, rgba(48,28,16,.96), rgba(18,12,8,.96));
  color: #f6efe4; border: 1px solid rgba(245,176,66,.55); border-radius: 16px;
  box-shadow: 0 12px 32px rgba(0,0,0,.4), 0 0 0 1px rgba(255,236,200,.06) inset;
  font-family: inherit; user-select: none; -webkit-user-select: none;
  touch-action: manipulation; overflow: hidden;
  transition: opacity .15s ease;
}
#bgl-yard.howling { border-color: #ffe08a; box-shadow: 0 0 24px rgba(245,158,11,.55); }
#bgl-yard[data-rank="4"] { border-color: #fcd34d; }
#bgl-yard[data-rank="5"] { border-color: #f59e0b; box-shadow: 0 0 26px rgba(245,158,11,.5); }
#bgl-yard button {
  font-family: inherit; color: inherit; cursor: pointer; touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
#bgl-head { display: flex; align-items: stretch; }
#bgl-toggle {
  display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; width: auto; min-height: 56px;
  padding: 8px 10px; border: 0; background: transparent; text-align: left;
}
#bgl-park {
  flex: none; width: 68px; min-height: 44px; border: 0; border-left: 1px solid rgba(245,176,66,.4);
  background: rgba(90,140,60,.4); display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 1px; padding: 4px 2px; font-weight: 800;
}
#bgl-park .bgl-ico { font-size: 16px; line-height: 1; }
#bgl-park .bgl-sub { font-size: 10px; font-weight: 800; }
#bgl-park.locked { opacity: .55; }
#bgl-park.hot { background: rgba(245,158,11,.45); }
.bgl-toggle-copy { display: flex; flex-direction: column; min-width: 0; flex: 1; }
#bgl-rank { font-size: 14px; letter-spacing: .2px; }
#bgl-next { font-size: 10px; color: #e7c89a; }
#bgl-bones, #bgl-mult {
  font-weight: 800; font-variant-numeric: tabular-nums; font-size: 13px;
  background: rgba(255,255,255,.06); border-radius: 999px; padding: 4px 8px;
}
#bgl-mult.hot { color: #fcd34d; background: rgba(245,158,11,.2); }
#bgl-chev { opacity: .7; font-size: 12px; }
#bgl-body { display: none; flex: 1 1 auto; flex-direction: column; gap: 8px; padding: 0 10px 10px; overflow: auto; min-height: 0; }
#bgl-yard.is-open #bgl-body { display: flex; }
#bgl-bond { height: 8px; border-radius: 99px; background: rgba(255,255,255,.08); overflow: hidden; }
#bgl-bond-fill { display: block; height: 100%; width: 0; background: linear-gradient(90deg, #f59e0b, #fcd34d); }
#bgl-perk { font-size: 11px; color: #f0d7b0; line-height: 1.3; }
#bgl-banner {
  text-align: center; font-weight: 900; letter-spacing: .4px; font-size: 13px;
  color: #3a240f; background: linear-gradient(90deg, #fcd34d, #fff1c2); border-radius: 8px; padding: 4px 6px;
}
#bgl-banner[hidden] { display: none; }
#bgl-mounds { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.bgl-mound {
  min-height: 52px; border-radius: 12px; border: 1px solid rgba(255,220,170,.25);
  background: radial-gradient(circle at 50% 35%, #a56a3c, #6a3e22 72%);
  font-size: 20px; box-shadow: inset 0 -6px 0 rgba(0,0,0,.18);
}
.bgl-mound.ready { animation: bglGlow 1.15s ease-in-out infinite; }
.bgl-mound.glint {
  background: radial-gradient(circle at 50% 35%, #ffe7a3, #d08920 70%);
  animation: bglGlint .85s ease-in-out infinite;
}
.bgl-mound.hole {
  background: #2a211c; color: #b9a48e; font-size: 12px; font-weight: 800; animation: none;
}
.bgl-mound:active:not(:disabled) { transform: scale(.94); }
#bgl-actions { display: flex; gap: 6px; }
.bgl-act {
  flex: 1; min-width: 0; min-height: 52px; border-radius: 12px;
  border: 1px solid rgba(255,220,170,.28); background: rgba(255,255,255,.06);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px;
  padding: 4px 2px;
}
.bgl-act .bgl-ico { font-size: 16px; line-height: 1; }
.bgl-act .bgl-sub { font-size: 10px; font-weight: 800; font-variant-numeric: tabular-nums; }
.bgl-act.poor { opacity: .5; }
.bgl-act.on { background: rgba(245,158,11,.28); border-color: #fcd34d; }
.bgl-act:active { transform: scale(.96); }
#bgl-shop[hidden] { display: none; }
#bgl-shop-list { display: flex; flex-direction: column; gap: 6px; }
.bgl-buy {
  min-height: 48px; width: 100%; display: flex; align-items: center; justify-content: space-between;
  gap: 8px; padding: 6px 10px; border-radius: 10px; border: 1px solid rgba(255,220,170,.25);
  background: rgba(255,255,255,.05); text-align: left;
}
.bgl-buy small { color: #e7c89a; font-weight: 700; }
.bgl-buy-cost { font-weight: 800; font-variant-numeric: tabular-nums; }
.bgl-buy.poor { opacity: .55; }
#bgl-shop-stats, #bgl-status, .bgl-keys { margin: 0; font-size: 10px; color: #e7c89a; line-height: 1.35; }
.bgl-pup { width: 36px; height: 36px; position: relative; flex: none; }
.bgl-pup .ear { position: absolute; top: 1px; width: 12px; height: 16px; background: #6e4124; border-radius: 8px 8px 6px 6px; }
.bgl-pup .ear.l { left: 1px; transform: rotate(-22deg); transform-origin: 50% 100%; }
.bgl-pup .ear.r { right: 1px; transform: rotate(22deg); transform-origin: 50% 100%; }
.bgl-pup .face { position: absolute; left: 6px; top: 10px; width: 24px; height: 20px; background: #f4efe6; border-radius: 12px; box-shadow: inset 0 -7px 0 #8d5a32; }
.bgl-pup .eye { position: absolute; top: 16px; width: 3px; height: 4px; background: #1a120e; border-radius: 50%; }
.bgl-pup .eye.l { left: 12px; }
.bgl-pup .eye.r { right: 12px; }
.bgl-pup .nose { position: absolute; left: 15px; top: 22px; width: 6px; height: 4px; background: #1a120e; border-radius: 40%; }
#bgl-yard.zoomies .bgl-pup .ear.l { animation: bglEar .12s ease-in-out infinite alternate; }
#bgl-yard.zoomies .bgl-pup .ear.r { animation: bglEar .12s ease-in-out infinite alternate-reverse; }
#bgl-fx { position: fixed; inset: 0; pointer-events: none; z-index: 40; overflow: hidden; }
.bgl-bone-tag {
  position: absolute; transform: translate(-50%, -120%); font-size: 22px;
  filter: drop-shadow(0 2px 2px rgba(0,0,0,.45));
}
.bgl-floater {
  position: absolute; transform: translate(-50%, -100%); font-weight: 900; color: #fff6e0;
  text-shadow: 0 2px 0 #6b3a12; font-size: 16px; animation: bglFloat .9s ease forwards;
}
.bgl-bit { position: absolute; width: 7px; height: 7px; border-radius: 2px; animation: bglBit .55s ease forwards; }
.bgl-paw { position: absolute; font-size: 22px; animation: bglFloat .8s ease forwards; opacity: .9; }
.bgl-shout {
  position: fixed; left: 0; right: 0; top: 32%; z-index: 400; pointer-events: none;
  text-align: center; font-weight: 900; letter-spacing: 1px;
  font-size: clamp(28px, 8vw, 64px); color: #fff8e8;
  text-shadow: 0 4px 0 #8a4b12, 0 0 24px #f59e0b;
  animation: bglShout .76s ease forwards;
}
.bgl-flash {
  position: fixed; inset: 0; z-index: 180; pointer-events: none;
  background: radial-gradient(circle at 50% 40%, rgba(255,236,180,.5), transparent 62%);
  animation: bglFlash .28s ease forwards;
}
#bgl-yard.shake { animation: bglShake .28s linear; }
@keyframes bglGlow {
  0%, 100% { box-shadow: inset 0 -6px 0 rgba(0,0,0,.18), 0 0 0 rgba(245,176,66,0); }
  50% { box-shadow: inset 0 -6px 0 rgba(0,0,0,.18), 0 0 14px rgba(245,176,66,.9); }
}
@keyframes bglGlint {
  0%, 100% { box-shadow: 0 0 0 2px #fcd34d, 0 0 8px rgba(245,158,11,.65); }
  50% { box-shadow: 0 0 0 2px #fff6d0, 0 0 18px rgba(255,214,90,1); }
}
@keyframes bglEar { from { transform: rotate(-8deg); } to { transform: rotate(-34deg); } }
@keyframes bglFloat { to { transform: translate(-50%, -180%); opacity: 0; } }
@keyframes bglBit { to { transform: translate(var(--dx), var(--dy)); opacity: 0; } }
@keyframes bglShout { 0% { transform: scale(.8); opacity: 0; } 18% { transform: scale(1); opacity: 1; } 100% { opacity: 0; } }
@keyframes bglFlash { to { opacity: 0; } }
@keyframes bglShake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
@media (hover: none), (max-width: 900px) { .bgl-keys { display: none; } }
@media (max-width: 900px) {
  #bgl-yard {
    left: 8px; right: 8px; width: auto;
    /* Under the cash and metrics, above the office so a bone stays tappable. */
    top: calc(140px + env(safe-area-inset-top, 0px));
    bottom: auto;
    max-height: 236px;
  }
  #bgl-perk, #bgl-status { display: none; }
  #bgl-toggle { min-height: 44px; padding: 4px 8px; }
  #bgl-body { gap: 4px; padding: 0 8px 6px; }
  #bgl-banner { padding: 1px 6px; font-size: 11px; }
  #bgl-mounds, #bgl-actions { gap: 4px; }
  .bgl-mound, .bgl-act { min-height: 44px; }
  /* The hire drawer covers the left of the screen and used to leave a
     sliver of the yard clickable beside it. Step aside while it's open. */
  #left-panel.open ~ #bgl-yard { opacity: 0; pointer-events: none; }
}
@media (max-width: 900px) and (max-height: 520px) {
  #bgl-yard {
    top: calc(58px + env(safe-area-inset-top, 0px));
    bottom: auto;
    /* Clear the joystick on the left and the sprint / 3rd-person cluster on the right. */
    left: calc(154px + env(safe-area-inset-left, 0px));
    right: auto;
    width: min(420px, calc(100vw - 324px));
    max-height: calc(100vh - 150px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
  }
  #bgl-perk, #bgl-status, #bgl-banner, .bgl-keys { display: none; }
  #bgl-toggle { min-height: 44px; padding: 4px 8px; }
  #bgl-body { gap: 4px; padding: 0 8px 6px; }
  #bgl-bond { height: 4px; }
  #bgl-mounds { grid-template-columns: repeat(8, 1fr); gap: 4px; }
  #bgl-actions { gap: 4px; }
  .bgl-mound, .bgl-act { min-height: 44px; }
}
#bgl-park-overlay {
  position: fixed; inset: 0; z-index: 260; display: flex;
  padding: calc(8px + env(safe-area-inset-top, 0px)) 8px calc(8px + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box; background: rgba(6,10,6,.5);
}
#bgl-park-overlay[hidden] { display: none; }
.bgl-park-sheet {
  width: min(920px, 100%); margin: auto; height: min(640px, 100%); max-height: 100%;
  display: flex; flex-direction: column; box-sizing: border-box; overflow: hidden;
  border-radius: 18px; color: #1c140c;
  background: linear-gradient(#8fd3ef 0%, #c5ecb0 38%, #67a143 38%, #3f6e2c 100%);
  box-shadow: 0 16px 40px rgba(0,0,0,.45); border: 2px solid #f6e7c4;
}
.bgl-park-top {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  padding: 8px 10px; background: rgba(255,248,230,.88);
}
.bgl-park-top h2 { margin: 0; font-size: 18px; letter-spacing: .3px; }
.bgl-park-top p { margin: 2px 0 0; font-size: 12px; font-weight: 700; }
#bgl-park-close { min-height: 44px; min-width: 72px; border: 0; border-radius: 12px; background: #3a2414; color: #fff6e4; font-weight: 800; }
.bgl-park-stage { position: relative; flex: 1; min-height: 140px; overflow: hidden; }
.bgl-sun, .bgl-cloud, .bgl-tree, .bgl-fence, #bgl-duke, #bgl-ball { pointer-events: none; }
.bgl-sun { position: absolute; right: 8%; top: 10px; width: 42px; height: 42px; border-radius: 50%; background: #ffe38a; box-shadow: 0 0 0 8px rgba(255,227,138,.35); }
.bgl-cloud { position: absolute; left: 18%; top: 22px; width: 70px; height: 22px; border-radius: 20px; background: rgba(255,255,255,.85); }
.bgl-tree { position: absolute; bottom: 28%; width: 18px; height: 46px; background: #6b4224; border-radius: 4px; }
.bgl-tree::before { content: ''; position: absolute; left: -16px; top: -28px; width: 50px; height: 36px; border-radius: 50%; background: #2f7a32; }
.bgl-tree.one { left: 8%; }
.bgl-tree.two { right: 10%; }
.bgl-fence { position: absolute; left: 0; right: 0; bottom: 22%; height: 18px; background: repeating-linear-gradient(90deg, transparent 0 18px, #f4efe6 18px 22px); border-top: 4px solid #f4efe6; opacity: .85; }
#bgl-duke {
  position: absolute; left: 50%; bottom: 18%; width: 120px; height: 132px; margin-left: -60px;
  transform: scale(var(--grit, 1)); transform-origin: 50% 100%;
}
#bgl-duke .ear { position: absolute; top: 18px; width: 28px; height: 48px; background: #6e4124; border-radius: 16px; }
#bgl-duke .ear.l { left: 10px; transform: rotate(-28deg); }
#bgl-duke .ear.r { right: 10px; transform: rotate(28deg); }
#bgl-duke .face { position: absolute; left: 22px; top: 40px; width: 76px; height: 64px; background: #f4efe6; border-radius: 36px; box-shadow: inset 0 -22px 0 #8d5a32; }
#bgl-duke .face::before, #bgl-duke .face::after { content: ''; position: absolute; top: 22px; width: 8px; height: 10px; background: #1a120e; border-radius: 50%; }
#bgl-duke .face::before { left: 18px; }
#bgl-duke .face::after { right: 18px; }
#bgl-duke .crown { position: absolute; left: 38px; top: 6px; width: 44px; height: 16px; background: #f5c542; clip-path: polygon(0 100%, 15% 20%, 35% 100%, 50% 10%, 70% 100%, 85% 20%, 100% 100%); }
#bgl-duke .bandana { position: absolute; left: 34px; top: 96px; width: 52px; height: 14px; background: #c2413a; border-radius: 4px; }
#bgl-duke .tail { position: absolute; right: -8px; bottom: 28px; width: 18px; height: 36px; background: #f4efe6; border-radius: 12px; transform: rotate(30deg); }
#bgl-duke.hit { animation: bglShake .28s linear; }
#bgl-ball { position: absolute; left: 30%; bottom: 30%; font-size: 28px; }
#bgl-pals { position: absolute; left: 8px; right: 8px; bottom: 6px; display: flex; gap: 6px; justify-content: center; }
.bgl-pal {
  min-width: 72px; min-height: 44px; border: 0; border-radius: 12px; background: rgba(255,248,230,.92);
  display: flex; align-items: flex-end; justify-content: center; position: relative; padding: 16px 8px 4px;
}
.bgl-pal b { font-size: 11px; }
.bgl-pal .ear { position: absolute; top: 2px; width: 10px; height: 14px; background: #6e4124; border-radius: 6px; }
.bgl-pal .ear.l { left: 18px; transform: rotate(-20deg); }
.bgl-pal .ear.r { right: 18px; transform: rotate(20deg); }
.bgl-pal .face { position: absolute; left: 22px; top: 8px; width: 28px; height: 18px; background: #f4efe6; border-radius: 10px; box-shadow: inset 0 -6px 0 #8d5a32; }
.bgl-pal.stray { outline: 2px dashed #3a2414; }
.bgl-pal.go { background: #fcd34d; }
#bgl-grit { height: 12px; margin: 6px 10px 0; border-radius: 99px; background: rgba(0,0,0,.25); overflow: hidden; }
#bgl-grit-fill { display: block; height: 100%; width: 100%; background: linear-gradient(90deg, #c2413a, #f5c542); }
#bgl-park-log { margin: 4px 10px; min-height: 32px; font-size: 13px; font-weight: 800; color: #fff8e8; text-shadow: 0 1px 0 rgba(0,0,0,.35); }
.bgl-park-actions { display: flex; gap: 6px; padding: 8px; background: rgba(28,20,12,.88); }
.bgl-park-actions button {
  flex: 1; min-height: 48px; min-width: 0; border: 0; border-radius: 12px; background: #f6e7c4; color: #1c140c;
  font-weight: 900; font-size: 14px;
}
.bgl-park-actions button:disabled { opacity: .5; }
@media (max-width: 700px) {
  .bgl-park-sheet { height: 100%; border-radius: 14px; }
  .bgl-park-actions { flex-wrap: wrap; }
  .bgl-park-actions button { flex: 1 1 40%; }
}
@media (prefers-reduced-motion: reduce) {
  .bgl-mound.ready, #bgl-yard.zoomies .bgl-pup .ear.l, #bgl-yard.zoomies .bgl-pup .ear.r,
  .bgl-floater, .bgl-bit, .bgl-paw, .bgl-shout, .bgl-flash, #bgl-yard.shake, #bgl-duke.hit { animation: none; }
}
`;
