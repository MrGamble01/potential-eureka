/* ============================================
   AGE OF WAR — Side-scrolling lane battler
   Inspired by Max Games' classic.
   Spawn units, push the enemy base, age up to
   unlock stronger units, build turrets, fire
   ultimates. Last base standing wins.
   ============================================ */

const AgeOfWarGame = (() => {
  // ---- Stage ----
  const WIDTH  = 960;
  const HEIGHT = 380;
  const GROUND_Y = HEIGHT - 60;
  const BASE_W = 110;
  const PLAYER_BASE_X = 10;
  const ENEMY_BASE_X  = WIDTH - BASE_W - 10;

  // ---- Era definitions ----
  // Five ages, each with a sky palette, base color, age-up XP cost,
  // and a per-era special ability.
  const ERAS = [
    { id: 'stone',    name: 'Stone Age',   icon: '🪨', sky: ['#4a3a2a', '#7a604a'], baseColor: '#7a5a3a', upXP:    150,
      special: { name: 'Boulder',    icon: '🪨', dmg: 180, color: '#a07040' } },
    { id: 'medieval', name: 'Medieval',    icon: '🏰', sky: ['#2a3a55', '#506a85'], baseColor: '#8a8a9c', upXP:    600,
      special: { name: 'Arrow Rain', icon: '🏹', dmg: 320, color: '#b5985a' } },
    { id: 'industrial', name: 'Industrial', icon: '🏭', sky: ['#2d2a3a', '#4f4c5e'], baseColor: '#6b6878', upXP:   1800,
      special: { name: 'Artillery', icon: '💣', dmg: 560, color: '#888' } },
    { id: 'modern',   name: 'Modern',      icon: '🪖', sky: ['#1d3a45', '#356575'], baseColor: '#5a7a85', upXP:   4500,
      special: { name: 'Air Strike', icon: '✈️', dmg: 900, color: '#ddd' } },
    { id: 'future',   name: 'Future',      icon: '🚀', sky: ['#0e1438', '#243460'], baseColor: '#88a8ff', upXP:  10000,
      special: { name: 'Orbital Laser', icon: '🛰️', dmg: 1500, color: '#6ec4ff' } },
  ];

  // ---- Unit catalog ----
  // Three units per era: cheap melee / ranged / heavy.
  const UNITS = {
    // Stone Age
    club:     { era: 0, name: 'Clubman',    icon: '🦴', cost: 25,   hp: 60,   dmg: 9,   range: 26,  atkSpd: 0.85, speed: 42, color: '#b07040', xp: 12,  gold: 16,  silhouette: 'humanoid' },
    sling:    { era: 0, name: 'Slinger',    icon: '🪃', cost: 55,   hp: 32,   dmg: 16,  range: 145, atkSpd: 1.2,  speed: 36, color: '#8a5028', xp: 16,  gold: 26,  silhouette: 'humanoid' },
    dino:     { era: 0, name: 'Dino Rider', icon: '🦖', cost: 110,  hp: 180,  dmg: 24,  range: 30,  atkSpd: 1.0,  speed: 38, color: '#5d8a4a', xp: 30,  gold: 55,  silhouette: 'beast' },

    // Medieval
    swordsman:{ era: 1, name: 'Swordsman',  icon: '⚔️', cost: 130,  hp: 180,  dmg: 28,  range: 28,  atkSpd: 0.75, speed: 46, color: '#a0a0c0', xp: 38,  gold: 60,  silhouette: 'humanoid' },
    archer:   { era: 1, name: 'Archer',     icon: '🏹', cost: 200,  hp: 90,   dmg: 48,  range: 200, atkSpd: 1.3,  speed: 40, color: '#b5985a', xp: 48,  gold: 80,  silhouette: 'humanoid' },
    knight:   { era: 1, name: 'Knight',     icon: '🐴', cost: 380,  hp: 480,  dmg: 50,  range: 30,  atkSpd: 1.0,  speed: 50, color: '#9a9bc5', xp: 90,  gold: 150, silhouette: 'beast' },

    // Industrial
    rifleman: { era: 2, name: 'Rifleman',   icon: '🔫', cost: 380,  hp: 270,  dmg: 90,  range: 230, atkSpd: 0.85, speed: 42, color: '#5d7b3a', xp: 110, gold: 180, silhouette: 'humanoid' },
    cannon:   { era: 2, name: 'Cannoneer',  icon: '💣', cost: 620,  hp: 380,  dmg: 170, range: 270, atkSpd: 1.7,  speed: 32, color: '#4a4030', xp: 170, gold: 290, silhouette: 'humanoid' },
    tank1:    { era: 2, name: 'Steam Tank', icon: '🚂', cost: 1100, hp: 950,  dmg: 200, range: 60,  atkSpd: 1.1,  speed: 30, color: '#6b5848', xp: 320, gold: 540, silhouette: 'vehicle' },

    // Modern
    soldier:  { era: 3, name: 'Soldier',    icon: '🪖', cost: 850,  hp: 480,  dmg: 200, range: 240, atkSpd: 0.7,  speed: 44, color: '#5a7a45', xp: 240, gold: 410, silhouette: 'humanoid' },
    sniper:   { era: 3, name: 'Sniper',     icon: '🎯', cost: 1500, hp: 240,  dmg: 520, range: 380, atkSpd: 2.4,  speed: 38, color: '#7a7a4a', xp: 420, gold: 700, silhouette: 'humanoid' },
    tank2:    { era: 3, name: 'Tank',       icon: '🪖', cost: 2400, hp: 2000, dmg: 380, range: 100, atkSpd: 1.0,  speed: 32, color: '#4d5a3a', xp: 700, gold: 1180, silhouette: 'vehicle' },

    // Future
    laser:    { era: 4, name: 'Laser Trooper', icon: '🪖', cost: 1700, hp: 700,  dmg: 360, range: 280, atkSpd: 0.55, speed: 48, color: '#6ec4ff', xp: 540, gold: 920,  silhouette: 'humanoid' },
    mech:     { era: 4, name: 'Mech',          icon: '🤖', cost: 3500, hp: 2800, dmg: 540, range: 110, atkSpd: 0.85, speed: 36, color: '#a89cff', xp: 1100,gold: 2000, silhouette: 'vehicle' },
    flier:    { era: 4, name: 'Hover',         icon: '🛸', cost: 5500, hp: 1500, dmg: 820, range: 320, atkSpd: 1.4,  speed: 56, color: '#ff90ee', xp: 1600,gold: 3200, silhouette: 'flier' },
  };

  function unitsForEra(era) {
    return Object.entries(UNITS).filter(([, u]) => u.era === era).map(([k]) => k);
  }

  // ---- Turret catalog (one per era — upgrade to next era's tier) ----
  const TURRETS = [
    { era: 0, name: 'Rock Sling',    icon: '🪨', cost: 250,  dmg: 14,  range: 200, atkSpd: 1.6, color: '#7a5a3a' },
    { era: 1, name: 'Crossbow',      icon: '🏹', cost: 700,  dmg: 38,  range: 230, atkSpd: 1.2, color: '#a08855' },
    { era: 2, name: 'Cannon Turret', icon: '💣', cost: 2000, dmg: 130, range: 260, atkSpd: 1.4, color: '#555' },
    { era: 3, name: 'MG Nest',       icon: '🔫', cost: 5000, dmg: 280, range: 300, atkSpd: 0.6, color: '#5a7a45' },
    { era: 4, name: 'Plasma Turret', icon: '✨', cost: 12000, dmg: 700, range: 340, atkSpd: 0.9, color: '#6ec4ff' },
  ];
  const TURRET_SLOTS = 4;

  // ---- State ----
  let canvas, ctx;
  let rafId = null;
  let lastFrame = 0;
  let running = false, gameOver = false;
  let outcome = null;
  let playerEra = 0, enemyEra = 0;
  let gold = 0, xp = 0;
  let playerBaseHp = 1000, playerBaseMax = 1000;
  let enemyBaseHp  = 1000, enemyBaseMax  = 1000;
  let units = [];
  let projectiles = [];
  let nextSpawnId = 1;
  let spawnCooldowns = {};
  let enemySpawnT = 1.6;
  let goldTrickleT = 0;
  let specialReadyT = 6;
  const specialCooldownMax = 25;
  let goldFloaters = [];
  let dmgFloaters = [];
  let muzzleFlashes = [];
  let strikes = [];                // air-strike effects (meteor / arrows / bombs)
  let coinDrops = [];              // visual coins after kills
  let ageFlash = 0;                // 1 → 0 right after aging up
  let ageBannerT = 0;              // seconds banner stays visible
  let ageBannerText = '';
  let bgClouds = [];               // parallax cloud x positions
  let deadUnits = [];              // { x, y, w, h, color, rot, vrot, t } toppling corpses
  let particles = [];              // { x, y, vx, vy, color, life, size }
  let playerTurrets = [null, null, null, null];  // each: { era, atkT, ...TURRETS[era] }
  let enemyTurrets  = [null, null, null, null];

  // ---- Sound (Web Audio API, no samples) ----
  const SFX = (() => {
    let ctxA = null, masterGain = null;
    let lastSpawn = 0, lastHit = 0;
    function ensure() {
      if (ctxA) return ctxA;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctxA = new AC();
        masterGain = ctxA.createGain();
        masterGain.gain.value = 0.18;
        masterGain.connect(ctxA.destination);
      } catch { ctxA = null; }
      return ctxA;
    }
    function tone({ freq, dur = 0.12, type = 'sine', vol = 0.5, attack = 0.005, slideTo = null }) {
      const ac = ensure(); if (!ac) return;
      if (ac.state === 'suspended') { try { ac.resume(); } catch {} }
      const t0 = ac.currentTime;
      const osc = ac.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      const g = ac.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g); g.connect(masterGain);
      osc.start(t0); osc.stop(t0 + dur + 0.04);
    }
    function noise({ dur = 0.18, vol = 0.18 }) {
      const ac = ensure(); if (!ac) return;
      const t0 = ac.currentTime;
      const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = ac.createBufferSource();
      src.buffer = buf;
      const g = ac.createGain();
      g.gain.value = vol;
      src.connect(g); g.connect(masterGain);
      src.start(t0);
    }
    return {
      spawn() {
        const now = performance.now();
        if (now - lastSpawn < 30) return;
        lastSpawn = now;
        tone({ freq: 660, dur: 0.06, type: 'square', vol: 0.12 });
      },
      hit() {
        const now = performance.now();
        if (now - lastHit < 35) return;
        lastHit = now;
        tone({ freq: 220 + Math.random() * 80, dur: 0.04, type: 'square', vol: 0.10 });
      },
      kill()        { tone({ freq: 180, slideTo: 80, dur: 0.18, type: 'sawtooth', vol: 0.16 }); },
      coin()        { tone({ freq: 1320, dur: 0.05, type: 'triangle', vol: 0.12 }); setTimeout(() => tone({ freq: 1760, dur: 0.05, type: 'triangle', vol: 0.10 }), 35); },
      ageUp() {
        [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(
          () => tone({ freq: f, dur: 0.18, type: 'triangle', vol: 0.28 }), i * 70));
      },
      special()     { noise({ dur: 0.45, vol: 0.32 }); tone({ freq: 90, slideTo: 40, dur: 0.45, type: 'sawtooth', vol: 0.18 }); },
      victory() {
        [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(
          () => tone({ freq: f, dur: 0.30, type: 'triangle', vol: 0.32 }), i * 100));
      },
      defeat() {
        [392, 311, 247, 196].forEach((f, i) => setTimeout(
          () => tone({ freq: f, dur: 0.32, type: 'sawtooth', vol: 0.26 }), i * 120));
      },
      turret() { tone({ freq: 880, dur: 0.05, type: 'square', vol: 0.10 }); setTimeout(() => tone({ freq: 1320, dur: 0.06, type: 'square', vol: 0.10 }), 40); },
    };
  })();

  // ---- Init ----
  function init() {
    canvas = document.getElementById('aow-canvas');
    if (!canvas) return;
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    ctx = canvas.getContext('2d');
    seedClouds();
    reset();
    bindControls();
    cancelAnimationFrame(rafId);
    lastFrame = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  function seedClouds() {
    bgClouds = [];
    for (let i = 0; i < 8; i++) {
      bgClouds.push({
        x: Math.random() * WIDTH,
        y: 30 + Math.random() * (GROUND_Y * 0.45),
        r: 18 + Math.random() * 26,
        v: 4 + Math.random() * 8,
      });
    }
  }

  function reset() {
    running = true;
    gameOver = false;
    outcome = null;
    playerEra = 0;
    enemyEra = 0;
    gold = 90;
    xp = 0;
    playerBaseHp = playerBaseMax = 1200;
    enemyBaseHp  = enemyBaseMax  = 1200;
    units = [];
    projectiles = [];
    spawnCooldowns = {};
    enemySpawnT = 1.0;
    goldTrickleT = 0;
    specialReadyT = 6;
    goldFloaters = [];
    dmgFloaters = [];
    muzzleFlashes = [];
    strikes = [];
    coinDrops = [];
    ageFlash = 0;
    ageBannerT = 0;
    ageBannerText = '';
    deadUnits = [];
    particles = [];
    playerTurrets = [null, null, null, null];
    enemyTurrets  = [null, null, null, null];
    // Initial units so the battlefield isn't empty when you arrive.
    spawnUnit('player', 'club');
    spawnUnit('player', 'club');
    spawnUnit('enemy',  'club');
    renderHud();
    renderSpawnPanel();
    renderTurretPanel();
    hideOverlay();
  }

  // ---- Spawning ----
  function spawnUnit(side, key) {
    const def = UNITS[key];
    if (!def) return;
    const w = def.silhouette === 'vehicle' ? 28 : def.silhouette === 'beast' ? 26 : 18;
    const h = def.silhouette === 'flier' ? 32 : def.silhouette === 'vehicle' ? 30 : 30;
    const flying = def.silhouette === 'flier';
    const u = {
      id: nextSpawnId++,
      side, key,
      name: def.name, icon: def.icon, color: def.color,
      silhouette: def.silhouette,
      x: side === 'player' ? PLAYER_BASE_X + BASE_W + 14 : ENEMY_BASE_X - 14,
      yOffset: flying ? 40 : 0,
      hp: def.hp, hpMax: def.hp,
      dmg: def.dmg, range: def.range, atkSpd: def.atkSpd, atkT: 0.4,
      speed: def.speed, xp: def.xp, gold: def.gold,
      w, h,
      hitFlash: 0,
      walkPhase: Math.random() * Math.PI * 2,
    };
    units.push(u);
  }

  function tryPlayerSpawn(key) {
    if (gameOver) return;
    const def = UNITS[key];
    if (!def) return;
    if (def.era > playerEra) return;
    if (gold < def.cost) return;
    if ((spawnCooldowns[key] || 0) > 0) return;
    gold -= def.cost;
    spawnUnit('player', key);
    spawnCooldowns[key] = Math.max(0.4, def.cost / 600);
    SFX.spawn();
    renderHud();
    renderSpawnPanel();
  }

  function ageUp() {
    if (gameOver) return;
    if (playerEra >= ERAS.length - 1) return;
    const need = ERAS[playerEra].upXP;
    if (xp < need) return;
    xp -= need;
    playerEra++;
    const hpBoost = 500;
    playerBaseMax += hpBoost;
    playerBaseHp = Math.min(playerBaseMax, playerBaseHp + hpBoost);
    SFX.ageUp();
    ageFlash = 1;
    const e = ERAS[playerEra];
    ageBannerText = `Welcome to the ${e.name}`;
    ageBannerT = 2.4;
    // Confetti-ish particle burst as celebration
    for (let i = 0; i < 26; i++) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
      const spd = 120 + Math.random() * 220;
      particles.push({
        x: PLAYER_BASE_X + BASE_W / 2,
        y: GROUND_Y - 80,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        color: ['#fcd34d', '#3FB950', '#58A6FF', '#F778BA'][i % 4],
        size: 2 + Math.random() * 3,
        life: 1.4 + Math.random() * 0.6,
      });
    }
    renderHud();
    renderSpawnPanel();
    renderTurretPanel();
  }

  function fireSpecial() {
    if (gameOver) return;
    if (specialReadyT > 0) return;
    const spec = ERAS[playerEra].special;
    // Visual: meteor/arrows/bombs sweeping across the right half.
    const startX = WIDTH * 0.55;
    const endX = ENEMY_BASE_X;
    const drops = 6 + playerEra * 2;
    for (let i = 0; i < drops; i++) {
      const dx = startX + (endX - startX) * (i / (drops - 1));
      strikes.push({
        x: dx + (Math.random() - 0.5) * 30,
        y: -40 + Math.random() * -40,
        targetY: GROUND_Y - 10,
        speed: 600 + Math.random() * 200,
        delay: i * 0.08,
        icon: spec.icon,
        color: spec.color,
        dmgRadius: 60,
        dmgEach: spec.dmg / drops,
        side: 'player',
      });
    }
    SFX.special();
    // Screen-flash for impact
    ageFlash = Math.max(ageFlash, 0.7);
    specialReadyT = specialCooldownMax;
    renderHud();
  }

  function tryBuyTurret(slot, era) {
    if (gameOver) return;
    const tdef = TURRETS[era];
    if (!tdef) return;
    if (era > playerEra) return;
    // If slot already has same-or-higher era, can't replace.
    const existing = playerTurrets[slot];
    if (existing && existing.era >= era) return;
    if (gold < tdef.cost) return;
    gold -= tdef.cost;
    playerTurrets[slot] = { ...tdef, atkT: 0 };
    SFX.turret();
    renderHud();
    renderTurretPanel();
  }

  // ---- Input ----
  function bindControls() {
    const restartBtn = document.getElementById('aow-restart-btn');
    if (restartBtn) restartBtn.onclick = reset;
    const ageBtn = document.getElementById('aow-ageup-btn');
    if (ageBtn) ageBtn.onclick = ageUp;
    const specialBtn = document.getElementById('aow-special-btn');
    if (specialBtn) specialBtn.onclick = fireSpecial;
    document.addEventListener('keydown', e => {
      const view = document.getElementById('view-ageofwar');
      if (!view || !view.classList.contains('active')) return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 9) {
        const keys = visibleUnitKeys();
        const key = keys[n - 1];
        if (key) tryPlayerSpawn(key);
        e.preventDefault();
      } else if (e.key === ' ') {
        if (gameOver) reset();
        else fireSpecial();
        e.preventDefault();
      } else if (e.key === 'q' || e.key === 'Q' || e.key === 'Tab') {
        ageUp();
        e.preventDefault();
      }
    });
  }

  function visibleUnitKeys() {
    const keys = [];
    for (let e = 0; e <= playerEra; e++) keys.push(...unitsForEra(e));
    return keys;
  }

  // ---- Enemy AI ----
  function enemyTick(dt) {
    enemySpawnT -= dt;
    if (enemySpawnT > 0) return;
    if (enemyEra < playerEra && Math.random() < 0.30) enemyEra++;
    const choices = unitsForEra(enemyEra);
    // Bias toward cheaper units; occasionally a heavy.
    const heavy = Math.random() < 0.2;
    const key = heavy ? choices[choices.length - 1] : choices[Math.floor(Math.random() * choices.length)];
    spawnUnit('enemy', key);
    // Build enemy turrets too (one tier behind, slowly).
    if (Math.random() < 0.06) {
      const slot = enemyTurrets.findIndex(t => !t || t.era < enemyEra);
      if (slot >= 0 && enemyEra <= TURRETS.length - 1) {
        const targetEra = Math.min(enemyEra, TURRETS.length - 1);
        enemyTurrets[slot] = { ...TURRETS[targetEra], atkT: 0 };
      }
    }
    const pressureFactor = enemyBaseHp / enemyBaseMax;
    enemySpawnT = 1.4 + Math.random() * 1.6 + pressureFactor * 1.0;
  }

  // ---- Combat ----
  function update(dt) {
    if (!running) return;

    if (ageFlash > 0) ageFlash = Math.max(0, ageFlash - dt * 1.6);

    // Background clouds drift
    for (const c of bgClouds) {
      c.x -= c.v * dt;
      if (c.x < -80) { c.x = WIDTH + 80; c.y = 30 + Math.random() * (GROUND_Y * 0.45); }
    }

    // Resource trickle
    goldTrickleT -= dt;
    if (goldTrickleT <= 0) {
      gold += 6 + playerEra * 4;
      goldTrickleT = 1.0;
      renderHud();
    }

    // Spawn cooldowns
    for (const k of Object.keys(spawnCooldowns)) {
      spawnCooldowns[k] = Math.max(0, spawnCooldowns[k] - dt);
    }
    if (specialReadyT > 0) {
      specialReadyT = Math.max(0, specialReadyT - dt);
      renderHud();
    }

    enemyTick(dt);

    // Move + fight units
    for (const u of units) {
      if (u.hp <= 0) continue;
      u.hitFlash = Math.max(0, u.hitFlash - dt);
      const enemies = units.filter(o => o.side !== u.side && o.hp > 0);
      let target = null, bestDist = Infinity;
      for (const e of enemies) {
        const d = Math.abs(e.x - u.x);
        if (d < bestDist) { bestDist = d; target = e; }
      }
      const baseTargetX = u.side === 'player' ? ENEMY_BASE_X : PLAYER_BASE_X + BASE_W;
      const baseDx = baseTargetX - u.x;
      const baseDist = Math.abs(baseDx);
      let dist, dirX, isBase;
      if (target && bestDist < baseDist) {
        dist = bestDist;
        dirX = Math.sign(target.x - u.x) || (u.side === 'player' ? 1 : -1);
        isBase = false;
      } else {
        dist = baseDist;
        dirX = Math.sign(baseDx) || (u.side === 'player' ? 1 : -1);
        isBase = true;
      }
      const aheadGap = u.w + 6;
      const ahead = u.side === 'player'
        ? units.find(o => o.side === u.side && o !== u && o.hp > 0 && o.x > u.x && o.x - u.x < aheadGap)
        : units.find(o => o.side === u.side && o !== u && o.hp > 0 && o.x < u.x && u.x - o.x < aheadGap);

      if (dist > u.range) {
        if (!ahead) {
          u.x += dirX * u.speed * dt;
          u.walkPhase += dt * 7;
        }
        u.atkT = Math.max(0, u.atkT - dt);
      } else {
        u.atkT -= dt;
        if (u.atkT <= 0) {
          u.atkT = u.atkSpd;
          if (isBase) {
            if (u.side === 'player') enemyBaseHp -= u.dmg;
            else                     playerBaseHp -= u.dmg;
            spawnDmgFloater(u.dmg, baseTargetX, GROUND_Y - 90, u.side === 'player' ? '#F85149' : '#fcd34d');
          } else if (target) {
            if (u.range > 60) {
              projectiles.push({
                side: u.side, x: u.x, y: GROUND_Y - u.h * 0.6 - u.yOffset,
                vx: dirX * 360, dmg: u.dmg, life: 1.5, color: u.color,
              });
              muzzleFlashes.push({ x: u.x + dirX * 8, y: GROUND_Y - u.h * 0.6 - u.yOffset, t: 0.12, color: u.color });
            } else {
              target.hp -= u.dmg; target.hitFlash = 0.2;
              spawnDmgFloater(u.dmg, target.x, GROUND_Y - target.h - 6, '#ffd2c0');
              SFX.hit();
            }
          }
        }
      }
    }

    // Turret fire (player + enemy)
    fireTurrets('player', playerTurrets, dt);
    fireTurrets('enemy',  enemyTurrets,  dt);

    // Move projectiles
    for (const p of projectiles) {
      p.x += p.vx * dt;
      p.life -= dt;
      const targets = units.filter(u => u.side !== p.side && u.hp > 0);
      for (const u of targets) {
        if (Math.abs(u.x - p.x) < (u.w / 2 + 6)) {
          u.hp -= p.dmg; u.hitFlash = 0.2;
          spawnDmgFloater(p.dmg, u.x, GROUND_Y - u.h - 6, '#ffd2c0');
          SFX.hit();
          p.life = 0;
          break;
        }
      }
      if (p.life > 0) {
        if (p.side === 'player' && p.x >= ENEMY_BASE_X) {
          enemyBaseHp -= p.dmg;
          spawnDmgFloater(p.dmg, ENEMY_BASE_X + 10, GROUND_Y - 90, '#fcd34d');
          p.life = 0;
        } else if (p.side === 'enemy' && p.x <= PLAYER_BASE_X + BASE_W) {
          playerBaseHp -= p.dmg;
          spawnDmgFloater(p.dmg, PLAYER_BASE_X + BASE_W - 10, GROUND_Y - 90, '#F85149');
          p.life = 0;
        }
      }
    }
    projectiles = projectiles.filter(p => p.life > 0);

    // Tick strikes (meteors / bombs / etc.)
    for (const s of strikes) {
      if (s.delay > 0) { s.delay -= dt; continue; }
      s.y += s.speed * dt;
      if (s.y >= s.targetY && !s.exploded) {
        s.exploded = true;
        s.explodeT = 0.4;
        // AoE damage on opposing units in radius.
        for (const u of units) {
          if (u.side === s.side) continue;
          if (u.hp > 0 && Math.abs(u.x - s.x) < s.dmgRadius) {
            u.hp -= s.dmgEach; u.hitFlash = 0.3;
            spawnDmgFloater(s.dmgEach | 0, u.x, GROUND_Y - u.h - 6, '#ff7733');
          }
        }
        // Also damages base if very close
        if (s.side === 'player' && Math.abs(s.x - (ENEMY_BASE_X + BASE_W / 2)) < BASE_W) {
          enemyBaseHp -= s.dmgEach * 0.5;
        }
        // Explosion fragment particles
        for (let i = 0; i < 14; i++) {
          const a = Math.random() * Math.PI * 2;
          const sp = 120 + Math.random() * 240;
          particles.push({
            x: s.x, y: s.targetY,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp - 60,
            color: i % 3 === 0 ? '#ff8a4a' : i % 3 === 1 ? '#fcd34d' : '#ddd',
            size: 2 + Math.random() * 3,
            life: 0.6 + Math.random() * 0.5,
          });
        }
      }
      if (s.exploded) s.explodeT -= dt;
    }
    strikes = strikes.filter(s => !s.exploded || s.explodeT > 0);

    // Kill resolution
    for (const u of units) {
      if (u.hp <= 0 && !u._dead) {
        u._dead = true;
        // Toppling corpse: rotates and fades over ~0.8s
        deadUnits.push({
          x: u.x, y: GROUND_Y - u.h - u.yOffset,
          w: u.w, h: u.h, color: u.color,
          dir: u.side === 'player' ? 1 : -1,
          rot: 0, t: 0.9,
        });
        // Burst of body-color particles
        for (let i = 0; i < 8; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 60 + Math.random() * 90;
          particles.push({
            x: u.x, y: GROUND_Y - u.h * 0.5 - u.yOffset,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd - 40,
            color: u.color,
            size: 2 + Math.random() * 2,
            life: 0.5 + Math.random() * 0.4,
          });
        }
        if (u.side === 'enemy') {
          gold += u.gold;
          xp += u.xp;
          dropCoins(u.x, GROUND_Y - u.h, u.gold);
          SFX.kill();
        }
      }
    }
    units = units.filter(u => !u._dead);

    // Tick dead bodies (topple + fade)
    for (const d of deadUnits) {
      d.t -= dt;
      d.rot += d.dir * dt * 5;
    }
    deadUnits = deadUnits.filter(d => d.t > 0);

    // Tick particles
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 220 * dt;        // gravity
      p.life -= dt;
    }
    particles = particles.filter(p => p.life > 0);

    // Age banner tick
    if (ageBannerT > 0) ageBannerT -= dt;

    // Floater + coin tick
    for (const f of dmgFloaters) { f.t -= dt; f.y -= 28 * dt; }
    dmgFloaters = dmgFloaters.filter(f => f.t > 0);
    for (const f of goldFloaters) { f.t -= dt; f.y -= 26 * dt; }
    goldFloaters = goldFloaters.filter(f => f.t > 0);
    for (const m of muzzleFlashes) m.t -= dt;
    muzzleFlashes = muzzleFlashes.filter(m => m.t > 0);
    for (const c of coinDrops) {
      c.t -= dt;
      c.y -= 30 * dt;
      c.x += c.vx * dt;
      c.vx *= 0.94;
    }
    coinDrops = coinDrops.filter(c => c.t > 0);

    // End conditions
    if (playerBaseHp <= 0 && !gameOver) {
      gameOver = true; running = false; outcome = 'lose';
      SFX.defeat();
      showOverlay(false);
    } else if (enemyBaseHp <= 0 && !gameOver) {
      gameOver = true; running = false; outcome = 'win';
      SFX.victory();
      showOverlay(true);
    }

    renderHud();
  }

  function fireTurrets(side, slots, dt) {
    for (const t of slots) {
      if (!t) continue;
      t.atkT = Math.max(0, t.atkT - dt);
      if (t.atkT > 0) continue;
      // Find nearest opposing unit in range
      const enemies = units.filter(u => u.side !== side && u.hp > 0);
      const turretX = side === 'player' ? PLAYER_BASE_X + BASE_W * 0.85 : ENEMY_BASE_X + BASE_W * 0.15;
      let target = null, bestDist = Infinity;
      for (const u of enemies) {
        const d = Math.abs(u.x - turretX);
        if (d <= t.range && d < bestDist) { bestDist = d; target = u; }
      }
      if (target) {
        projectiles.push({
          side, x: turretX,
          y: GROUND_Y - 90,
          vx: (target.x > turretX ? 1 : -1) * 380,
          dmg: t.dmg, life: 1.2, color: t.color || '#fcd34d',
        });
        muzzleFlashes.push({ x: turretX, y: GROUND_Y - 90, t: 0.12, color: t.color });
        t.atkT = t.atkSpd;
      }
    }
  }

  function spawnDmgFloater(amount, x, y, color) {
    dmgFloaters.push({ amount: Math.max(1, amount | 0), x, y, color, t: 0.9 });
  }

  function dropCoins(x, y, total) {
    const coins = Math.min(6, Math.max(1, Math.round(Math.sqrt(total) / 2)));
    for (let i = 0; i < coins; i++) {
      coinDrops.push({
        x, y: y - 6,
        vx: (Math.random() - 0.5) * 40,
        t: 0.9,
      });
    }
    setTimeout(() => SFX.coin(), 60);
  }

  // ---- Rendering ----
  function loop(now) {
    const dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;
    update(dt);
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function draw() {
    const era = ERAS[playerEra];
    // Sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    grad.addColorStop(0, era.sky[0]);
    grad.addColorStop(1, era.sky[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH, GROUND_Y);

    // Distant hills (silhouette)
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    for (let x = 0; x <= WIDTH; x += 24) {
      const h = 30 + Math.sin(x * 0.011 + playerEra * 0.7) * 16 + Math.sin(x * 0.045) * 8;
      ctx.lineTo(x, GROUND_Y - h);
    }
    ctx.lineTo(WIDTH, GROUND_Y);
    ctx.closePath();
    ctx.fill();

    // Clouds (parallax)
    for (const c of bgClouds) drawCloud(c.x, c.y, c.r);

    // Ground (per-era color + speckle texture)
    drawGround(playerEra);

    // Bases (per-era art)
    drawBase(PLAYER_BASE_X, era.baseColor, era.icon, playerEra);
    const eEra = ERAS[enemyEra];
    drawBase(ENEMY_BASE_X, eEra.baseColor, eEra.icon, enemyEra);

    // Turrets (player + enemy) — small icons on the base ramparts
    drawTurrets(PLAYER_BASE_X, playerTurrets);
    drawTurrets(ENEMY_BASE_X,  enemyTurrets);

    // Base HP bars
    drawBaseHpBar(PLAYER_BASE_X, playerBaseHp, playerBaseMax, '#3FB950');
    drawBaseHpBar(ENEMY_BASE_X,  enemyBaseHp,  enemyBaseMax,  '#F85149');

    // Coin drops
    for (const c of coinDrops) {
      ctx.fillStyle = `rgba(252,211,77,${Math.max(0, c.t)})`;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Toppling corpses (behind live units so survivors march "over" them)
    for (const d of deadUnits) {
      const alpha = Math.max(0, d.t / 0.9);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(d.x, d.y + d.h);
      ctx.rotate(d.rot);
      ctx.fillStyle = d.color;
      ctx.fillRect(-d.w / 2, -d.h, d.w, d.h);
      ctx.restore();
    }

    // Units
    for (const u of units) drawUnit(u);

    // Particles (over units so explosions read clearly)
    for (const p of particles) {
      const a = Math.max(0, Math.min(1, p.life * 1.5));
      ctx.fillStyle = p.color;
      ctx.globalAlpha = a;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      ctx.globalAlpha = 1;
    }

    // Projectiles
    for (const p of projectiles) drawProjectile(p);

    // Muzzle flashes
    for (const m of muzzleFlashes) {
      ctx.fillStyle = `rgba(255,220,120,${m.t / 0.12 * 0.9})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 6 + (0.12 - m.t) * 40, 0, Math.PI * 2);
      ctx.fill();
    }

    // Strikes
    for (const s of strikes) {
      if (s.delay > 0) continue;
      if (s.exploded) {
        const k = 1 - s.explodeT / 0.4;
        ctx.fillStyle = `rgba(255,140,60,${(1 - k) * 0.9})`;
        ctx.beginPath();
        ctx.arc(s.x, s.targetY, 18 + k * 50, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255,240,180,${(1 - k) * 0.7})`;
        ctx.beginPath();
        ctx.arc(s.x, s.targetY, 8 + k * 20, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = s.color || '#ccc';
        ctx.font = '22px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(s.icon, s.x, s.y);
        // motion trail
        ctx.strokeStyle = 'rgba(255,200,120,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(s.x, s.y - 20); ctx.lineTo(s.x, s.y - 60); ctx.stroke();
      }
    }

    // Damage floaters
    for (const f of dmgFloaters) {
      ctx.fillStyle = f.color;
      ctx.globalAlpha = Math.max(0, f.t / 0.9);
      ctx.font = `700 13px 'JetBrains Mono', monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('-' + f.amount, f.x, f.y);
      ctx.globalAlpha = 1;
    }

    // Age flash overlay
    if (ageFlash > 0) {
      ctx.fillStyle = `rgba(252,211,77,${ageFlash * 0.4})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    // Era-up cinematic banner
    if (ageBannerT > 0) {
      const k = Math.min(1, (2.4 - ageBannerT) / 0.4);   // slide in
      const fade = ageBannerT < 0.6 ? ageBannerT / 0.6 : 1;
      const y = HEIGHT / 2 - 60 + (1 - k) * 30;
      ctx.save();
      ctx.globalAlpha = fade;
      // Backing
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, y - 6, WIDTH, 72);
      // Top + bottom borders
      const grad = ctx.createLinearGradient(0, y, WIDTH, y);
      grad.addColorStop(0,    'rgba(252,211,77,0)');
      grad.addColorStop(0.5,  'rgba(252,211,77,0.9)');
      grad.addColorStop(1,    'rgba(252,211,77,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, y - 6, WIDTH, 2);
      ctx.fillRect(0, y + 64, WIDTH, 2);
      // Text
      ctx.font = `800 28px 'Inter', sans-serif`;
      ctx.fillStyle = '#fcd34d';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ageBannerText, WIDTH / 2, y + 32);
      ctx.restore();
    }
  }

  // Per-era ground palette + speckle texture. The speckles are
  // deterministic per (era, x) so they don't flicker each frame.
  const GROUND_COLORS = ['#3a2818', '#1f2a1c', '#222024', '#1f231a', '#0e1226'];
  const GROUND_SPECKS = ['#5a4530', '#3a4a32', '#2c2a30', '#36402a', '#1c2a4a'];
  function drawGround(eraIdx) {
    const base = GROUND_COLORS[eraIdx] || '#1a1a14';
    const speck = GROUND_SPECKS[eraIdx] || '#2a2a20';
    ctx.fillStyle = base;
    ctx.fillRect(0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y);
    // Deterministic speckle (pseudo-random from x)
    for (let x = 4; x < WIDTH; x += 6) {
      const seed = (x * 9301 + eraIdx * 49297) | 0;
      const r = (Math.abs(Math.sin(seed)) * 1000) % 1;
      if (r < 0.35) {
        const y = GROUND_Y + 4 + ((seed * 7) % (HEIGHT - GROUND_Y - 8));
        ctx.fillStyle = speck;
        ctx.fillRect(x, y, 2, 2);
      }
    }
    // Top edge line
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath(); ctx.moveTo(0, GROUND_Y); ctx.lineTo(WIDTH, GROUND_Y); ctx.stroke();
    // Future era: faint glowing grid lines on the ground
    if (eraIdx === 4) {
      ctx.strokeStyle = 'rgba(110,196,255,0.18)';
      for (let x = 0; x < WIDTH; x += 24) {
        ctx.beginPath(); ctx.moveTo(x, GROUND_Y + 2); ctx.lineTo(x - 30, HEIGHT); ctx.stroke();
      }
    }
  }

  function drawCloud(x, y, r) {
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.arc(x + r * 0.7, y + 4, r * 0.8, 0, Math.PI * 2);
    ctx.arc(x - r * 0.7, y + 6, r * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBase(x, color, icon, eraIdx) {
    // Dispatch to era-specific art so each side reflects its era.
    if (eraIdx === undefined) eraIdx = 0;
    switch (eraIdx) {
      case 0: drawBaseStone(x, color); break;
      case 1: drawBaseMedieval(x, color); break;
      case 2: drawBaseIndustrial(x, color); break;
      case 3: drawBaseModern(x, color); break;
      case 4: drawBaseFuture(x, color); break;
      default: drawBaseMedieval(x, color);
    }
    // Era icon flag
    ctx.fillStyle = '#888';
    ctx.fillRect(x + BASE_W / 2 - 1, GROUND_Y - 132, 2, 38);
    ctx.fillStyle = color;
    ctx.fillRect(x + BASE_W / 2 + 1, GROUND_Y - 130, 18, 12);
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(icon, x + BASE_W / 2, GROUND_Y - 112);
  }

  function drawBaseStone(x, color) {
    // Wooden palisade — vertical sharpened logs
    ctx.fillStyle = color;
    ctx.fillRect(x, GROUND_Y - 60, BASE_W, 60);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x, GROUND_Y - 8, BASE_W, 8);
    const logs = 10;
    for (let i = 0; i < logs; i++) {
      const lw = (BASE_W - 6) / logs - 1;
      const lx = x + 3 + i * (lw + 1);
      ctx.fillStyle = color;
      ctx.fillRect(lx, GROUND_Y - 78, lw, 18);
      // Pointed top
      ctx.fillStyle = '#3a2a1a';
      ctx.beginPath();
      ctx.moveTo(lx, GROUND_Y - 78);
      ctx.lineTo(lx + lw / 2, GROUND_Y - 86);
      ctx.lineTo(lx + lw, GROUND_Y - 78);
      ctx.fill();
    }
    // Cave-mouth door
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.arc(x + BASE_W / 2, GROUND_Y - 20, 16, Math.PI, 0);
    ctx.lineTo(x + BASE_W / 2 + 16, GROUND_Y);
    ctx.lineTo(x + BASE_W / 2 - 16, GROUND_Y);
    ctx.closePath();
    ctx.fill();
  }

  function drawBaseMedieval(x, color) {
    // Castle: body + battlements + portcullis
    ctx.fillStyle = color;
    ctx.fillRect(x, GROUND_Y - 80, BASE_W, 80);
    // Stone-block hatching
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    for (let r = 0; r < 5; r++) {
      const yy = GROUND_Y - 80 + r * 16;
      ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + BASE_W, yy); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(x, GROUND_Y - 14, BASE_W, 14);
    // Battlements
    ctx.fillStyle = color;
    for (let i = 0; i < 6; i++) {
      const bw = (BASE_W - 10) / 6 - 2;
      ctx.fillRect(x + 5 + i * (bw + 2), GROUND_Y - 92, bw, 12);
    }
    // Portcullis
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x + BASE_W / 2 - 14, GROUND_Y - 42, 28, 42);
    ctx.strokeStyle = '#444';
    for (let i = 1; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(x + BASE_W / 2 - 14 + i * 7, GROUND_Y - 42); ctx.lineTo(x + BASE_W / 2 - 14 + i * 7, GROUND_Y); ctx.stroke();
    }
  }

  function drawBaseIndustrial(x, color) {
    // Brick factory: tall chimney + smoke
    ctx.fillStyle = color;
    ctx.fillRect(x, GROUND_Y - 70, BASE_W, 70);
    // Brick pattern
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let r = 0; r < 6; r++) {
      const yy = GROUND_Y - 70 + r * 11;
      const offset = (r % 2) * 8;
      for (let cx = -8; cx < BASE_W; cx += 16) {
        ctx.fillRect(x + cx + offset, yy + 4, 14, 1);
      }
    }
    // Chimney
    ctx.fillStyle = '#3a2a22';
    ctx.fillRect(x + BASE_W - 24, GROUND_Y - 110, 16, 40);
    ctx.fillStyle = '#222';
    ctx.fillRect(x + BASE_W - 25, GROUND_Y - 110, 18, 4);
    // Smoke puffs
    ctx.fillStyle = 'rgba(120,120,120,0.45)';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(x + BASE_W - 16 + Math.sin(performance.now() / 400 + i) * 6, GROUND_Y - 124 - i * 10, 6 + i * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Iron door
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x + 16, GROUND_Y - 38, 26, 38);
    // Windows
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = '#fcd34d';
      ctx.fillRect(x + 14 + i * 22, GROUND_Y - 62, 8, 8);
    }
  }

  function drawBaseModern(x, color) {
    // Concrete bunker: low, wide, with sandbags
    ctx.fillStyle = color;
    ctx.fillRect(x, GROUND_Y - 60, BASE_W, 60);
    // Sloped roof
    ctx.fillStyle = '#7a8a85';
    ctx.beginPath();
    ctx.moveTo(x - 4, GROUND_Y - 60);
    ctx.lineTo(x + BASE_W + 4, GROUND_Y - 60);
    ctx.lineTo(x + BASE_W - 10, GROUND_Y - 80);
    ctx.lineTo(x + 10, GROUND_Y - 80);
    ctx.closePath();
    ctx.fill();
    // Slit windows
    ctx.fillStyle = '#222';
    for (let i = 0; i < 3; i++) ctx.fillRect(x + 18 + i * 28, GROUND_Y - 36, 16, 6);
    // Sandbags
    ctx.fillStyle = '#8a7a55';
    for (let i = 0; i < 7; i++) {
      const sx = x - 4 + i * 16;
      ctx.beginPath();
      ctx.ellipse(sx, GROUND_Y - 4, 9, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Door
    ctx.fillStyle = '#1a2418';
    ctx.fillRect(x + BASE_W / 2 - 10, GROUND_Y - 30, 20, 30);
  }

  function drawBaseFuture(x, color) {
    // Sleek tech tower: gradient + glowing core
    const grad = ctx.createLinearGradient(x, GROUND_Y - 90, x, GROUND_Y);
    grad.addColorStop(0, color);
    grad.addColorStop(1, '#1a2050');
    ctx.fillStyle = grad;
    ctx.fillRect(x + 6, GROUND_Y - 90, BASE_W - 12, 90);
    // Antenna spire
    ctx.fillStyle = color;
    ctx.fillRect(x + BASE_W / 2 - 1, GROUND_Y - 116, 2, 26);
    ctx.fillStyle = '#ff6b35';
    ctx.beginPath(); ctx.arc(x + BASE_W / 2, GROUND_Y - 118, 3, 0, Math.PI * 2); ctx.fill();
    // Glowing core
    const pulse = 0.7 + Math.sin(performance.now() / 300) * 0.3;
    ctx.fillStyle = `rgba(110, 196, 255, ${pulse})`;
    ctx.beginPath();
    ctx.arc(x + BASE_W / 2, GROUND_Y - 56, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + BASE_W / 2, GROUND_Y - 56, 6, 0, Math.PI * 2);
    ctx.fill();
    // Side panels with vertical lights
    ctx.fillStyle = '#6ec4ff';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(x + 12 + i * 22, GROUND_Y - 86, 2, 64);
    }
    // Hover gap glow at base
    ctx.fillStyle = 'rgba(110, 196, 255, 0.45)';
    ctx.fillRect(x + 4, GROUND_Y - 4, BASE_W - 8, 4);
  }

  function drawTurrets(baseX, slots) {
    // 4 small turret silhouettes evenly on the rampart top
    for (let i = 0; i < TURRET_SLOTS; i++) {
      const t = slots[i];
      const x = baseX + 12 + (i + 0.5) * ((BASE_W - 24) / TURRET_SLOTS);
      const y = GROUND_Y - 96;
      if (!t) {
        // empty slot
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(x - 5, y, 10, 4);
        continue;
      }
      // turret base
      ctx.fillStyle = t.color || '#999';
      ctx.fillRect(x - 6, y - 8, 12, 12);
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(t.icon, x, y - 2);
    }
  }

  function drawBaseHpBar(baseX, hp, max, color) {
    const x = baseX, y = GROUND_Y - 144;
    const w = BASE_W, h = 8;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(x, y, w, h);
    const pct = Math.max(0, hp / max);
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, (w - 2) * pct, h - 2);
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(Math.max(0, Math.floor(hp)) + ' / ' + max, x + w / 2, y - 3);
  }

  // ---- Unit silhouettes ----
  function drawUnit(u) {
    const y = GROUND_Y - u.h - u.yOffset;
    const facing = u.side === 'player' ? 1 : -1;
    // Shadow under the unit (slightly squashed ellipse)
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(u.x, GROUND_Y - 1, u.w * 0.55, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body
    const bodyColor = u.hitFlash > 0 ? '#fff' : u.color;
    ctx.save();

    if (u.silhouette === 'vehicle') {
      // Tank-like: chassis + small turret
      ctx.fillStyle = bodyColor;
      ctx.fillRect(u.x - u.w / 2, y + 10, u.w, u.h - 14);
      // Tracks
      ctx.fillStyle = '#222';
      ctx.fillRect(u.x - u.w / 2 - 2, y + u.h - 8, u.w + 4, 6);
      // Turret cap
      ctx.fillStyle = bodyColor;
      ctx.fillRect(u.x - u.w / 4, y, u.w / 2, 12);
      // Gun barrel
      ctx.fillStyle = '#333';
      if (facing > 0) ctx.fillRect(u.x, y + 4, u.w / 2 + 4, 3);
      else            ctx.fillRect(u.x - u.w / 2 - 4, y + 4, u.w / 2 + 4, 3);
    } else if (u.silhouette === 'flier') {
      // Hover disc
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.ellipse(u.x, y + u.h * 0.4, u.w * 0.8, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      // Dome
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(u.x, y + u.h * 0.25, 6, Math.PI, Math.PI * 2);
      ctx.fill();
    } else if (u.silhouette === 'beast') {
      // Lower wider body + small head bump
      ctx.fillStyle = bodyColor;
      ctx.fillRect(u.x - u.w / 2, y + 4, u.w, u.h - 4);
      ctx.fillStyle = bodyColor;
      ctx.fillRect(u.x - 6, y - 4, 12, 10);
    } else {
      // Humanoid — era-specific silhouette details
      const swing = Math.sin(u.walkPhase) * 3;
      const era = UNITS[u.key] ? UNITS[u.key].era : 0;
      // Legs
      ctx.fillStyle = era >= 3 ? '#2a3320' : '#222';
      ctx.fillRect(u.x - 5, y + u.h - 10, 4, 10 + swing);
      ctx.fillRect(u.x + 1, y + u.h - 10, 4, 10 - swing);
      // Torso
      ctx.fillStyle = bodyColor;
      ctx.fillRect(u.x - u.w / 2 + 2, y + 6, u.w - 4, u.h - 18);
      // Era-specific armor/clothing detail
      if (era === 1) {
        // Medieval: square shoulder pauldrons
        ctx.fillStyle = '#dadce0';
        ctx.fillRect(u.x - u.w / 2 + 1, y + 5, 4, 5);
        ctx.fillRect(u.x + u.w / 2 - 5, y + 5, 4, 5);
      } else if (era === 2) {
        // Industrial: cross-belt / brown vest
        ctx.fillStyle = '#4a3528';
        ctx.fillRect(u.x - u.w / 2 + 2, y + 10, u.w - 4, 3);
      } else if (era === 3) {
        // Modern: tactical chest stripe + pocket
        ctx.fillStyle = '#3a4a30';
        ctx.fillRect(u.x - u.w / 2 + 2, y + 8, u.w - 4, 4);
        ctx.fillStyle = '#2a3520';
        ctx.fillRect(u.x - 2, y + 12, 4, 4);
      } else if (era === 4) {
        // Future: glowing accent lines
        ctx.fillStyle = '#6ec4ff';
        ctx.fillRect(u.x - u.w / 2 + 2, y + 8, u.w - 4, 1);
        ctx.fillRect(u.x - u.w / 2 + 2, y + u.h - 22, u.w - 4, 1);
      }
      // Head + headwear
      const headY = y + 4;
      if (era === 0) {
        // Caveman: shaggy hair
        ctx.fillStyle = '#3a2818';
        ctx.beginPath(); ctx.arc(u.x, headY - 1, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f0c089';
        ctx.beginPath(); ctx.arc(u.x, headY + 1, 4, 0, Math.PI * 2); ctx.fill();
      } else if (era === 1) {
        // Medieval: helmet
        ctx.fillStyle = '#bcc4cc';
        ctx.beginPath();
        ctx.arc(u.x, headY, 5.5, Math.PI, 0);
        ctx.lineTo(u.x + 5.5, headY + 3);
        ctx.lineTo(u.x - 5.5, headY + 3);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#222';
        ctx.fillRect(u.x - 4, headY, 8, 2);  // visor slit
      } else if (era === 2) {
        // Industrial: bowler / brown hat + face
        ctx.fillStyle = '#f0c089';
        ctx.beginPath(); ctx.arc(u.x, headY + 1, 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3a2818';
        ctx.fillRect(u.x - 5, headY - 3, 10, 2);
        ctx.fillRect(u.x - 6, headY - 1, 12, 1);
      } else if (era === 3) {
        // Modern: combat helmet
        ctx.fillStyle = '#f0c089';
        ctx.beginPath(); ctx.arc(u.x, headY + 1, 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3a4a30';
        ctx.beginPath();
        ctx.arc(u.x, headY - 1, 5.5, Math.PI, 0);
        ctx.lineTo(u.x + 5.5, headY + 1);
        ctx.lineTo(u.x - 5.5, headY + 1);
        ctx.closePath();
        ctx.fill();
      } else if (era === 4) {
        // Future: glowing visored helmet
        ctx.fillStyle = '#222a44';
        ctx.beginPath(); ctx.arc(u.x, headY, 5.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#6ec4ff';
        ctx.fillRect(u.x - 4, headY, 8, 2);
        // antenna
        ctx.fillStyle = '#6ec4ff';
        ctx.fillRect(u.x - 0.5, headY - 9, 1, 4);
      }
      // Weapon (era-styled)
      ctx.fillStyle = era >= 3 ? '#222831' : era >= 2 ? '#3a3a3a' : '#332218';
      if (u.range > 60) {
        ctx.fillRect(u.x + facing * 3, y + 10, facing * 11, era >= 2 ? 3 : 2);
        if (era === 4) {
          // Energy core glow at muzzle
          ctx.fillStyle = '#6ec4ff';
          ctx.fillRect(u.x + facing * 13, y + 10, facing * 2, 3);
        }
      } else {
        ctx.fillRect(u.x + facing * 3, y + 8, facing * 7, 3);
      }
    }
    ctx.restore();

    // Icon overhead (small)
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(u.icon, u.x, y - 8);

    // HP bar
    const barW = u.w + 6;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(u.x - barW / 2, y - 18, barW, 3);
    const pct = Math.max(0, u.hp / u.hpMax);
    ctx.fillStyle = u.side === 'player' ? '#3FB950' : '#F85149';
    ctx.fillRect(u.x - barW / 2 + 0.5, y - 17.5, (barW - 1) * pct, 2);
  }

  function drawProjectile(p) {
    const dir = Math.sign(p.vx) || 1;
    // Era-ish render based on projectile size / color.
    // Bright laser-ish for high-tech colors, otherwise arrow/bullet.
    if (p.color === '#6ec4ff' || p.color === '#ff90ee') {
      // Laser beam
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.shadowColor = p.color; ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(p.x - dir * 18, p.y);
      ctx.lineTo(p.x + dir * 4,  p.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (p.dmg >= 100) {
      // Heavy round / shell
      ctx.fillStyle = '#444';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#888';
      ctx.fillRect(p.x - dir * 4, p.y - 1, dir * 4, 2);
    } else if (p.dmg >= 30) {
      // Arrow
      ctx.strokeStyle = '#5a3a22';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x - dir * 10, p.y); ctx.lineTo(p.x + dir * 4, p.y);
      ctx.stroke();
      // Arrowhead
      ctx.fillStyle = '#ccc';
      ctx.beginPath();
      ctx.moveTo(p.x + dir * 4, p.y);
      ctx.lineTo(p.x + dir * -1, p.y - 3);
      ctx.lineTo(p.x + dir * -1, p.y + 3);
      ctx.closePath();
      ctx.fill();
    } else {
      // Bullet / stone
      ctx.fillStyle = p.color || '#fcd34d';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(252,211,77,0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.x - dir * 8, p.y); ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
  }

  // ---- HUD + panels ----
  function renderHud() {
    const eraEl  = document.getElementById('aow-era');
    const goldEl = document.getElementById('aow-gold');
    const xpEl   = document.getElementById('aow-xp');
    const xpBar  = document.getElementById('aow-xp-bar');
    const baseEl = document.getElementById('aow-base-hp');
    const enemyEl= document.getElementById('aow-enemy-hp');
    const specEl = document.getElementById('aow-special-btn');
    const ageBtn = document.getElementById('aow-ageup-btn');
    const era = ERAS[playerEra];
    if (eraEl) eraEl.textContent = era.icon + ' ' + era.name;
    if (goldEl) goldEl.textContent = '$' + Math.floor(gold);
    if (xpEl) {
      if (playerEra >= ERAS.length - 1) xpEl.textContent = xp + ' XP · MAX AGE';
      else xpEl.textContent = `${xp} / ${era.upXP} XP`;
    }
    if (xpBar) {
      const pct = playerEra >= ERAS.length - 1 ? 100 : Math.min(100, (xp / era.upXP) * 100);
      xpBar.style.width = pct + '%';
    }
    if (baseEl)  baseEl.textContent  = `${Math.max(0, Math.floor(playerBaseHp))} / ${playerBaseMax}`;
    if (enemyEl) enemyEl.textContent = `${Math.max(0, Math.floor(enemyBaseHp))} / ${enemyBaseMax}`;
    if (ageBtn) {
      if (playerEra >= ERAS.length - 1) {
        ageBtn.textContent = '🌟 Max Age';
        ageBtn.disabled = true;
      } else {
        ageBtn.textContent = `⬆️ Age Up → ${ERAS[playerEra + 1].name} (${era.upXP} XP)`;
        ageBtn.disabled = xp < era.upXP;
      }
    }
    if (specEl) {
      const spec = ERAS[playerEra].special;
      if (specialReadyT > 0) {
        specEl.textContent = `${spec.icon} ${spec.name} (${Math.ceil(specialReadyT)}s)`;
        specEl.disabled = true;
      } else {
        specEl.textContent = `${spec.icon} ${spec.name} — READY`;
        specEl.disabled = false;
      }
    }

    // Live cooldown bars on spawn buttons
    const list = document.getElementById('aow-spawn-list');
    if (list) {
      let i = 0;
      for (let e = 0; e <= playerEra; e++) {
        for (const key of unitsForEra(e)) {
          const def = UNITS[key];
          const btn = list.children[i];
          if (btn) {
            const cd = spawnCooldowns[key] || 0;
            const cdMax = Math.max(0.4, def.cost / 600);
            btn.style.setProperty('--aow-cd', cd > 0 ? ((1 - cd / cdMax) * 100) + '%' : '100%');
            btn.classList.toggle('aow-not-afford', gold < def.cost);
            btn.classList.toggle('aow-on-cd', cd > 0);
          }
          i++;
        }
      }
    }
  }

  function renderSpawnPanel() {
    const list = document.getElementById('aow-spawn-list');
    if (!list) return;
    list.innerHTML = '';
    let idx = 1;
    for (let e = 0; e <= playerEra; e++) {
      for (const key of unitsForEra(e)) {
        const def = UNITS[key];
        const btn = document.createElement('button');
        btn.className = 'aow-spawn-btn';
        btn.innerHTML = `
          <span class="aow-spawn-key">${idx}</span>
          <span class="aow-spawn-icon">${def.icon}</span>
          <span class="aow-spawn-info">
            <span class="aow-spawn-name">${def.name}</span>
            <span class="aow-spawn-stats">HP ${def.hp} · DMG ${def.dmg}</span>
          </span>
          <span class="aow-spawn-cost">$${def.cost}</span>
          <span class="aow-spawn-cd"></span>
        `;
        btn.onclick = () => tryPlayerSpawn(key);
        list.appendChild(btn);
        idx++;
      }
    }
  }

  function renderTurretPanel() {
    const list = document.getElementById('aow-turret-list');
    if (!list) return;
    list.innerHTML = '';
    for (let i = 0; i < TURRET_SLOTS; i++) {
      const current = playerTurrets[i];
      const next = current ? Math.min(playerEra, current.era + 1) : 0;
      const nextDef = (!current || current.era < playerEra) ? TURRETS[next] : null;
      const slot = document.createElement('div');
      slot.className = 'aow-turret-slot';
      if (current) {
        slot.innerHTML = `
          <span class="aow-turret-current">${current.icon}<small>${current.name}</small></span>
          ${nextDef ? `<button class="aow-turret-buy" data-slot="${i}" data-era="${next}">⬆️ ${nextDef.icon} $${nextDef.cost}</button>` : '<span class="aow-turret-maxed">MAX</span>'}
        `;
      } else {
        const def = TURRETS[Math.min(playerEra, TURRETS.length - 1)];
        slot.innerHTML = `
          <span class="aow-turret-empty">empty slot</span>
          <button class="aow-turret-buy" data-slot="${i}" data-era="${Math.min(playerEra, TURRETS.length - 1)}">${def.icon} ${def.name} · $${def.cost}</button>
        `;
      }
      list.appendChild(slot);
    }
    list.querySelectorAll('.aow-turret-buy').forEach(b => {
      b.addEventListener('click', () => tryBuyTurret(+b.dataset.slot, +b.dataset.era));
    });
  }

  // ---- Overlay ----
  function hideOverlay() {
    const ov = document.getElementById('aow-overlay');
    if (ov) ov.style.display = 'none';
  }
  function showOverlay(won) {
    const ov = document.getElementById('aow-overlay');
    if (!ov) return;
    ov.style.display = 'flex';
    ov.innerHTML = `
      <h2 style="${won ? 'background:linear-gradient(135deg,#3FB950,#fcd34d);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent' : 'color:#F85149'}">
        ${won ? '🏆 VICTORY' : '💀 DEFEAT'}
      </h2>
      <p>${won ? 'You wiped the enemy base.' : 'Your base has fallen.'}</p>
      <p style="font-size:12px; color: var(--text-dim)">Press SPACE or click below to restart</p>
    `;
  }

  function destroy() {
    cancelAnimationFrame(rafId);
    running = false;
  }

  return { init, start: reset, destroy };
})();
