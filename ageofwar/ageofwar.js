/* ============================================
   AGE OF WAR — Side-scrolling lane battler
   Inspired by Max Games' classic.
   Spawn units, push the enemy base, age up to
   unlock stronger units, build turrets, fire
   ultimates. Last base standing wins.
   ============================================ */

const AgeOfWarGame = (() => {
  // ---- Stage ----
  const WIDTH  = 1280;
  const HEIGHT = 560;
  const GROUND_Y = HEIGHT - 90;
  const BASE_W = 150;
  const PLAYER_BASE_X = 14;
  const ENEMY_BASE_X  = WIDTH - BASE_W - 14;

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
    club:     { era: 0, name: 'Clubman',    icon: '🦴', sprite: '🧌',  cost: 25,   hp: 60,   dmg: 9,   range: 26,  atkSpd: 0.85, speed: 42, color: '#b07040', xp: 12,  gold: 16,  silhouette: 'humanoid' },
    sling:    { era: 0, name: 'Slinger',    icon: '🪃', sprite: '🧙',  cost: 55,   hp: 32,   dmg: 16,  range: 145, atkSpd: 1.2,  speed: 36, color: '#8a5028', xp: 16,  gold: 26,  silhouette: 'humanoid' },
    dino:     { era: 0, name: 'Dino Rider', icon: '🦖', sprite: '🦖',  cost: 110,  hp: 180,  dmg: 24,  range: 30,  atkSpd: 1.0,  speed: 38, color: '#5d8a4a', xp: 30,  gold: 55,  silhouette: 'beast' },

    // Medieval
    swordsman:{ era: 1, name: 'Swordsman',  icon: '⚔️', sprite: '🤺',  cost: 130,  hp: 180,  dmg: 28,  range: 28,  atkSpd: 0.75, speed: 46, color: '#a0a0c0', xp: 38,  gold: 60,  silhouette: 'humanoid' },
    archer:   { era: 1, name: 'Archer',     icon: '🏹', sprite: '🏹',  cost: 200,  hp: 90,   dmg: 48,  range: 200, atkSpd: 1.3,  speed: 40, color: '#b5985a', xp: 48,  gold: 80,  silhouette: 'humanoid' },
    knight:   { era: 1, name: 'Knight',     icon: '🐴', sprite: '🐎',  cost: 380,  hp: 480,  dmg: 50,  range: 30,  atkSpd: 1.0,  speed: 50, color: '#9a9bc5', xp: 90,  gold: 150, silhouette: 'beast' },

    // Industrial
    rifleman: { era: 2, name: 'Rifleman',   icon: '🔫', sprite: '💂',  cost: 380,  hp: 270,  dmg: 90,  range: 230, atkSpd: 0.85, speed: 42, color: '#5d7b3a', xp: 110, gold: 180, silhouette: 'humanoid' },
    cannon:   { era: 2, name: 'Cannoneer',  icon: '💣', sprite: '🧨',  cost: 620,  hp: 380,  dmg: 170, range: 270, atkSpd: 1.7,  speed: 32, color: '#4a4030', xp: 170, gold: 290, silhouette: 'humanoid' },
    tank1:    { era: 2, name: 'Steam Tank', icon: '🚂', sprite: '🚂',  cost: 1100, hp: 950,  dmg: 200, range: 60,  atkSpd: 1.1,  speed: 30, color: '#6b5848', xp: 320, gold: 540, silhouette: 'vehicle' },

    // Modern
    soldier:  { era: 3, name: 'Soldier',    icon: '🪖', sprite: '🪖',  cost: 850,  hp: 480,  dmg: 200, range: 240, atkSpd: 0.7,  speed: 44, color: '#5a7a45', xp: 240, gold: 410, silhouette: 'humanoid' },
    sniper:   { era: 3, name: 'Sniper',     icon: '🎯', sprite: '🥷',  cost: 1500, hp: 240,  dmg: 520, range: 380, atkSpd: 2.4,  speed: 38, color: '#7a7a4a', xp: 420, gold: 700, silhouette: 'humanoid' },
    tank2:    { era: 3, name: 'Tank',       icon: '🪖', sprite: '🚜',  cost: 2400, hp: 2000, dmg: 380, range: 100, atkSpd: 1.0,  speed: 32, color: '#4d5a3a', xp: 700, gold: 1180, silhouette: 'vehicle' },

    // Future
    laser:    { era: 4, name: 'Laser Trooper', icon: '🪖', sprite: '👽',  cost: 1700, hp: 700,  dmg: 360, range: 280, atkSpd: 0.55, speed: 48, color: '#6ec4ff', xp: 540, gold: 920,  silhouette: 'humanoid' },
    mech:     { era: 4, name: 'Mech',          icon: '🤖', sprite: '🤖',  cost: 3500, hp: 2800, dmg: 540, range: 110, atkSpd: 0.85, speed: 36, color: '#a89cff', xp: 1100,gold: 2000, silhouette: 'vehicle' },
    flier:    { era: 4, name: 'Hover',         icon: '🛸', sprite: '🛸',  cost: 5500, hp: 1500, dmg: 820, range: 320, atkSpd: 1.4,  speed: 56, color: '#ff90ee', xp: 1600,gold: 3200, silhouette: 'flier' },
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
  const specialCooldownMax = 20;
  let goldFloaters = [];
  let dmgFloaters = [];
  let muzzleFlashes = [];
  let strikes = [];                // air-strike effects (meteor / arrows / bombs)
  let coinDrops = [];              // visual coins after kills
  let ageFlash = 0;                // 1 → 0 right after aging up
  let ageBannerT = 0;              // seconds banner stays visible
  let ageBannerText = '';
  let bgClouds = [];               // parallax cloud x positions
  let ambient = [];                // era-themed background particles (birds, smoke, snow, neon)
  let deadUnits = [];              // { x, y, w, h, color, rot, vrot, t } toppling corpses
  let particles = [];              // { x, y, vx, vy, color, life, size }
  let playerTurrets = [null, null, null, null];  // each: { era, atkT, ...TURRETS[era] }
  let enemyTurrets  = [null, null, null, null];

  // ---- Difficulty ----
  // Tuned to be more forgiving on Easy/Normal: Easy gives ~2x slower spawns,
  // weaker enemies. Hard/Insane keep the original challenge curve.
  const DIFFICULTIES = {
    easy:   { label: 'Easy',   spawnMult: 1.8, dmgMult: 0.65, hpMult: 0.75, color: '#3FB950' },
    normal: { label: 'Normal', spawnMult: 1.2, dmgMult: 0.90, hpMult: 0.95, color: '#58A6FF' },
    hard:   { label: 'Hard',   spawnMult: 0.8, dmgMult: 1.20, hpMult: 1.15, color: '#fcd34d' },
    insane: { label: 'Insane', spawnMult: 0.55, dmgMult: 1.55, hpMult: 1.45, color: '#F85149' },
  };
  let difficulty = 'normal';

  // ---- Combo / streak ----
  let combo = 0;
  let comboT = 0;                 // seconds until streak breaks
  const COMBO_WINDOW = 3.0;
  let comboBest = 0;              // best in current run
  // Bonus multiplier: 1.0 at combo 0, +4% per kill stacking up to +200% (3x).
  // Lowered from 5%/5x — runaway combos were trivializing late waves.
  function comboMult() { return Math.min(3, 1 + combo * 0.04); }

  // ---- Run stats (shown on win/lose + drive achievements) ----
  const runStats = { kills: 0, gold: 0, time: 0, specialsFired: 0, coinsCollected: 0, biggestCombo: 0, agesReached: 0, turretsBuilt: 0, heroesSummoned: 0 };

  // ---- Achievements ----
  // Persisted in localStorage across runs. Earned during play, toast
  // pops in the corner. Full list lives in a modal.
  const ACHIEVEMENTS = [
    { id: 'first_blood',  icon: '⚔️',  title: 'First Blood',     desc: 'Kill an enemy unit.' },
    { id: 'first_age',    icon: '🏰',  title: 'Evolving',         desc: 'Reach the Medieval Age.' },
    { id: 'industrial',   icon: '🏭',  title: 'Industrialist',    desc: 'Reach the Industrial Age.' },
    { id: 'modern',       icon: '🪖',  title: 'Modern Warfare',   desc: 'Reach the Modern Age.' },
    { id: 'max_age',      icon: '🚀',  title: 'Singularity',      desc: 'Reach the Future Age.' },
    { id: 'streak_10',    icon: '🔥',  title: 'Heating Up',       desc: '10-kill combo streak.' },
    { id: 'streak_25',    icon: '💀',  title: 'Godlike',          desc: '25-kill combo streak.' },
    { id: 'rich',         icon: '💰',  title: 'Tycoon',           desc: 'Hold $5,000 at once.' },
    { id: 'turret_full',  icon: '🛡️',  title: 'Fortified',        desc: 'Fill all 4 turret slots.' },
    { id: 'hero_summon',  icon: '🦸',  title: 'A Legend Arrives', desc: 'Summon your first Hero.' },
    { id: 'special_5',    icon: '💥',  title: 'Pyromaniac',       desc: 'Cast 5 specials in one run.' },
    { id: 'win_easy',     icon: '🏆',  title: 'Warmup',           desc: 'Win on Easy or higher.' },
    { id: 'win_hard',     icon: '⚜️',  title: 'Tactician',        desc: 'Win on Hard.' },
    { id: 'win_insane',   icon: '👑',  title: 'Unstoppable',      desc: 'Win on Insane.' },
    { id: 'kill_100',     icon: '🧨',  title: 'Slayer',           desc: '100 kills in one run.' },
    { id: 'collect_50',   icon: '🪙',  title: 'Collector',        desc: 'Click 50 coins in one run.' },
  ];
  let earnedAchievements = {};
  function loadAchievements() {
    try {
      const raw = localStorage.getItem('aow-achievements');
      earnedAchievements = raw ? JSON.parse(raw) : {};
    } catch { earnedAchievements = {}; }
  }
  function maybeShowWelcome() {
    let seen = false;
    try { seen = localStorage.getItem('aow-welcome-seen') === '1'; } catch {}
    if (seen) return;
    const modal = document.getElementById('aow-welcome-modal');
    const btn = document.getElementById('aow-welcome-close');
    if (!modal || !btn) return;
    modal.style.display = 'flex';
    const close = () => {
      modal.style.display = 'none';
      try { localStorage.setItem('aow-welcome-seen', '1'); } catch {}
    };
    btn.addEventListener('click', close, { once: true });
    document.addEventListener('keydown', function onEsc(e) {
      if (modal.style.display === 'none') { document.removeEventListener('keydown', onEsc); return; }
      if (e.key === 'Escape' || e.key === 'Enter') { close(); document.removeEventListener('keydown', onEsc); }
    });
  }
  function saveAchievements() {
    try { localStorage.setItem('aow-achievements', JSON.stringify(earnedAchievements)); } catch {}
  }
  function unlock(id) {
    if (earnedAchievements[id]) return;
    const a = ACHIEVEMENTS.find(x => x.id === id);
    if (!a) return;
    earnedAchievements[id] = Date.now();
    saveAchievements();
    showAchievementToast(a);
    SFX.ageUp();
  }
  function showAchievementToast(a) {
    const root = document.getElementById('aow-achievement-toasts');
    if (!root) return;
    const el = document.createElement('div');
    el.className = 'aow-ach-toast';
    el.innerHTML = `
      <div class="aow-ach-toast-icon">${a.icon}</div>
      <div class="aow-ach-toast-body">
        <div class="aow-ach-toast-eyebrow">Achievement Unlocked</div>
        <div class="aow-ach-toast-title">${a.title}</div>
        <div class="aow-ach-toast-desc">${a.desc}</div>
      </div>
    `;
    root.appendChild(el);
    setTimeout(() => el.classList.add('out'), 3800);
    setTimeout(() => el.remove(), 4200);
  }
  function checkAchievementsDuringRun() {
    if (combo >= 10) unlock('streak_10');
    if (combo >= 25) unlock('streak_25');
    if (gold >= 5000) unlock('rich');
    if (playerTurrets.every(t => t)) unlock('turret_full');
    if (runStats.kills >= 100) unlock('kill_100');
    if (runStats.coinsCollected >= 50) unlock('collect_50');
    if (runStats.specialsFired >= 5) unlock('special_5');
  }
  function renderAchievementsModal() {
    const list = document.getElementById('aow-ach-list');
    const prog = document.getElementById('aow-ach-progress');
    if (!list) return;
    list.innerHTML = '';
    let earned = 0;
    for (const a of ACHIEVEMENTS) {
      const got = !!earnedAchievements[a.id];
      if (got) earned++;
      const row = document.createElement('div');
      row.className = 'aow-ach-row' + (got ? ' earned' : '');
      row.innerHTML = `
        <span class="aow-ach-row-icon">${a.icon}</span>
        <div class="aow-ach-row-text">
          <div class="aow-ach-row-title">${a.title}</div>
          <div class="aow-ach-row-desc">${a.desc}</div>
        </div>
        ${got ? '<span class="aow-ach-row-check">✓</span>' : ''}
      `;
      list.appendChild(row);
    }
    if (prog) prog.textContent = `${earned} / ${ACHIEVEMENTS.length}`;
  }

  // ---- Hero summons ----
  // One legendary unit per era, big cost + cooldown, dramatic entrance.
  const HEROES = [
    { era: 0, key: 'hero_grog',    name: 'Grog the Stomper', icon: '🦣', sprite: '🦣',  cost: 600,  hp: 1200, dmg: 80,  range: 28,  atkSpd: 0.6, speed: 38, color: '#7a4a22', xp: 200, gold: 400, silhouette: 'beast',  cd: 55 },
    { era: 1, key: 'hero_paladin', name: 'Sir Lancelot',     icon: '🛡️', sprite: '⚔️',  cost: 1400, hp: 2400, dmg: 130, range: 28,  atkSpd: 0.7, speed: 40, color: '#dadce0', xp: 400, gold: 800, silhouette: 'humanoid', cd: 65 },
    { era: 2, key: 'hero_general', name: 'The General',      icon: '🎖️', sprite: '🎖️',  cost: 3200, hp: 3600, dmg: 240, range: 240, atkSpd: 0.9, speed: 40, color: '#5d7b3a', xp: 700, gold: 1500, silhouette: 'humanoid', cd: 75 },
    { era: 3, key: 'hero_seal',    name: 'Black Ops',         icon: '🎯', sprite: '🕵',   cost: 7000, hp: 4500, dmg: 480, range: 320, atkSpd: 1.6, speed: 42, color: '#2a3520', xp: 1300, gold: 2600, silhouette: 'humanoid', cd: 85 },
    { era: 4, key: 'hero_titan',   name: 'Titan',            icon: '⚡', sprite: '👹',  cost: 15000, hp: 8000, dmg: 900, range: 140, atkSpd: 0.7, speed: 38, color: '#7ec8ff', xp: 2800, gold: 5500, silhouette: 'vehicle', cd: 100 },
  ];
  let heroReadyT = 0;   // seconds until current era's hero is available
  let currentHeroCd = 0;

  // ---- Wave system ----
  // Enemy spawns are grouped into waves. Every 5th wave is a boss wave
  // with a single, beefy enemy that drops a large coin pile.
  let waveNum = 1;
  let waveEnemiesRemaining = 4;
  let waveBreatherT = 0;      // seconds remaining in the gap between waves
  let bossWaveActive = false;
  let bossKilledThisWave = false;
  let killFeed = [];          // recent kill entries floating up
  function isBossWave(n) { return n > 0 && n % 5 === 0; }

  function heroForEra(era) { return HEROES[era]; }
  function trySummonHero() {
    if (gameOver) return;
    const h = heroForEra(playerEra);
    if (!h) return;
    if (heroReadyT > 0) return;
    if (gold < h.cost) return;
    gold -= h.cost;
    // Register a synthetic unit entry from the hero stats so the
    // shared spawnUnit path covers it. Hero gets its own dispatch.
    UNITS[h.key] = UNITS[h.key] || {
      era: h.era, name: h.name, icon: h.icon, sprite: h.sprite, cost: h.cost,
      hp: h.hp, dmg: h.dmg, range: h.range, atkSpd: h.atkSpd,
      speed: h.speed, color: h.color, xp: h.xp, gold: h.gold,
      silhouette: h.silhouette, isHero: true,
    };
    spawnUnit('player', h.key);
    runStats.heroesSummoned++;
    unlock('hero_summon');
    heroReadyT = h.cd;
    currentHeroCd = h.cd;
    SFX.special();
    shake(14, 0.5);
    ageFlash = Math.max(ageFlash, 0.8);
    // Spawn ring of light particles around the player base
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2;
      particles.push({
        x: PLAYER_BASE_X + BASE_W + 18,
        y: GROUND_Y - 40,
        vx: Math.cos(a) * 140,
        vy: Math.sin(a) * 140,
        color: '#fcd34d',
        size: 3,
        life: 0.7,
      });
    }
    renderHud();
  }

  // ---- Screen shake ----
  let shakeT = 0;
  let shakeMag = 0;
  function shake(mag, dur) {
    if (mag > shakeMag) shakeMag = mag;
    if (dur > shakeT)   shakeT   = dur;
  }

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
    try {
      const saved = (typeof Utils !== 'undefined' && Utils.store && Utils.store.getRaw('aow-difficulty'))
                  || localStorage.getItem('aow-difficulty');
      if (saved && DIFFICULTIES[saved]) difficulty = saved;
    } catch {}
    seedClouds();
    seedAmbient(0);
    preloadSprites();
    loadAchievements();
    reset();
    bindControls();
    maybeShowWelcome();
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

  // Spawn era-themed ambient background particles (birds, smoke, snow, neon).
  // Called on init + on every age-up so the scene's flavor matches the era.
  function seedAmbient(eraIdx) {
    ambient = [];
    if (eraIdx === 0) {
      // Stone: small dust motes drifting right
      for (let i = 0; i < 10; i++) ambient.push({
        type: 'dust', x: Math.random() * WIDTH, y: GROUND_Y - 40 - Math.random() * 80,
        vx: 8 + Math.random() * 14, vy: -2 + Math.random() * 4,
        size: 1 + Math.random() * 1.5, color: 'rgba(220,170,100,0.4)',
      });
    } else if (eraIdx === 1) {
      // Medieval: birds gliding across the sky
      for (let i = 0; i < 4; i++) ambient.push({
        type: 'bird', x: Math.random() * WIDTH, y: 40 + Math.random() * 100,
        vx: 30 + Math.random() * 20, phase: Math.random() * Math.PI * 2,
      });
    } else if (eraIdx === 2) {
      // Industrial: rising smog plumes
      for (let i = 0; i < 14; i++) ambient.push({
        type: 'smog', x: Math.random() * WIDTH, y: GROUND_Y - Math.random() * GROUND_Y * 0.5,
        vx: 4 + Math.random() * 6, vy: -8 - Math.random() * 5,
        size: 4 + Math.random() * 6, color: 'rgba(120,110,90,0.30)',
      });
    } else if (eraIdx === 3) {
      // Modern: hi-altitude jet contrails
      for (let i = 0; i < 2; i++) ambient.push({
        type: 'jet', x: -120 - Math.random() * 200, y: 40 + Math.random() * 50,
        vx: 80 + Math.random() * 40,
      });
    } else if (eraIdx === 4) {
      // Future: floating neon hex particles
      for (let i = 0; i < 16; i++) ambient.push({
        type: 'hex', x: Math.random() * WIDTH, y: 30 + Math.random() * (GROUND_Y - 60),
        vx: 6 + Math.random() * 10, vy: -3 + Math.random() * 6,
        size: 2 + Math.random() * 2, color: 'rgba(110,196,255,0.55)',
        bob: Math.random() * Math.PI * 2,
      });
    }
  }

  function tickAmbient(dt) {
    for (const p of ambient) {
      p.x += p.vx * dt;
      if (p.type === 'bird') {
        p.phase += dt * 4;
        if (p.x > WIDTH + 40) { p.x = -40; p.y = 40 + Math.random() * 100; }
      } else if (p.type === 'jet') {
        if (p.x > WIDTH + 200) { p.x = -200 - Math.random() * 200; p.y = 40 + Math.random() * 50; }
      } else {
        p.y += (p.vy || 0) * dt;
        if (p.type === 'hex') p.bob += dt * 2;
        if (p.x > WIDTH + 20 || p.y < -20) {
          p.x = -20; p.y = GROUND_Y - 20 - Math.random() * GROUND_Y * 0.6;
        }
      }
    }
  }

  function drawAmbient() {
    for (const p of ambient) {
      if (p.type === 'bird') {
        // Simple "M" shape that flaps via phase
        const flap = Math.sin(p.phase) * 3;
        ctx.strokeStyle = 'rgba(40,40,50,0.7)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(p.x - 6, p.y + flap);
        ctx.lineTo(p.x - 2, p.y - 2);
        ctx.lineTo(p.x + 2, p.y - 2);
        ctx.lineTo(p.x + 6, p.y + flap);
        ctx.stroke();
      } else if (p.type === 'jet') {
        // Tiny silhouette + trailing contrail
        ctx.fillStyle = 'rgba(180,180,200,0.85)';
        ctx.fillRect(p.x - 3, p.y - 1, 6, 2);
        ctx.fillStyle = 'rgba(200,200,210,0.30)';
        ctx.fillRect(p.x - 80, p.y - 0.5, 80, 1);
      } else if (p.type === 'hex') {
        ctx.fillStyle = p.color;
        const yy = p.y + Math.sin(p.bob) * 2;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const xi = p.x + Math.cos(a) * p.size;
          const yi = yy + Math.sin(a) * p.size;
          if (i === 0) ctx.moveTo(xi, yi); else ctx.lineTo(xi, yi);
        }
        ctx.closePath();
        ctx.fill();
      } else {
        // dust / smog
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function reset() {
    running = true;
    gameOver = false;
    outcome = null;
    playerEra = 0;
    enemyEra = 0;
    gold = 140;
    xp = 0;
    playerBaseHp = playerBaseMax = 1500;
    enemyBaseHp  = enemyBaseMax  = 1500;
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
    combo = 0; comboT = 0; comboBest = 0;
    runStats.kills = 0; runStats.gold = 0; runStats.time = 0;
    runStats.specialsFired = 0; runStats.coinsCollected = 0;
    runStats.biggestCombo = 0; runStats.agesReached = 0;
    runStats.turretsBuilt = 0; runStats.heroesSummoned = 0;
    heroReadyT = 6;   // first summon available 6s in
    currentHeroCd = HEROES[0].cd;
    waveNum = 1;
    waveEnemiesRemaining = 3;     // gentler first wave
    waveBreatherT = 4.0;          // give the player ~4s to orient before enemies surge
    bossWaveActive = false;
    bossKilledThisWave = false;
    killFeed = [];
    shakeT = 0; shakeMag = 0;
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
    // Per-silhouette sizing — significantly larger than the original
    // so units are legible on phone-sized canvases (reference: Max
    // Games' Age of War, where units occupy ~25-30% of canvas height).
    // Doesn't affect balance — only display size and visual spacing.
    const w = def.silhouette === 'vehicle' ? 110 : def.silhouette === 'beast' ? 102 : def.silhouette === 'flier' ? 92 : 72;
    const h = def.silhouette === 'flier' ? 88 : def.silhouette === 'vehicle' ? 96 : def.silhouette === 'beast' ? 108 : 124;
    const flying = def.silhouette === 'flier';
    const D = DIFFICULTIES[difficulty];
    const hpMult  = side === 'enemy' ? D.hpMult  : 1;
    const dmgMult = side === 'enemy' ? D.dmgMult : 1;
    const u = {
      id: nextSpawnId++,
      side, key,
      name: def.name, icon: def.icon, color: def.color,
      silhouette: def.silhouette,
      x: side === 'player' ? PLAYER_BASE_X + BASE_W + 14 : ENEMY_BASE_X - 14,
      yOffset: flying ? 40 : 0,
      hp: def.hp * hpMult, hpMax: def.hp * hpMult,
      dmg: def.dmg * dmgMult, range: def.range, atkSpd: def.atkSpd, atkT: 0.4,
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
    runStats.agesReached = Math.max(runStats.agesReached, playerEra);
    if (playerEra === 1) unlock('first_age');
    if (playerEra === 2) unlock('industrial');
    if (playerEra === 3) unlock('modern');
    if (playerEra === 4) unlock('max_age');
    // New era → new hero costs/CD baseline
    const h = heroForEra(playerEra);
    if (h) { currentHeroCd = h.cd; heroReadyT = Math.min(heroReadyT, 10); }
    const hpBoost = 500;
    playerBaseMax += hpBoost;
    playerBaseHp = Math.min(playerBaseMax, playerBaseHp + hpBoost);
    SFX.ageUp();
    ageFlash = 1;
    seedAmbient(playerEra);  // refresh ambient particles for new era
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
    // Screen-flash for impact + heavy shake
    ageFlash = Math.max(ageFlash, 0.7);
    shake(12, 0.35);
    runStats.specialsFired++;
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
    runStats.turretsBuilt++;
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
    const heroBtn = document.getElementById('aow-hero-btn');
    if (heroBtn) heroBtn.onclick = trySummonHero;
    const achBtn = document.getElementById('aow-ach-btn');
    if (achBtn) achBtn.onclick = () => {
      renderAchievementsModal();
      const m = document.getElementById('aow-ach-modal');
      if (m) m.style.display = 'flex';
    };
    const achClose = document.getElementById('aow-ach-close');
    if (achClose) achClose.onclick = () => {
      const m = document.getElementById('aow-ach-modal');
      if (m) m.style.display = 'none';
    };
    const achModal = document.getElementById('aow-ach-modal');
    if (achModal) achModal.addEventListener('click', e => {
      if (e.target === achModal) achModal.style.display = 'none';
    });
    // Click-to-collect coins. Map pointer event to canvas-internal
    // coords (canvas is responsive; rect may differ from intrinsic size).
    // We also handle pointermove during a held press so dragging a
    // finger across the field sweeps up coins — much more forgiving
    // than tapping each one individually on a small touchscreen.
    let pointerHeld = false;
    function pointerToCanvas(e) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * (canvas.width  / rect.width),
        y: (e.clientY - rect.top)  * (canvas.height / rect.height),
      };
    }
    canvas.addEventListener('pointerdown', e => {
      pointerHeld = true;
      const p = pointerToCanvas(e);
      collectCoinsNear(p.x, p.y);
    });
    canvas.addEventListener('pointermove', e => {
      if (!pointerHeld) return;
      const p = pointerToCanvas(e);
      collectCoinsNear(p.x, p.y);
    });
    const stop = () => { pointerHeld = false; };
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);
    canvas.addEventListener('pointerleave', stop);
    // Prevent the browser's "drag to scroll the page" while a finger is
    // on the canvas — otherwise the swipe-collect sweeps the page too.
    canvas.style.touchAction = 'none';
    // Difficulty selector
    const diffEl = document.getElementById('aow-diff');
    if (diffEl) {
      diffEl.querySelectorAll('button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.diff === difficulty);
        btn.addEventListener('click', () => {
          difficulty = btn.dataset.diff;
          try { localStorage.setItem('aow-difficulty', difficulty); } catch {}
          diffEl.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
          reset();
        });
      });
    }
    // Tab switching (Units / Turrets)
    document.querySelectorAll('.aow-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        document.querySelectorAll('.aow-tab').forEach(t => t.classList.toggle('active', t === tab));
        document.getElementById('aow-units-tab').classList.toggle('active', target === 'units');
        document.getElementById('aow-turrets-tab').classList.toggle('active', target === 'turrets');
      });
    });
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
      } else if (e.key === 'h' || e.key === 'H') {
        trySummonHero();
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
    // Wave breather (gap between waves)
    if (waveBreatherT > 0) {
      waveBreatherT -= dt;
      return;
    }
    // Are we starting a new wave?
    if (waveEnemiesRemaining <= 0) {
      // Boss wave check: ended via boss death — credit + advance.
      if (bossWaveActive && !bossKilledThisWave) return;  // wait for boss
      waveNum++;
      bossWaveActive = isBossWave(waveNum);
      bossKilledThisWave = false;
      // Smaller first few waves, gentler growth.
      waveEnemiesRemaining = bossWaveActive ? 1 : (2 + Math.floor(waveNum * 0.35));
      waveBreatherT = bossWaveActive ? 4.0 : 3.0;
      // Announce
      const txt = bossWaveActive ? `BOSS WAVE ${waveNum}` : `WAVE ${waveNum}`;
      ageBannerText = txt;
      ageBannerT = 1.8;
      shake(bossWaveActive ? 6 : 3, 0.3);
      if (waveNum >= 10) unlock('kill_100');  // proxy: surviving 10 waves implies kills
      return;
    }
    enemySpawnT -= dt;
    if (enemySpawnT > 0) return;
    // Enemy era catch-up: faster so player isn't always fighting much
    // weaker enemies (which made the mid-game trivial).
    if (enemyEra < playerEra && Math.random() < 0.45) enemyEra++;
    const choices = unitsForEra(enemyEra);
    if (bossWaveActive && waveEnemiesRemaining === 1) {
      // Spawn a single beefy boss instead of normal unit.
      // Boss strength now scales with wave# rather than a flat 5x, so
      // early bosses (wave 5) are tough-but-fair and late bosses ramp up.
      const baseKey = choices[choices.length - 1];
      const baseDef = UNITS[baseKey];
      const bossKey = 'boss_' + baseKey + '_' + waveNum;
      // wave 5 → ~3.2x HP, wave 10 → ~4.4x, wave 15 → ~5.6x
      const hpScale  = 3.0 + (waveNum - 5) * 0.24;
      const dmgScale = 1.4 + (waveNum - 5) * 0.10;
      if (!UNITS[bossKey]) {
        UNITS[bossKey] = {
          ...baseDef,
          name: 'Boss ' + baseDef.name,
          hp: Math.round(baseDef.hp * hpScale),
          dmg: Math.round(baseDef.dmg * dmgScale),
          gold: baseDef.gold * 6,
          xp: baseDef.xp * 5,
          color: '#a020a0',
        };
      }
      spawnUnit('enemy', bossKey);
      // Tag the freshly spawned unit as boss + scale it
      const u = units[units.length - 1];
      if (u) { u.w = Math.round(u.w * 1.7); u.h = Math.round(u.h * 1.5); u.isBoss = true; u.icon = '👑'; }
      waveEnemiesRemaining = 0;  // breather waits for boss death
    } else {
      const heavy = Math.random() < 0.15 + (waveNum - 1) * 0.035;
      const key = heavy ? choices[choices.length - 1] : choices[Math.floor(Math.random() * choices.length)];
      spawnUnit('enemy', key);
      waveEnemiesRemaining--;
    }
    // Build enemy turrets too (one tier behind, slowly).
    if (Math.random() < 0.06) {
      const slot = enemyTurrets.findIndex(t => !t || t.era < enemyEra);
      if (slot >= 0 && enemyEra <= TURRETS.length - 1) {
        const targetEra = Math.min(enemyEra, TURRETS.length - 1);
        enemyTurrets[slot] = { ...TURRETS[targetEra], atkT: 0 };
      }
    }
    const pressureFactor = enemyBaseHp / enemyBaseMax;
    const D = DIFFICULTIES[difficulty];
    enemySpawnT = (1.4 + Math.random() * 1.5 + pressureFactor * 0.9) * D.spawnMult;
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
    tickAmbient(dt);

    // Resource trickle (slightly faster early so player can build a comp).
    goldTrickleT -= dt;
    if (goldTrickleT <= 0) {
      gold += 9 + playerEra * 4;
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

    // Combo timer + run timer
    if (combo > 0) {
      comboT -= dt;
      if (comboT <= 0) { combo = 0; }
    }
    runStats.time += dt;
    // Screen shake decay
    if (shakeT > 0) shakeT = Math.max(0, shakeT - dt);
    else            shakeMag *= 0.85;

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
            // Heavy hit = noticeable shake; small hit = light shake.
            shake(Math.min(8, 1 + u.dmg / 80), 0.18);
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
              spawnHitSparks(target.x, GROUND_Y - target.h * 0.5);
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
          spawnHitSparks(p.x, p.y, p.color);
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
          // Combo: each kill within COMBO_WINDOW seconds of the last
          // stacks. Multiplier boosts XP gain + coin gold value.
          combo += 1;
          comboT = COMBO_WINDOW;
          if (combo > comboBest) comboBest = combo;
          const mult = comboMult();
          xp += Math.round(u.xp * mult);
          runStats.kills++;
          if (runStats.kills === 1) unlock('first_blood');
          if (combo > runStats.biggestCombo) runStats.biggestCombo = combo;
          runStats.gold += u.gold * mult;
          dropCoins(u.x, GROUND_Y - u.h, Math.round(u.gold * mult));
          if (u.isBoss) {
            bossKilledThisWave = true;
            shake(10, 0.5);
            ageFlash = Math.max(ageFlash, 0.4);
            // Boss explosion
            for (let i = 0; i < 40; i++) {
              const a = Math.random() * Math.PI * 2;
              const s = 80 + Math.random() * 200;
              particles.push({
                x: u.x, y: GROUND_Y - u.h * 0.5,
                vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60,
                color: i % 2 === 0 ? '#fcd34d' : '#a020a0',
                size: 3 + Math.random() * 3,
                life: 0.8 + Math.random() * 0.5,
              });
            }
          }
          // Kill feed entry
          killFeed.push({
            text: '+' + (u.icon || '⚔') + ' ' + (combo > 1 ? '×' + comboMult().toFixed(1) : '+' + Math.round(u.xp * mult) + ' XP'),
            t: 1.6, y: 0,
            color: combo >= 10 ? '#ff77c8' : '#fcd34d',
          });
          // Cap kill feed length
          if (killFeed.length > 6) killFeed.shift();
          SFX.kill();
          shake(2, 0.12);
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
    for (const f of killFeed) { f.t -= dt; f.y += 20 * dt; }
    killFeed = killFeed.filter(f => f.t > 0);
    goldFloaters = goldFloaters.filter(f => f.t > 0);
    for (const m of muzzleFlashes) m.t -= dt;
    muzzleFlashes = muzzleFlashes.filter(m => m.t > 0);
    // Coin physics: arc + bounce + rest. Once landed they bob in place;
    // after a short window they auto-credit to gold so mobile players
    // who can't tap fast enough never lose all their income to fade.
    // Tapping still works for the satisfying pop + grants the same amount.
    for (const c of coinDrops) {
      c.t -= dt;
      c.bob += dt * 5;
      if (!c.landed) {
        c.vy += 380 * dt;          // gravity
        c.y += c.vy * dt;
        c.x += c.vx * dt;
        c.vx *= 0.96;
        if (c.y >= c.landY) {
          c.y = c.landY;
          if (c.vy > 80) { c.vy *= -0.35; c.vx *= 0.6; } else {
            c.landed = true;
            c.vy = 0; c.vx = 0;
            c.landedT = 0;
          }
        }
      } else if (!c.autoCollected) {
        c.landedT = (c.landedT || 0) + dt;
        if (c.landedT >= 3.0) {
          // Silent auto-collect: full value, no combo bonus, no toast spam.
          c.autoCollected = true;
          gold += c.gold;
          goldFloaters.push({
            text: '+$' + c.gold, x: c.x, y: c.y - 14,
            color: '#9ad48a', t: 0.9,
          });
          c.t = 0;
        }
      }
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
      unlock('win_easy');
      if (difficulty === 'hard'   || difficulty === 'insane') unlock('win_hard');
      if (difficulty === 'insane') unlock('win_insane');
      showOverlay(true);
    }

    // Hero CD + achievement scans
    if (heroReadyT > 0) heroReadyT = Math.max(0, heroReadyT - dt);
    checkAchievementsDuringRun();

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

  // Quick burst of yellow sparks at every hit so combat reads as
  // physical instead of two boxes silently overlapping.
  function spawnHitSparks(x, y, tint) {
    const color = tint || '#fcd34d';
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 60 + Math.random() * 90;
      particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 30,
        color,
        size: 1.5 + Math.random() * 1.5,
        life: 0.3 + Math.random() * 0.2,
      });
    }
  }

  // Touch devices: bigger hit area so fingers can reliably catch coins.
  const IS_TOUCH = (typeof window !== 'undefined') &&
                   ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  const COIN_HIT_R = IS_TOUCH ? 42 : 22;

  function collectCoinsNear(px, py) {
    let collected = 0;
    let coinsHit = 0;
    for (let i = coinDrops.length - 1; i >= 0; i--) {
      const c = coinDrops[i];
      if (c.autoCollected) continue;
      if (Math.hypot(c.x - px, c.y - py) <= COIN_HIT_R) {
        collected += c.gold;
        coinsHit++;
        // Pop with a small particle burst at the coin location
        for (let k = 0; k < 4; k++) {
          const a = Math.random() * Math.PI * 2;
          const s = 60 + Math.random() * 60;
          particles.push({
            x: c.x, y: c.y,
            vx: Math.cos(a) * s,
            vy: Math.sin(a) * s - 40,
            color: '#fcd34d',
            size: 2 + Math.random() * 2,
            life: 0.45 + Math.random() * 0.25,
          });
        }
        coinDrops.splice(i, 1);
      }
    }
    if (collected > 0) {
      gold += collected;
      runStats.coinsCollected += coinsHit;
      goldFloaters.push({
        text: '+$' + collected, x: px, y: py - 14,
        color: '#fcd34d', t: 1.2,
      });
      SFX.coin();
      renderHud();
    }
  }

  function dropCoins(x, y, total) {
    // Split the total into 1-6 individual coins. Each must be clicked
    // (or expires after a few seconds). Original Age of War made
    // coin-collection part of the loop.
    const coinCount = Math.min(6, Math.max(1, Math.round(Math.sqrt(total) / 2)));
    const perCoin = Math.max(1, Math.floor(total / coinCount));
    for (let i = 0; i < coinCount; i++) {
      coinDrops.push({
        x, y: y - 6,
        vy: -80 - Math.random() * 60,
        vx: (Math.random() - 0.5) * 100,
        landY: GROUND_Y - 8 - Math.random() * 4,
        landed: false,
        gold: perCoin,
        t: 6.5,                    // seconds to claim before fading
        bob: Math.random() * Math.PI * 2,
      });
    }
    SFX.coin();
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
    // Screen shake — applied as a small canvas translate. shakeMag
    // decays after the timed pulse expires.
    if (shakeMag > 0.1) {
      const k = shakeT > 0 ? 1 : 0.6;
      const ox = (Math.random() - 0.5) * shakeMag * k * 2;
      const oy = (Math.random() - 0.5) * shakeMag * k * 2;
      ctx.setTransform(1, 0, 0, 1, ox, oy);
    } else {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    // OG Age of War style: bright, flat sky → simple mountain silhouette → flat ground.
    // Bright per-era sky (much higher saturation than before)
    const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    grad.addColorStop(0, OG_SKY[playerEra][0]);
    grad.addColorStop(1, OG_SKY[playerEra][1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH, GROUND_Y);

    // A single, simple sun (cartoon disc, no halo clutter)
    const sunC = OG_SUN[playerEra];
    if (sunC) {
      ctx.fillStyle = sunC;
      ctx.beginPath();
      ctx.arc(WIDTH * 0.82, 80, 36, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // One simple distant mountain silhouette
    ctx.fillStyle = OG_HILL[playerEra];
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    for (let x = 0; x <= WIDTH; x += 40) {
      const h = 60 + Math.sin(x * 0.008) * 36 + Math.sin(x * 0.025) * 18;
      ctx.lineTo(x, GROUND_Y - h);
    }
    ctx.lineTo(WIDTH, GROUND_Y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= WIDTH; x += 40) {
      const h = 60 + Math.sin(x * 0.008) * 36 + Math.sin(x * 0.025) * 18;
      if (x === 0) ctx.moveTo(x, GROUND_Y - h);
      else ctx.lineTo(x, GROUND_Y - h);
    }
    ctx.stroke();

    // A few simple clouds (cartoon, white)
    for (const c of bgClouds) drawCloud(c.x, c.y, c.r);

    // Midground foliage (per-era trees, lined up just in front of the
    // hills so they break up the empty sky-to-ground gap.)
    drawFoliage(playerEra);

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

    // Coin drops — round gold disks with a $ glyph. Click to collect.
    // Bigger on touch devices so a fingertip can hit them.
    for (const c of coinDrops) {
      const fadeStart = 1.6;
      const alpha = c.t > fadeStart ? 1 : Math.max(0, c.t / fadeStart);
      const wobble = c.landed ? Math.sin(c.bob) * 1.5 : 0;
      const yy = c.y + wobble;
      const r = IS_TOUCH ? 13 : 10;
      // Subtle shadow when landed
      if (c.landed) {
        ctx.fillStyle = `rgba(0,0,0,${0.35 * alpha})`;
        ctx.beginPath();
        ctx.ellipse(c.x, c.landY + 8, r * 0.9, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // Coin face (radial gradient)
      const grad = ctx.createRadialGradient(c.x - 2, yy - 2, 1, c.x, yy, r);
      grad.addColorStop(0, `rgba(255,238,160,${alpha})`);
      grad.addColorStop(0.7, `rgba(252,211,77,${alpha})`);
      grad.addColorStop(1, `rgba(180,130,30,${alpha})`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(c.x, yy, r, 0, Math.PI * 2);
      ctx.fill();
      // Rim
      ctx.strokeStyle = `rgba(120,80,20,${alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(c.x, yy, r, 0, Math.PI * 2);
      ctx.stroke();
      // $ glyph (slightly bigger on touch to match the bigger coin)
      ctx.fillStyle = `rgba(120,80,20,${alpha})`;
      ctx.font = `700 ${IS_TOUCH ? 13 : 11}px JetBrains Mono, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', c.x, yy + 1);
      // Glow halo if expiring soon
      if (c.t < 1.6) {
        ctx.strokeStyle = `rgba(252,211,77,${(1.6 - c.t) / 1.6 * 0.6})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(c.x, yy, r + 3 + (1 - c.t / 1.6) * 4, 0, Math.PI * 2);
        ctx.stroke();
      }
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
    // Gold floaters (e.g. "+$24" on coin collect)
    for (const f of goldFloaters) {
      ctx.fillStyle = f.color || '#fcd34d';
      ctx.globalAlpha = Math.max(0, f.t / 1.2);
      ctx.font = `800 14px 'JetBrains Mono', monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(f.text || '', f.x, f.y);
      ctx.globalAlpha = 1;
    }

    // Kill feed (right side, stacks vertically)
    ctx.textAlign = 'right';
    ctx.font = `700 12px 'JetBrains Mono', monospace`;
    for (let i = 0; i < killFeed.length; i++) {
      const f = killFeed[i];
      ctx.globalAlpha = Math.max(0, f.t / 1.6);
      ctx.fillStyle = f.color || '#fcd34d';
      ctx.fillText(f.text, WIDTH - 14, 24 + i * 16 - f.y);
    }
    ctx.globalAlpha = 1;

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

  // OG-style brighter palette
  const OG_SKY = [
    ['#7dc4ec', '#cfe7f5'],  // stone — bright sky → pale horizon (matches OG cartoon)
    ['#6fb8ec', '#c4e5f3'],  // medieval — vivid summer day
    ['#a9a0b8', '#dcc498'],  // industrial — smoggy sunset
    ['#5d8fb4', '#c2d0d8'],  // modern — overcast
    ['#2c3d80', '#7c92d2'],  // future — twilight
  ];
  const OG_SUN = ['#ffe488', '#fffaca', '#ff9c4a', null, '#a8e0ff'];
  const OG_HILL = ['#d28a3a', '#3a8a3a', '#5a4a3a', '#3a4a48', '#2a3a68'];
  const OG_GROUND = ['#a9824e', '#88aa50', '#7a6648', '#6a7060', '#4a5a90'];
  // Grass/decor tint per era
  const GROUND_COLORS = OG_GROUND;
  const GROUND_SPECKS = ['#8a5a30', '#4a6a30', '#5a4828', '#4a5040', '#3a4a78'];
  // Atmosphere palettes
  const SKY_HORIZON = ['#a26845', '#7e88a8', '#564f5e', '#5c7c8a', '#3a4a90'];
  const HORIZON_HAZE = [
    'rgba(220,160,90,0.22)',   // stone — orange dust
    'rgba(180,200,220,0.16)',  // medieval — pale fog
    'rgba(200,180,140,0.16)',  // industrial — smog
    'rgba(150,220,220,0.14)',  // modern — clean haze
    'rgba(120,200,255,0.18)',  // future — neon blue
  ];
  // Per-era sun / moon — color, radius, position offset from top
  const CELESTIALS = [
    { color: '#ffd089', glow: 'rgba(255,200,120,0.35)', r: 18, x: 0.78, y: 60, halo: true },   // stone — warm sun
    { color: '#e8e8f0', glow: 'rgba(200,210,230,0.30)', r: 14, x: 0.22, y: 50, halo: false },  // medieval — pale moon
    { color: '#ffcc77', glow: 'rgba(255,180,100,0.30)', r: 16, x: 0.84, y: 70, halo: false },  // industrial — smoky sun
    { color: '#dde0e6', glow: 'rgba(220,225,235,0.25)', r: 13, x: 0.18, y: 56, halo: false },  // modern — overcast moon
    { color: '#7ec8ff', glow: 'rgba(120,200,255,0.55)', r: 20, x: 0.80, y: 64, halo: true },   // future — neon sun
  ];

  function drawSunOrMoon(eraIdx) {
    const c = CELESTIALS[eraIdx];
    if (!c) return;
    const cx = WIDTH * c.x, cy = c.y;
    // Soft halo
    const halo = ctx.createRadialGradient(cx, cy, c.r * 0.4, cx, cy, c.r * 3.2);
    halo.addColorStop(0, c.glow);
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, c.r * 3.2, 0, Math.PI * 2);
    ctx.fill();
    // Body
    ctx.fillStyle = c.color;
    ctx.beginPath();
    ctx.arc(cx, cy, c.r, 0, Math.PI * 2);
    ctx.fill();
    // Outer ring for stone-age sun + future
    if (c.halo) {
      ctx.strokeStyle = c.glow;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, c.r + 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  function drawGround(eraIdx) {
    // OG style: solid flat ground with a single dark top edge line.
    const base = GROUND_COLORS[eraIdx] || '#7a6648';
    ctx.fillStyle = base;
    ctx.fillRect(0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y);
    // Bright top edge line (the "horizon")
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, GROUND_Y); ctx.lineTo(WIDTH, GROUND_Y); ctx.stroke();
    // Subtle vertical fade to suggest depth (lighter near horizon)
    const fade = ctx.createLinearGradient(0, GROUND_Y, 0, HEIGHT);
    fade.addColorStop(0, 'rgba(255,255,255,0.06)');
    fade.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y);
  }

  // Midground foliage — small cartoon trees / bushes / pylons arranged at
  // stable seeded positions so the row of units has something to march
  // through instead of standing in front of a flat color. Anchored at
  // GROUND_Y so they sit on the same line as the units.
  function drawFoliage(eraIdx) {
    const drawTree = (x, scale, fillA, fillB) => {
      // Trunk
      ctx.fillStyle = '#5a3a1a';
      ctx.fillRect(x - 3 * scale, GROUND_Y - 18 * scale, 6 * scale, 18 * scale);
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1.4;
      ctx.strokeRect(x - 3 * scale, GROUND_Y - 18 * scale, 6 * scale, 18 * scale);
      // Three stacked canopy blobs
      ctx.fillStyle = fillA;
      ctx.beginPath();
      ctx.arc(x,              GROUND_Y - 28 * scale, 14 * scale, 0, Math.PI * 2);
      ctx.arc(x - 11 * scale, GROUND_Y - 22 * scale, 11 * scale, 0, Math.PI * 2);
      ctx.arc(x + 11 * scale, GROUND_Y - 22 * scale, 11 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 1.6 * scale;
      ctx.stroke();
      // Highlight
      ctx.fillStyle = fillB;
      ctx.beginPath();
      ctx.arc(x - 3 * scale, GROUND_Y - 31 * scale, 4 * scale, 0, Math.PI * 2);
      ctx.fill();
    };
    const drawConifer = (x, scale, fill) => {
      ctx.fillStyle = '#4a2e14';
      ctx.fillRect(x - 2 * scale, GROUND_Y - 6 * scale, 4 * scale, 6 * scale);
      ctx.fillStyle = fill;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 3; i++) {
        const yTop = GROUND_Y - (40 - i * 9) * scale;
        const yBot = yTop + 12 * scale;
        const w = (10 + i * 4) * scale;
        ctx.beginPath();
        ctx.moveTo(x,       yTop);
        ctx.lineTo(x - w/2, yBot);
        ctx.lineTo(x + w/2, yBot);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    };
    const drawBush = (x, scale, fill) => {
      ctx.fillStyle = fill;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(x - 6 * scale, GROUND_Y - 6 * scale, 7 * scale, 0, Math.PI * 2);
      ctx.arc(x + 5 * scale, GROUND_Y - 7 * scale, 8 * scale, 0, Math.PI * 2);
      ctx.arc(x,              GROUND_Y - 10 * scale, 9 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    };
    const drawRock = (x, scale) => {
      ctx.fillStyle = '#7a6a55';
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(x, GROUND_Y - 5 * scale, 14 * scale, 7 * scale, 0, Math.PI, 0);
      ctx.lineTo(x + 14 * scale, GROUND_Y);
      ctx.lineTo(x - 14 * scale, GROUND_Y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#a8957a';
      ctx.fillRect(x - 8 * scale, GROUND_Y - 9 * scale, 5 * scale, 2 * scale);
    };
    const drawPipe = (x, scale) => {
      ctx.fillStyle = '#5a4a38';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1.4;
      ctx.fillRect(x - 4 * scale, GROUND_Y - 22 * scale, 8 * scale, 22 * scale);
      ctx.strokeRect(x - 4 * scale, GROUND_Y - 22 * scale, 8 * scale, 22 * scale);
      ctx.fillStyle = '#3a2c22';
      ctx.fillRect(x - 5 * scale, GROUND_Y - 24 * scale, 10 * scale, 3 * scale);
    };
    const drawNeonPylon = (x, scale) => {
      ctx.fillStyle = '#1a2050';
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 1.4;
      ctx.fillRect(x - 3 * scale, GROUND_Y - 26 * scale, 6 * scale, 26 * scale);
      ctx.strokeRect(x - 3 * scale, GROUND_Y - 26 * scale, 6 * scale, 26 * scale);
      ctx.fillStyle = '#6ec4ff';
      ctx.shadowColor = '#6ec4ff'; ctx.shadowBlur = 6;
      ctx.fillRect(x - 2 * scale, GROUND_Y - 24 * scale, 4 * scale, 4 * scale);
      ctx.fillRect(x - 2 * scale, GROUND_Y - 14 * scale, 4 * scale, 4 * scale);
      ctx.shadowBlur = 0;
    };

    // Per-era pick + palette
    let drawer, paletteA, paletteB;
    if (eraIdx === 0) {        // stone — palm-style tropical trees + bushes
      drawer = drawTree; paletteA = '#2e7d32'; paletteB = '#5dbb63';
    } else if (eraIdx === 1) { // medieval — round-canopy trees
      drawer = drawTree; paletteA = '#2e7d32'; paletteB = '#7ed47e';
    } else if (eraIdx === 2) { // industrial — conifers + scrap
      drawer = drawConifer; paletteA = '#2a5a2a';
    } else if (eraIdx === 3) { // modern — pipes + bushes
      drawer = drawPipe;
    } else {                    // future — neon pylons
      drawer = drawNeonPylon;
    }

    // Deterministic positions across the field (skip near the bases).
    // The clip area inside the canvas where units fight is roughly
    // x ∈ [PLAYER_BASE_X+BASE_W, ENEMY_BASE_X]. Place foliage outside the
    // battle path so it doesn't visually collide with marching units.
    const slots = [];
    for (let i = 0; i < 14; i++) {
      const seed = (i * 9973 + eraIdx * 7177) | 0;
      const r = (Math.abs(Math.sin(seed)) * 10000) % 1;
      const x = PLAYER_BASE_X + BASE_W + 30 + ((i * 92 + (seed & 31)) % (ENEMY_BASE_X - PLAYER_BASE_X - BASE_W - 60));
      slots.push({ x, r, seed });
    }
    // Two passes — back layer (smaller, dimmer) first, then front layer.
    for (const s of slots) {
      if (s.r < 0.5) continue;       // back layer cull
      const scale = 0.6 + (s.seed & 7) * 0.04;
      ctx.save();
      ctx.globalAlpha = 0.7;
      if (eraIdx === 2) drawConifer(s.x, scale, '#1f4520');
      else if (eraIdx === 4) drawNeonPylon(s.x, scale);
      else drawTree(s.x, scale, '#1f5a25', '#3b8a3b');
      ctx.restore();
    }
    for (const s of slots) {
      if (s.r >= 0.5) continue;     // front layer
      const scale = 0.9 + (s.seed & 7) * 0.04;
      if (eraIdx === 0 || eraIdx === 1) {
        if ((s.seed & 3) === 0) drawBush(s.x, scale, '#3b8a3b');
        else if ((s.seed & 3) === 1) drawRock(s.x, scale * 0.8);
        else drawTree(s.x, scale, paletteA, paletteB);
      } else if (eraIdx === 2) {
        if ((s.seed & 1) === 0) drawConifer(s.x, scale, paletteA);
        else drawPipe(s.x, scale * 0.7);
      } else if (eraIdx === 3) {
        if ((s.seed & 1) === 0) drawBush(s.x, scale, '#4a5a40');
        else drawPipe(s.x, scale);
      } else {
        drawNeonPylon(s.x, scale);
      }
    }
  }

  function drawGroundDecor(eraIdx) {
    // Each "slot" along the ground has a stable seeded random so
    // tufts/rocks don't jitter between frames.
    for (let x = 20; x < WIDTH - 20; x += 32) {
      const seed = (x * 9301 + eraIdx * 49297) | 0;
      const r = (Math.abs(Math.sin(seed)) * 1000) % 1;
      if (r > 0.55) continue;
      const xi = x + ((seed >> 3) % 12) - 6;
      const yi = GROUND_Y + 1;
      if (eraIdx === 0) {
        // Stone: small rocks
        ctx.fillStyle = '#6a5238';
        ctx.beginPath(); ctx.ellipse(xi, yi + 3, 4, 2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#857058';
        ctx.fillRect(xi - 1, yi + 1, 2, 1);
      } else if (eraIdx === 1) {
        // Medieval: grass tufts
        ctx.strokeStyle = '#4a6a30';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(xi - 2, yi + 4); ctx.lineTo(xi - 2, yi - 2);
        ctx.moveTo(xi,     yi + 4); ctx.lineTo(xi + 1, yi - 3);
        ctx.moveTo(xi + 2, yi + 4); ctx.lineTo(xi + 3, yi - 2);
        ctx.stroke();
      } else if (eraIdx === 2) {
        // Industrial: scrap / pipes
        ctx.fillStyle = '#3a3528';
        ctx.fillRect(xi - 4, yi + 2, 8, 2);
        ctx.fillStyle = '#5a5040';
        ctx.fillRect(xi - 3, yi + 2, 1, 2);
        ctx.fillRect(xi + 2, yi + 2, 1, 2);
      } else if (eraIdx === 3) {
        // Modern: short concrete tile lines
        ctx.strokeStyle = 'rgba(180,180,180,0.18)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(xi - 5, yi + 5); ctx.lineTo(xi + 5, yi + 5);
        ctx.stroke();
      } else if (eraIdx === 4) {
        // Future: glowing hex chips
        ctx.fillStyle = 'rgba(110,196,255,0.45)';
        ctx.beginPath();
        ctx.arc(xi, yi + 4, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawCloud(x, y, r) {
    // Cartoon clouds: solid white blob, dark outline, slight shadow
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.arc(x + r * 0.75, y + 4, r * 0.85, 0, Math.PI * 2);
    ctx.arc(x - r * 0.75, y + 6, r * 0.75, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Underside shadow
    ctx.fillStyle = 'rgba(120,160,200,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.45, r * 1.2, r * 0.18, 0, 0, Math.PI * 2);
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
    // Cave entrance: irregular gray boulder pile with a dark mouth in
    // the middle. Matches the OG Age-of-War stone-age base.
    const cx = x + BASE_W / 2;
    // Outline-first dome shape so the boulders read against the sky
    ctx.fillStyle = '#7d8084';
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 4, GROUND_Y);
    ctx.lineTo(x + 6, GROUND_Y - 50);
    ctx.lineTo(x + 30, GROUND_Y - 86);
    ctx.lineTo(cx,    GROUND_Y - 96);
    ctx.lineTo(x + BASE_W - 30, GROUND_Y - 86);
    ctx.lineTo(x + BASE_W - 6,  GROUND_Y - 50);
    ctx.lineTo(x + BASE_W + 4,  GROUND_Y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Individual boulders piled up — vary tone for depth
    const boulders = [
      { x: x + 10,            y: GROUND_Y - 18, r: 14, c: '#888c90' },
      { x: x + 36,            y: GROUND_Y - 30, r: 18, c: '#9ea2a6' },
      { x: x + 22,            y: GROUND_Y - 58, r: 16, c: '#7d8084' },
      { x: cx,                y: GROUND_Y - 80, r: 18, c: '#9ea2a6' },
      { x: x + BASE_W - 22,   y: GROUND_Y - 58, r: 16, c: '#7d8084' },
      { x: x + BASE_W - 36,   y: GROUND_Y - 30, r: 18, c: '#9ea2a6' },
      { x: x + BASE_W - 10,   y: GROUND_Y - 18, r: 14, c: '#888c90' },
    ];
    for (const b of boulders) {
      ctx.fillStyle = b.c;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Highlight chip
      ctx.fillStyle = '#c9ccce';
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.4, b.r * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Dark cave mouth
    ctx.fillStyle = '#1a1208';
    ctx.beginPath();
    ctx.moveTo(cx - 18, GROUND_Y);
    ctx.quadraticCurveTo(cx - 18, GROUND_Y - 42, cx, GROUND_Y - 46);
    ctx.quadraticCurveTo(cx + 18, GROUND_Y - 42, cx + 18, GROUND_Y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawBaseMedieval(x, color) {
    // Castle: body + battlements + portcullis + red banners
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 2;
    ctx.fillRect(x, GROUND_Y - 80, BASE_W, 80);
    ctx.strokeRect(x, GROUND_Y - 80, BASE_W, 80);
    // Stone-block hatching
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 1;
    for (let r = 0; r < 5; r++) {
      const yy = GROUND_Y - 80 + r * 16;
      ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + BASE_W, yy); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(x, GROUND_Y - 14, BASE_W, 14);
    // Battlements
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const bw = (BASE_W - 10) / 6 - 2;
      const bx = x + 5 + i * (bw + 2);
      ctx.fillRect(bx, GROUND_Y - 92, bw, 12);
      ctx.strokeRect(bx, GROUND_Y - 92, bw, 12);
    }
    // Two red banners hanging from the wall (left + right of door)
    const drawBanner = (bx) => {
      ctx.fillStyle = '#c43838';
      ctx.beginPath();
      ctx.moveTo(bx - 6, GROUND_Y - 80);
      ctx.lineTo(bx + 6, GROUND_Y - 80);
      ctx.lineTo(bx + 6, GROUND_Y - 30);
      ctx.lineTo(bx, GROUND_Y - 24);
      ctx.lineTo(bx - 6, GROUND_Y - 30);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      // Yellow cross emblem
      ctx.strokeStyle = '#fcd34d';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(bx, GROUND_Y - 72); ctx.lineTo(bx, GROUND_Y - 50);
      ctx.moveTo(bx - 4, GROUND_Y - 62); ctx.lineTo(bx + 4, GROUND_Y - 62);
      ctx.stroke();
    };
    drawBanner(x + 22);
    drawBanner(x + BASE_W - 22);
    // Portcullis
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x + BASE_W / 2 - 14, GROUND_Y - 42, 28, 42);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1.2;
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

  // ---- Per-unit drawing helpers ----
  // Skin tone palette — random per character at spawn? for now fixed per-era so look stays cohesive.
  function skinFor(era) { return era < 4 ? '#e8b48a' : '#d9c6b0'; }

  function drawHumanoidBase(x, y, h, w, facing, swing, bodyColor, opts = {}) {
    // Proportions: head ~22% h, torso ~40% h, legs ~38% h.
    const headR = Math.round(h * 0.10);
    const neckY = y + headR * 2;
    const bodyTop = neckY + 3;
    const bodyH = Math.round(h * 0.40);
    const bodyBottom = bodyTop + bodyH;
    const legH = Math.round(h * 0.32);
    const upperLegH = legH * 0.55;
    const lowerLegH = legH * 0.45;
    const bodyW = Math.round(w * 0.62);
    const skin = opts.skin || '#e8b48a';

    // Walk cycle parameters
    const liftL = Math.max(0, swing) * 4;        // how far front leg lifts
    const liftR = Math.max(0, -swing) * 4;
    const knee = 2 + Math.abs(swing) * 3;
    const hipL = { x: x - bodyW * 0.22, y: bodyBottom - 1 };
    const hipR = { x: x + bodyW * 0.22, y: bodyBottom - 1 };
    const pants = opts.pantsColor || '#222';
    const boot  = opts.bootColor  || '#000';

    // Articulated legs (upper thigh + lower shin, with knee bend)
    function drawLeg(hip, lift) {
      const kneeX = hip.x + facing * (lift * 0.3);
      const kneeY = hip.y + upperLegH - lift;
      const footX = kneeX + facing * (lift * -0.15);
      const footY = kneeY + lowerLegH - lift * 0.5;
      // Draw a dark outline pass first so the leg reads as solid
      // even against a busy background.
      ctx.strokeStyle = 'rgba(0,0,0,0.9)';
      ctx.lineWidth = 11;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(hip.x,  hip.y);
      ctx.lineTo(kneeX,  kneeY);
      ctx.lineTo(footX,  footY);
      ctx.stroke();
      ctx.strokeStyle = pants;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(hip.x,  hip.y);
      ctx.lineTo(kneeX,  kneeY);
      ctx.lineTo(footX,  footY);
      ctx.stroke();
      // Boot
      ctx.fillStyle = boot;
      ctx.fillRect(footX - 6, footY - 3, 12, 5);
    }
    drawLeg(hipL, liftL);
    drawLeg(hipR, liftR);

    // Torso — rounded rect with horizontal shading + dark outline
    roundRectPath(x - bodyW / 2, bodyTop, bodyW, bodyH, 4);
    const torsoGrad = ctx.createLinearGradient(x - bodyW / 2, bodyTop, x + bodyW / 2, bodyTop);
    torsoGrad.addColorStop(0,    shadeColor(bodyColor, -22));
    torsoGrad.addColorStop(0.45, bodyColor);
    torsoGrad.addColorStop(1,    shadeColor(bodyColor,  18));
    ctx.fillStyle = torsoGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Belt
    if (opts.belt) {
      ctx.fillStyle = opts.belt;
      ctx.fillRect(x - bodyW / 2, bodyBottom - 5, bodyW, 4);
      ctx.fillStyle = shadeColor(opts.belt, 30);
      ctx.fillRect(x - 2, bodyBottom - 5, 4, 4);  // buckle
    }

    // Neck (small skin nub between head and torso)
    ctx.fillStyle = skin;
    ctx.fillRect(x - 3, neckY - 1, 6, 4);

    // Arms — both swing during walk. Front arm holds the weapon
    // (drawn by the caller after this returns); back arm bobs at
    // opposite phase. We use 3-segment limbs with elbow bend.
    const armSwing = -swing * 6;
    const frontShoulder = { x: x + facing * (bodyW * 0.45), y: bodyTop + 5 };
    const backShoulder  = { x: x - facing * (bodyW * 0.45), y: bodyTop + 5 };
    // Back arm — draw a bent arm with the hand at the side
    const backElbow = {
      x: backShoulder.x - facing * 2 - armSwing * 0.3,
      y: backShoulder.y + 8,
    };
    const backHand = {
      x: backElbow.x - facing * 1 + armSwing * 0.2,
      y: backElbow.y + 7,
    };
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(backShoulder.x, backShoulder.y);
    ctx.lineTo(backElbow.x,    backElbow.y);
    ctx.lineTo(backHand.x,     backHand.y);
    ctx.stroke();
    ctx.strokeStyle = bodyColor;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(backShoulder.x, backShoulder.y);
    ctx.lineTo(backElbow.x,    backElbow.y);
    ctx.lineTo(backHand.x,     backHand.y);
    ctx.stroke();
    // Back hand (skin dot)
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(backHand.x, backHand.y, 3.4, 0, Math.PI * 2);
    ctx.fill();

    // Front arm anchor — caller wires the weapon hold around handX/handY
    const elbowX = frontShoulder.x + facing * 4 + armSwing * 0.4;
    const elbowY = frontShoulder.y + 7;
    const handX  = elbowX + facing * 6;
    const handY  = elbowY + 6 + Math.abs(armSwing) * 0.3;
    return {
      shoulderX: frontShoulder.x, shoulderY: frontShoulder.y,
      elbowX, elbowY, handX, handY,
      headR, headCenterY: y + headR,
      bodyTop, bodyBottom, bodyW,
    };
  }

  function drawArmAndWeapon(x, y, shoulder, hand, bodyColor, weaponDraw, opts = {}) {
    // Front arm bent at elbow (3 segments: shoulder → elbow → hand).
    const elbowX = opts.elbowX != null ? opts.elbowX : (shoulder.x + hand.x) * 0.5;
    const elbowY = opts.elbowY != null ? opts.elbowY : (shoulder.y + hand.y) * 0.5 + 2;
    // Outline pass
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(shoulder.x, shoulder.y);
    ctx.lineTo(elbowX,     elbowY);
    ctx.lineTo(hand.x,     hand.y);
    ctx.stroke();
    // Fill pass
    ctx.strokeStyle = bodyColor;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(shoulder.x, shoulder.y);
    ctx.lineTo(elbowX,     elbowY);
    ctx.lineTo(hand.x,     hand.y);
    ctx.stroke();
    // Hand under the weapon
    ctx.fillStyle = opts.skin || '#e8b48a';
    ctx.beginPath();
    ctx.arc(hand.x, hand.y, 3.8, 0, Math.PI * 2);
    ctx.fill();
    if (weaponDraw) weaponDraw(hand.x, hand.y);
  }

  function drawHead(cx, cy, r, skin, opts = {}) {
    // Slightly oval head with subtle shading and 2 small eyes
    const facing = opts.facing || 1;
    // Soft drop shadow under jaw
    ctx.fillStyle = shadeColor(skin, -28);
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.55, r * 0.7, r * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    // Face
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    // Cheek highlight (front-facing side)
    ctx.fillStyle = shadeColor(skin, 18);
    ctx.beginPath();
    ctx.arc(cx + facing * r * 0.35, cy + r * 0.1, r * 0.35, 0, Math.PI * 2);
    ctx.fill();
    if (opts.eye !== false) {
      // Two eye dots (the back eye is a hint, front eye more visible)
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(cx + facing * 1.4, cy - 1.2, 1.6, 1.6);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(cx + facing * -1.4, cy - 1.0, 1.2, 1.4);
    }
    // Subtle outline
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Lighten/darken a hex color by `amt` units (-100..100).
  function shadeColor(hex, amt) {
    if (!hex || hex[0] !== '#') return hex;
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const r = Math.max(0, Math.min(255, parseInt(h.slice(0, 2), 16) + amt));
    const g = Math.max(0, Math.min(255, parseInt(h.slice(2, 4), 16) + amt));
    const b = Math.max(0, Math.min(255, parseInt(h.slice(4, 6), 16) + amt));
    return `rgb(${r}, ${g}, ${b})`;
  }

  function roundRectPath(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y,     x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x,     y + h, rr);
    ctx.arcTo(x,     y + h, x,     y,     rr);
    ctx.arcTo(x,     y,     x + w, y,     rr);
    ctx.closePath();
  }

  // ---- Unit-specific drawers ----
  function drawGenericHumanoid(u, x, y, facing, walk, bodyColor) {
    const swing = walk * 3;
    const base = drawHumanoidBase(x, y, u.h, u.w, facing, swing, bodyColor, { skin: '#e8b48a' });
    drawHead(x, base.headCenterY, base.headR, '#e8b48a', { facing });
    drawArmAndWeapon(x, y, { x: base.shoulderX, y: base.shoulderY }, { x: base.handX, y: base.handY }, bodyColor, null);
  }

  // === STONE AGE ===
  const drawClubman = (u, x, y, facing, walk, bodyColor) => {
    const swing = walk * 4;
    const base = drawHumanoidBase(x, y, u.h, u.w * 1.1, facing, swing, bodyColor, { skin: skinFor(0), pantsColor: '#5a3a22' });
    // Shaggy hair on head
    const hr = base.headR + 1;
    ctx.fillStyle = '#2a1808';
    ctx.beginPath(); ctx.arc(x - 1, base.headCenterY - 1, hr, 0, Math.PI * 2); ctx.fill();
    drawHead(x, base.headCenterY, base.headR, skinFor(0), { facing });
    // Big wooden club in hand
    drawArmAndWeapon(x, y, { x: base.shoulderX, y: base.shoulderY }, { x: base.handX + facing * 4, y: base.handY - 6 }, bodyColor, (hx, hy) => {
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(facing * -0.5);
      // Club shaft
      ctx.fillStyle = '#5a3a18';
      ctx.fillRect(-2, -10, 4, 14);
      // Big head
      ctx.fillStyle = '#7a4e22';
      ctx.beginPath();
      ctx.arc(0, -14, 5, 0, Math.PI * 2);
      ctx.fill();
      // Spikes
      ctx.strokeStyle = '#3a2210';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-3, -16); ctx.lineTo(-5, -19);
      ctx.moveTo(3, -16);  ctx.lineTo(5, -19);
      ctx.stroke();
      ctx.restore();
    });
  };

  const drawSlinger = (u, x, y, facing, walk, bodyColor) => {
    const swing = walk * 4;
    const base = drawHumanoidBase(x, y, u.h, u.w, facing, swing, bodyColor, { skin: skinFor(0), pantsColor: '#3a2a18' });
    ctx.fillStyle = '#3a2818';
    ctx.beginPath(); ctx.arc(x - 1, base.headCenterY - 2, base.headR + 1, 0, Math.PI * 2); ctx.fill();
    drawHead(x, base.headCenterY, base.headR, skinFor(0), { facing });
    // Sling being whirled overhead
    drawArmAndWeapon(x, y, { x: base.shoulderX, y: base.shoulderY }, { x: base.handX + facing * 3, y: base.handY - 14 }, bodyColor, (hx, hy) => {
      ctx.strokeStyle = '#6a4828';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(hx, hy - 6, 7, 0, Math.PI * 2);
      ctx.stroke();
      // Stone in the sling
      ctx.fillStyle = '#888';
      ctx.beginPath();
      ctx.arc(hx + facing * 3, hy - 12, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  // === MEDIEVAL ===
  const drawSwordsman = (u, x, y, facing, walk, bodyColor) => {
    const swing = walk * 3;
    const base = drawHumanoidBase(x, y, u.h, u.w, facing, swing, bodyColor, { skin: skinFor(1), pantsColor: '#2a2a2a', bootColor: '#444', belt: '#6a4a22' });
    // Pauldrons
    ctx.fillStyle = '#cdd1d6';
    ctx.fillRect(x - u.w * 0.32, y + base.headR * 2, 5, 4);
    ctx.fillRect(x + u.w * 0.32 - 5, y + base.headR * 2, 5, 4);
    // Helmet (great helm with visor)
    ctx.fillStyle = '#a8aeb6';
    ctx.beginPath();
    ctx.arc(x, base.headCenterY, base.headR + 1, Math.PI, 0);
    ctx.lineTo(x + base.headR + 1, base.headCenterY + base.headR);
    ctx.lineTo(x - base.headR - 1, base.headCenterY + base.headR);
    ctx.closePath();
    ctx.fill();
    // Visor slit
    ctx.fillStyle = '#0e1015';
    ctx.fillRect(x - base.headR + 1, base.headCenterY - 1, base.headR * 2 - 2, 1.5);
    // Sword
    drawArmAndWeapon(x, y, { x: base.shoulderX, y: base.shoulderY }, { x: base.handX + facing * 2, y: base.handY - 2 }, bodyColor, (hx, hy) => {
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(facing * -1.3);
      // Crossguard
      ctx.fillStyle = '#5a4022';
      ctx.fillRect(-5, -2, 10, 2);
      // Blade
      const bladeGrad = ctx.createLinearGradient(0, -22, 0, 0);
      bladeGrad.addColorStop(0, '#e8ecef');
      bladeGrad.addColorStop(1, '#9aa1a8');
      ctx.fillStyle = bladeGrad;
      ctx.beginPath();
      ctx.moveTo(-1.5, 0); ctx.lineTo(1.5, 0); ctx.lineTo(1, -22); ctx.lineTo(0, -24); ctx.lineTo(-1, -22);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
  };

  const drawArcher = (u, x, y, facing, walk, bodyColor) => {
    const swing = walk * 3;
    const base = drawHumanoidBase(x, y, u.h, u.w, facing, swing, bodyColor, { skin: skinFor(1), pantsColor: '#3a2e1a', bootColor: '#3a2810', belt: '#5a3a18' });
    // Green hood
    ctx.fillStyle = '#3a5028';
    ctx.beginPath();
    ctx.arc(x, base.headCenterY - 1, base.headR + 2, Math.PI, 0);
    ctx.lineTo(x + base.headR + 2, base.headCenterY + base.headR + 1);
    ctx.lineTo(x - base.headR - 2, base.headCenterY + base.headR + 1);
    ctx.closePath();
    ctx.fill();
    drawHead(x - facing * 1, base.headCenterY + 1, base.headR - 1, skinFor(1), { facing });
    // Bow + arrow held drawn
    drawArmAndWeapon(x, y, { x: base.shoulderX, y: base.shoulderY }, { x: base.handX + facing * 6, y: base.handY }, bodyColor, (hx, hy) => {
      // Bow
      ctx.strokeStyle = '#6a3a1a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hx, hy, 12, -Math.PI / 2 - 0.4, Math.PI / 2 + 0.4, facing < 0);
      ctx.stroke();
      // Bowstring
      ctx.strokeStyle = '#cccccc';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(hx, hy - 10);
      ctx.lineTo(hx - facing * 3, hy);
      ctx.lineTo(hx, hy + 10);
      ctx.stroke();
      // Arrow
      ctx.strokeStyle = '#3a2210';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(hx - facing * 3, hy);
      ctx.lineTo(hx + facing * 8, hy);
      ctx.stroke();
    });
  };

  // === INDUSTRIAL ===
  const drawRifleman = (u, x, y, facing, walk, bodyColor) => {
    const swing = walk * 3;
    const base = drawHumanoidBase(x, y, u.h, u.w, facing, swing, bodyColor, { skin: skinFor(2), pantsColor: '#2a2218', bootColor: '#1a1208', belt: '#3a2010' });
    // Helmet (brodie-style)
    ctx.fillStyle = '#5a6a40';
    ctx.beginPath();
    ctx.ellipse(x, base.headCenterY - 1, base.headR + 2, base.headR, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(x - base.headR - 2, base.headCenterY - 2, (base.headR + 2) * 2, 2);
    drawHead(x, base.headCenterY + 1, base.headR - 1, skinFor(2), { facing });
    // Bolt-action rifle
    drawArmAndWeapon(x, y, { x: base.shoulderX, y: base.shoulderY }, { x: base.handX + facing * 4, y: base.handY }, bodyColor, (hx, hy) => {
      // Stock
      ctx.fillStyle = '#5a3a1a';
      ctx.fillRect(hx - facing * 6, hy - 1, facing * 8, 3);
      // Barrel
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(hx, hy - 1, facing * 18, 2);
      // Bolt
      ctx.fillStyle = '#888';
      ctx.fillRect(hx + facing * 3, hy - 2.5, facing * 3, 1.5);
    });
  };

  const drawCannoneer = (u, x, y, facing, walk, bodyColor) => {
    const swing = walk * 2;
    const base = drawHumanoidBase(x, y, u.h, u.w * 1.1, facing, swing, bodyColor, { skin: skinFor(2), pantsColor: '#2a1a08', bootColor: '#0a0805', belt: '#3a2010' });
    // Wide-brim hat
    ctx.fillStyle = '#2a1a0a';
    ctx.fillRect(x - base.headR - 4, base.headCenterY - base.headR, (base.headR + 4) * 2, 2);
    ctx.fillRect(x - base.headR - 1, base.headCenterY - base.headR - 4, (base.headR + 1) * 2, 4);
    drawHead(x, base.headCenterY + 1, base.headR - 1, skinFor(2), { facing });
    // Shoulder-mounted cannon
    drawArmAndWeapon(x, y, { x: base.shoulderX, y: base.shoulderY }, { x: base.handX + facing * 4, y: base.handY - 2 }, bodyColor, (hx, hy) => {
      // Cannon body
      ctx.fillStyle = '#2a2a2a';
      ctx.beginPath();
      ctx.ellipse(hx + facing * 8, hy - 1, 14, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Reinforcement bands
      ctx.fillStyle = '#444';
      ctx.fillRect(hx + facing * 4, hy - 6, 2, 10);
      ctx.fillRect(hx + facing * 12, hy - 6, 2, 10);
      // Muzzle ring
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(hx + facing * 20, hy - 5, 2, 8);
    });
  };

  // === MODERN ===
  const drawSoldier = (u, x, y, facing, walk, bodyColor) => {
    const swing = walk * 3;
    const base = drawHumanoidBase(x, y, u.h, u.w, facing, swing, bodyColor, { skin: skinFor(3), pantsColor: '#3a4528', bootColor: '#1a1f10', belt: '#3a2818' });
    // Tactical vest stripe
    ctx.fillStyle = '#2a3520';
    ctx.fillRect(x - u.w * 0.28, y + base.headR * 2 + 6, u.w * 0.56, 5);
    // Combat helmet
    ctx.fillStyle = '#3a4828';
    ctx.beginPath();
    ctx.arc(x, base.headCenterY - 1, base.headR + 2, Math.PI, 0);
    ctx.lineTo(x + base.headR + 2, base.headCenterY + 1);
    ctx.lineTo(x - base.headR - 2, base.headCenterY + 1);
    ctx.closePath();
    ctx.fill();
    drawHead(x, base.headCenterY + 1, base.headR - 1, skinFor(3), { facing });
    // M4-style rifle
    drawArmAndWeapon(x, y, { x: base.shoulderX, y: base.shoulderY }, { x: base.handX + facing * 4, y: base.handY }, bodyColor, (hx, hy) => {
      ctx.fillStyle = '#1a1f10';
      ctx.fillRect(hx - facing * 4, hy - 1.5, facing * 22, 3);
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(hx + facing * 14, hy - 3, facing * 4, 5);    // optic
      ctx.fillStyle = '#5a3a18';
      ctx.fillRect(hx - facing * 4, hy + 1.5, facing * 6, 2);   // stock
    });
  };

  const drawSniper = (u, x, y, facing, walk, bodyColor) => {
    const swing = walk * 3;
    const base = drawHumanoidBase(x, y, u.h, u.w, facing, swing, bodyColor, { skin: skinFor(3), pantsColor: '#4a4a32', bootColor: '#28281a', belt: '#3a2818' });
    // Ghillie/balaclava
    ctx.fillStyle = '#3a3818';
    ctx.beginPath(); ctx.arc(x, base.headCenterY, base.headR + 1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1808';
    ctx.fillRect(x - base.headR, base.headCenterY - 1, base.headR * 2, 2);
    // Long-barreled rifle with scope
    drawArmAndWeapon(x, y, { x: base.shoulderX, y: base.shoulderY }, { x: base.handX + facing * 4, y: base.handY + 1 }, bodyColor, (hx, hy) => {
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(hx - facing * 5, hy - 1, facing * 32, 2);
      // Long scope
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(hx + facing * 8, hy - 4, facing * 12, 3);
      // Bipod
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx + facing * 22, hy);
      ctx.lineTo(hx + facing * 22, hy + 6);
      ctx.stroke();
    });
  };

  // === FUTURE ===
  const drawLaserTrooper = (u, x, y, facing, walk, bodyColor) => {
    const swing = walk * 3;
    const base = drawHumanoidBase(x, y, u.h, u.w, facing, swing, bodyColor, { skin: skinFor(4), pantsColor: '#222a44', bootColor: '#0e1428' });
    // Energy chest strip
    ctx.fillStyle = '#6ec4ff';
    ctx.shadowColor = '#6ec4ff'; ctx.shadowBlur = 8;
    ctx.fillRect(x - u.w * 0.28, y + base.headR * 2 + 8, u.w * 0.56, 1.5);
    ctx.shadowBlur = 0;
    // Closed-visor helmet
    ctx.fillStyle = '#1a2244';
    ctx.beginPath(); ctx.arc(x, base.headCenterY, base.headR + 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6ec4ff';
    ctx.shadowColor = '#6ec4ff'; ctx.shadowBlur = 6;
    ctx.fillRect(x - base.headR + 1, base.headCenterY - 1, (base.headR - 1) * 2, 2);
    ctx.shadowBlur = 0;
    // Antenna
    ctx.fillStyle = '#6ec4ff';
    ctx.fillRect(x - 0.5, base.headCenterY - base.headR - 6, 1, 4);
    // Energy rifle
    drawArmAndWeapon(x, y, { x: base.shoulderX, y: base.shoulderY }, { x: base.handX + facing * 4, y: base.handY }, bodyColor, (hx, hy) => {
      // Body
      ctx.fillStyle = '#3a4470';
      ctx.fillRect(hx - facing * 4, hy - 2, facing * 18, 4);
      // Energy core
      ctx.fillStyle = '#6ec4ff';
      ctx.shadowColor = '#6ec4ff'; ctx.shadowBlur = 6;
      ctx.fillRect(hx + facing * 4, hy - 1, facing * 4, 2);
      ctx.fillRect(hx + facing * 14, hy - 1.5, facing * 3, 3);  // muzzle glow
      ctx.shadowBlur = 0;
    });
  };

  // === MOUNTED / VEHICLE / FLIER (one drawer each — these don't need per-unit variation) ===
  const drawHorseAndRider = (u, x, y, facing, walk, bodyColor) => {
    // Horse body
    const gallop = Math.sin(u.walkPhase * 1.5) * 2;
    ctx.fillStyle = '#5a3a22';
    ctx.fillRect(x - u.w / 2, y + u.h * 0.45, u.w, u.h * 0.30);
    // Horse head + neck
    ctx.fillStyle = '#5a3a22';
    ctx.beginPath();
    ctx.moveTo(x + facing * u.w * 0.4, y + u.h * 0.45);
    ctx.lineTo(x + facing * u.w * 0.6, y + u.h * 0.30);
    ctx.lineTo(x + facing * u.w * 0.7, y + u.h * 0.35);
    ctx.lineTo(x + facing * u.w * 0.5, y + u.h * 0.55);
    ctx.closePath();
    ctx.fill();
    // Mane
    ctx.fillStyle = '#2a1808';
    ctx.fillRect(x + facing * u.w * 0.42, y + u.h * 0.32, 2, 10);
    // Legs (galloping)
    ctx.fillStyle = '#2a1808';
    ctx.fillRect(x - u.w * 0.35, y + u.h * 0.75, 4, u.h * 0.25 + gallop);
    ctx.fillRect(x + u.w * 0.30, y + u.h * 0.75, 4, u.h * 0.25 - gallop);
    ctx.fillRect(x - u.w * 0.05, y + u.h * 0.75, 4, u.h * 0.25 - gallop);
    ctx.fillRect(x + u.w * 0.05, y + u.h * 0.75, 4, u.h * 0.25 + gallop);
    // Rider (smaller, mounted on top)
    const riderY = y - 4;
    ctx.fillStyle = bodyColor;
    ctx.fillRect(x - 5, riderY + 6, 10, 12);
    // Rider helmet
    ctx.fillStyle = '#a8aeb6';
    ctx.beginPath();
    ctx.arc(x, riderY + 4, 5, Math.PI, 0);
    ctx.lineTo(x + 5, riderY + 6);
    ctx.lineTo(x - 5, riderY + 6);
    ctx.closePath();
    ctx.fill();
    // Lance
    ctx.strokeStyle = '#5a3a18';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + facing * 4, riderY + 10);
    ctx.lineTo(x + facing * 26, riderY + 4);
    ctx.stroke();
    // Lance tip
    ctx.fillStyle = '#ccc';
    ctx.beginPath();
    ctx.moveTo(x + facing * 26, riderY + 4);
    ctx.lineTo(x + facing * 30, riderY + 3);
    ctx.lineTo(x + facing * 26, riderY + 6);
    ctx.closePath();
    ctx.fill();
  };

  const drawDinoRider = (u, x, y, facing, walk, bodyColor) => {
    const gallop = Math.sin(u.walkPhase * 1.4) * 2;
    // Dino body
    ctx.fillStyle = bodyColor;
    ctx.fillRect(x - u.w / 2, y + u.h * 0.45, u.w, u.h * 0.30);
    // Head with snout
    ctx.beginPath();
    ctx.moveTo(x + facing * u.w * 0.4, y + u.h * 0.45);
    ctx.lineTo(x + facing * u.w * 0.7, y + u.h * 0.32);
    ctx.lineTo(x + facing * u.w * 0.75, y + u.h * 0.42);
    ctx.lineTo(x + facing * u.w * 0.55, y + u.h * 0.55);
    ctx.closePath();
    ctx.fill();
    // Eye
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(x + facing * u.w * 0.55, y + u.h * 0.36, 1.5, 0, Math.PI * 2);
    ctx.fill();
    // Teeth
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + facing * u.w * 0.62, y + u.h * 0.45, facing * 6, 2);
    // Tail
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.moveTo(x - facing * u.w * 0.4, y + u.h * 0.5);
    ctx.lineTo(x - facing * u.w * 0.7, y + u.h * 0.4);
    ctx.lineTo(x - facing * u.w * 0.7, y + u.h * 0.55);
    ctx.closePath();
    ctx.fill();
    // Legs
    ctx.fillStyle = '#3a5530';
    ctx.fillRect(x - u.w * 0.25, y + u.h * 0.75, 5, u.h * 0.25 + gallop);
    ctx.fillRect(x + u.w * 0.18, y + u.h * 0.75, 5, u.h * 0.25 - gallop);
    // Caveman rider
    const riderY = y - 6;
    ctx.fillStyle = '#b07040';
    ctx.fillRect(x - 4, riderY + 6, 8, 10);
    ctx.fillStyle = '#2a1808';
    ctx.beginPath(); ctx.arc(x, riderY + 3, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = skinFor(0);
    ctx.beginPath(); ctx.arc(x, riderY + 4, 3.5, 0, Math.PI * 2); ctx.fill();
  };

  const drawSteamTank = (u, x, y, facing, walk, bodyColor) => {
    // Tracks (lower)
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x - u.w / 2 - 2, y + u.h - 8, u.w + 4, 7);
    // Treads
    ctx.fillStyle = '#3a3a3a';
    for (let i = 0; i < 8; i++) ctx.fillRect(x - u.w / 2 + i * (u.w / 7), y + u.h - 5, 3, 3);
    // Hull
    ctx.fillStyle = bodyColor;
    ctx.fillRect(x - u.w / 2, y + u.h * 0.35, u.w, u.h * 0.4);
    // Turret
    ctx.fillStyle = bodyColor;
    ctx.fillRect(x - u.w * 0.3, y + u.h * 0.2, u.w * 0.6, u.h * 0.2);
    // Cannon barrel
    ctx.fillStyle = '#222';
    ctx.fillRect(x + facing * u.w * 0.3, y + u.h * 0.28, facing * u.w * 0.45, 5);
    // Smokestack with puffs
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x - u.w * 0.42, y + u.h * 0.05, 4, u.h * 0.32);
    ctx.fillStyle = 'rgba(140,140,140,0.5)';
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.arc(x - u.w * 0.4 + Math.sin(performance.now() / 300 + i) * 4, y + u.h * 0.02 - i * 6, 4 + i, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const drawModernTank = (u, x, y, facing, walk, bodyColor) => {
    // Tracks
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x - u.w / 2 - 3, y + u.h - 9, u.w + 6, 8);
    ctx.fillStyle = '#444';
    for (let i = 0; i < 9; i++) ctx.fillRect(x - u.w / 2 + i * (u.w / 8) - 1, y + u.h - 6, 4, 4);
    // Hull
    ctx.fillStyle = bodyColor;
    ctx.fillRect(x - u.w / 2, y + u.h * 0.4, u.w, u.h * 0.42);
    // Sloped frontal armor
    ctx.beginPath();
    ctx.moveTo(x + facing * u.w / 2, y + u.h * 0.4);
    ctx.lineTo(x + facing * (u.w / 2 + 6), y + u.h * 0.55);
    ctx.lineTo(x + facing * u.w / 2, y + u.h * 0.82);
    ctx.closePath();
    ctx.fill();
    // Turret (low dome)
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(x, y + u.h * 0.35, u.w * 0.32, u.h * 0.16, 0, Math.PI, 0);
    ctx.fill();
    // Main gun barrel (long)
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x + facing * u.w * 0.1, y + u.h * 0.30, facing * u.w * 0.55, 4);
    // Muzzle brake
    ctx.fillStyle = '#333';
    ctx.fillRect(x + facing * u.w * 0.55, y + u.h * 0.28, facing * 5, 8);
  };

  const drawMech = (u, x, y, facing, walk, bodyColor) => {
    const swing = walk * 4;
    // Legs (heavy)
    ctx.fillStyle = '#3a3a55';
    ctx.fillRect(x - u.w * 0.32, y + u.h * 0.55, 8, u.h * 0.45 + swing);
    ctx.fillRect(x + u.w * 0.20, y + u.h * 0.55, 8, u.h * 0.45 - swing);
    // Feet
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(x - u.w * 0.38, y + u.h - 4, 14, 4);
    ctx.fillRect(x + u.w * 0.14, y + u.h - 4, 14, 4);
    // Torso
    ctx.fillStyle = bodyColor;
    ctx.fillRect(x - u.w * 0.35, y + u.h * 0.18, u.w * 0.7, u.h * 0.4);
    // Cockpit glow
    ctx.fillStyle = '#6ec4ff';
    ctx.shadowColor = '#6ec4ff'; ctx.shadowBlur = 10;
    ctx.fillRect(x - 4, y + u.h * 0.25, 8, 6);
    ctx.shadowBlur = 0;
    // Shoulder cannons
    ctx.fillStyle = '#222';
    ctx.fillRect(x - u.w * 0.4, y + u.h * 0.20, 5, 7);
    ctx.fillRect(x + u.w * 0.35, y + u.h * 0.20, 5, 7);
    // Big arm + plasma cannon
    ctx.fillStyle = '#5a5a78';
    ctx.fillRect(x - u.w * 0.5, y + u.h * 0.30, u.w, 8);
    ctx.fillStyle = '#222';
    ctx.fillRect(x + facing * u.w * 0.4, y + u.h * 0.32, facing * u.w * 0.5, 6);
    ctx.fillStyle = '#ff90ee';
    ctx.shadowColor = '#ff90ee'; ctx.shadowBlur = 8;
    ctx.fillRect(x + facing * u.w * 0.8, y + u.h * 0.31, facing * 4, 8);
    ctx.shadowBlur = 0;
  };

  const drawHover = (u, x, y, facing, walk, bodyColor) => {
    const bob = Math.sin(performance.now() / 200) * 2;
    // Hover disc body
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(x, y + u.h * 0.5 + bob, u.w * 0.5, u.h * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    // Top dome / cockpit
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(x, y + u.h * 0.35 + bob, u.w * 0.22, u.h * 0.18, 0, Math.PI, 0);
    ctx.fill();
    // Pilot silhouette
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(x, y + u.h * 0.32 + bob, 3, 0, Math.PI * 2);
    ctx.fill();
    // Pink/magenta hover glow under the disc
    ctx.fillStyle = 'rgba(255, 144, 238, 0.55)';
    ctx.beginPath();
    ctx.ellipse(x, y + u.h * 0.65 + bob, u.w * 0.45, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Side wing pods with thrusters
    ctx.fillStyle = '#444';
    ctx.fillRect(x - u.w * 0.5, y + u.h * 0.48 + bob, 5, 6);
    ctx.fillRect(x + u.w * 0.45, y + u.h * 0.48 + bob, 5, 6);
    ctx.fillStyle = '#ffd56e';
    ctx.fillRect(x - u.w * 0.5 + 1, y + u.h * 0.54 + bob, 3, 3);
    ctx.fillRect(x + u.w * 0.45 + 1, y + u.h * 0.54 + bob, 3, 3);
    // Forward laser cannon
    ctx.fillStyle = '#222';
    ctx.fillRect(x + facing * u.w * 0.25, y + u.h * 0.5 + bob - 1, facing * u.w * 0.4, 3);
    ctx.fillStyle = '#ff90ee';
    ctx.shadowColor = '#ff90ee'; ctx.shadowBlur = 6;
    ctx.fillRect(x + facing * u.w * 0.6, y + u.h * 0.5 + bob - 1, facing * 3, 3);
    ctx.shadowBlur = 0;
  };

  // ---- Hero drawers (unique silhouettes per legendary unit) ----
  const drawHeroGrog = (u, x, y, facing, walk, bodyColor) => {
    // Mammoth-sized beast with rider
    const gallop = Math.sin(u.walkPhase * 1.4) * 3;
    // Tusks first (under)
    ctx.fillStyle = '#f6e9c2';
    ctx.beginPath();
    ctx.moveTo(x + facing * u.w * 0.65, y + u.h * 0.55);
    ctx.lineTo(x + facing * u.w * 0.92, y + u.h * 0.78);
    ctx.lineTo(x + facing * u.w * 0.78, y + u.h * 0.60);
    ctx.closePath();
    ctx.fill();
    // Body (shaggy brown)
    ctx.fillStyle = '#5a3a22';
    ctx.fillRect(x - u.w * 0.55, y + u.h * 0.4, u.w * 1.1, u.h * 0.35);
    // Fur tufts
    ctx.fillStyle = '#3a2812';
    for (let i = -6; i <= 6; i++) {
      ctx.fillRect(x + i * 4, y + u.h * 0.38, 3, 5);
    }
    // Head
    ctx.fillStyle = '#5a3a22';
    ctx.beginPath();
    ctx.ellipse(x + facing * u.w * 0.5, y + u.h * 0.45, u.w * 0.25, u.h * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    // Trunk
    ctx.strokeStyle = '#5a3a22';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + facing * u.w * 0.6, y + u.h * 0.50);
    ctx.lineTo(x + facing * u.w * 0.78, y + u.h * 0.72);
    ctx.lineTo(x + facing * u.w * 0.70, y + u.h * 0.85);
    ctx.stroke();
    // Eye
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + facing * u.w * 0.48, y + u.h * 0.42, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.fillRect(x + facing * u.w * 0.48, y + u.h * 0.42, 1.5, 1.5);
    // Legs
    ctx.fillStyle = '#3a2812';
    ctx.fillRect(x - u.w * 0.35, y + u.h * 0.75, 8, u.h * 0.25 + gallop);
    ctx.fillRect(x + u.w * 0.10, y + u.h * 0.75, 8, u.h * 0.25 - gallop);
    ctx.fillRect(x - u.w * 0.05, y + u.h * 0.75, 8, u.h * 0.25 - gallop);
    ctx.fillRect(x + u.w * 0.30, y + u.h * 0.75, 8, u.h * 0.25 + gallop);
    // Tribal rider on top
    ctx.fillStyle = '#7a4222';
    ctx.fillRect(x - 5, y + u.h * 0.20, 10, 14);
    ctx.fillStyle = '#2a1808';
    ctx.beginPath();
    ctx.arc(x, y + u.h * 0.18, 6, 0, Math.PI * 2);
    ctx.fill();
    // Spear
    ctx.strokeStyle = '#5a3a18';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + facing * 6, y + u.h * 0.28);
    ctx.lineTo(x + facing * 14, y + u.h * 0.05);
    ctx.stroke();
    ctx.fillStyle = '#aaa';
    ctx.beginPath();
    ctx.moveTo(x + facing * 14, y + u.h * 0.05);
    ctx.lineTo(x + facing * 18, y + u.h * 0.02);
    ctx.lineTo(x + facing * 13, y + u.h * 0.10);
    ctx.closePath();
    ctx.fill();
  };

  const drawHeroPaladin = (u, x, y, facing, walk, bodyColor) => {
    const swing = walk * 3;
    const base = drawHumanoidBase(x, y, u.h, u.w * 1.1, facing, swing, bodyColor, {
      skin: '#e8b48a',
      pantsColor: '#444',
      bootColor: '#222',
      belt: '#8a6822',
    });
    // Pauldrons (large gold)
    ctx.fillStyle = '#fcd34d';
    ctx.fillRect(x - u.w * 0.42, y + base.headR * 2, 8, 6);
    ctx.fillRect(x + u.w * 0.42 - 8, y + base.headR * 2, 8, 6);
    // Cape (flowing)
    ctx.fillStyle = '#c43972';
    ctx.beginPath();
    ctx.moveTo(x - facing * (u.w * 0.30), y + base.headR * 2);
    ctx.lineTo(x - facing * (u.w * 0.55), y + u.h * 0.85);
    ctx.lineTo(x - facing * (u.w * 0.15), y + u.h * 0.80);
    ctx.closePath();
    ctx.fill();
    // Chest cross (gold)
    ctx.strokeStyle = '#fcd34d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + base.headR * 2 + 4); ctx.lineTo(x, y + u.h * 0.55);
    ctx.moveTo(x - 5, y + u.h * 0.30); ctx.lineTo(x + 5, y + u.h * 0.30);
    ctx.stroke();
    // Crowned helmet
    ctx.fillStyle = '#bcc4cc';
    ctx.beginPath();
    ctx.arc(x, base.headCenterY, base.headR + 2, Math.PI, 0);
    ctx.lineTo(x + base.headR + 2, base.headCenterY + base.headR);
    ctx.lineTo(x - base.headR - 2, base.headCenterY + base.headR);
    ctx.closePath();
    ctx.fill();
    // Helmet crown spikes (gold)
    ctx.fillStyle = '#fcd34d';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * 4 - 1, base.headCenterY - base.headR - 1);
      ctx.lineTo(x + i * 4 + 1, base.headCenterY - base.headR - 1);
      ctx.lineTo(x + i * 4, base.headCenterY - base.headR - 5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#0e1015';
    ctx.fillRect(x - base.headR + 1, base.headCenterY - 1, base.headR * 2 - 2, 2);
    // Shield (back arm)
    ctx.fillStyle = '#dadce0';
    ctx.beginPath();
    ctx.arc(x - facing * (u.w * 0.3), y + u.h * 0.5, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fcd34d';
    ctx.fillRect(x - facing * (u.w * 0.3) - 4, y + u.h * 0.5 - 1, 8, 2);
    ctx.fillRect(x - facing * (u.w * 0.3) - 1, y + u.h * 0.5 - 4, 2, 8);
    // Huge sword
    drawArmAndWeapon(x, y, { x: base.shoulderX, y: base.shoulderY }, { x: base.handX + facing * 6, y: base.handY - 3 }, bodyColor, (hx, hy) => {
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(facing * -1.4);
      ctx.fillStyle = '#fcd34d';
      ctx.fillRect(-7, -2, 14, 3);
      const g = ctx.createLinearGradient(0, -30, 0, 0);
      g.addColorStop(0, '#fff'); g.addColorStop(1, '#9aa1a8');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-2.5, 0); ctx.lineTo(2.5, 0);
      ctx.lineTo(1.5, -30); ctx.lineTo(0, -34); ctx.lineTo(-1.5, -30);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
  };

  const drawHeroGeneral = (u, x, y, facing, walk, bodyColor) => {
    const swing = walk * 3;
    const base = drawHumanoidBase(x, y, u.h, u.w, facing, swing, bodyColor, {
      skin: '#e0ad8a',
      pantsColor: '#3a2818',
      bootColor: '#1a1208',
      belt: '#5a4022',
    });
    // Medal cluster on chest
    ctx.fillStyle = '#fcd34d';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(x - 6 + i * 6, y + base.headR * 2 + 9, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Bicorne hat
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.moveTo(x - base.headR - 4, base.headCenterY - 3);
    ctx.lineTo(x + base.headR + 4, base.headCenterY - 3);
    ctx.lineTo(x + base.headR + 2, base.headCenterY - 9);
    ctx.lineTo(x - base.headR - 2, base.headCenterY - 9);
    ctx.closePath();
    ctx.fill();
    // Gold trim
    ctx.fillStyle = '#fcd34d';
    ctx.fillRect(x - base.headR - 4, base.headCenterY - 4, (base.headR + 4) * 2, 1);
    // Saber + holster
    drawArmAndWeapon(x, y, { x: base.shoulderX, y: base.shoulderY }, { x: base.handX + facing * 4, y: base.handY - 2 }, bodyColor, (hx, hy) => {
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(facing * -0.8);
      ctx.fillStyle = '#fcd34d';
      ctx.fillRect(-3, -1, 6, 2);
      ctx.fillStyle = '#cdd1d6';
      ctx.beginPath();
      ctx.moveTo(0, -1); ctx.lineTo(3, -1); ctx.lineTo(2, -24); ctx.lineTo(0, -26); ctx.lineTo(-1, -24); ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
  };

  const drawHeroSeal = (u, x, y, facing, walk, bodyColor) => {
    const swing = walk * 3;
    const base = drawHumanoidBase(x, y, u.h, u.w, facing, swing, bodyColor, {
      skin: '#c08c70',
      pantsColor: '#1a1a14',
      bootColor: '#0a0a0a',
      belt: '#2a2a1a',
    });
    // Full tactical mask
    ctx.fillStyle = '#1a1a14';
    ctx.beginPath(); ctx.arc(x, base.headCenterY, base.headR + 1, 0, Math.PI * 2); ctx.fill();
    // Red goggles
    ctx.fillStyle = '#222';
    ctx.fillRect(x - base.headR, base.headCenterY - 1, base.headR * 2, 3);
    ctx.fillStyle = '#ff3333';
    ctx.shadowColor = '#ff3333'; ctx.shadowBlur = 6;
    ctx.fillRect(x - base.headR + 1, base.headCenterY, base.headR - 1, 1);
    ctx.fillRect(x + 1, base.headCenterY, base.headR - 1, 1);
    ctx.shadowBlur = 0;
    // Tac vest chest plate
    ctx.fillStyle = '#0a1208';
    ctx.fillRect(x - u.w * 0.25, y + base.headR * 2 + 4, u.w * 0.50, 6);
    // Backpack
    ctx.fillStyle = '#2a3520';
    ctx.fillRect(x - facing * (u.w * 0.3), y + base.headR * 2 + 4, 4, 14);
    // Heavy sniper rifle with bipod
    drawArmAndWeapon(x, y, { x: base.shoulderX, y: base.shoulderY }, { x: base.handX + facing * 4, y: base.handY + 1 }, bodyColor, (hx, hy) => {
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(hx - facing * 6, hy - 1, facing * 36, 2.5);
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(hx + facing * 8, hy - 5, facing * 14, 4);
      // Laser dot trail
      ctx.fillStyle = '#ff3333';
      ctx.shadowColor = '#ff3333'; ctx.shadowBlur = 4;
      ctx.fillRect(hx + facing * 30, hy, facing * 2, 1);
      ctx.shadowBlur = 0;
      // Bipod
      ctx.strokeStyle = '#0a0a0a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx + facing * 26, hy + 1); ctx.lineTo(hx + facing * 26, hy + 8);
      ctx.stroke();
    });
  };

  const drawHeroTitan = (u, x, y, facing, walk, bodyColor) => {
    const swing = walk * 3;
    // Massive bipedal mech
    // Legs (heavy)
    ctx.fillStyle = '#2a3a55';
    ctx.fillRect(x - u.w * 0.32, y + u.h * 0.55, 10, u.h * 0.45 + swing);
    ctx.fillRect(x + u.w * 0.20, y + u.h * 0.55, 10, u.h * 0.45 - swing);
    // Feet
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(x - u.w * 0.38, y + u.h - 5, 18, 5);
    ctx.fillRect(x + u.w * 0.14, y + u.h - 5, 18, 5);
    // Torso (gradient)
    const g = ctx.createLinearGradient(x - u.w / 2, y + u.h * 0.18, x + u.w / 2, y + u.h * 0.18);
    g.addColorStop(0, '#3a3a55');
    g.addColorStop(0.5, '#7ec8ff');
    g.addColorStop(1, '#3a3a55');
    ctx.fillStyle = g;
    ctx.fillRect(x - u.w * 0.4, y + u.h * 0.10, u.w * 0.8, u.h * 0.5);
    // Glowing core (large)
    const pulse = 0.6 + Math.sin(performance.now() / 180) * 0.3;
    ctx.fillStyle = `rgba(110,196,255,${pulse})`;
    ctx.shadowColor = '#6ec4ff'; ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(x, y + u.h * 0.32, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y + u.h * 0.32, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Head with horns
    ctx.fillStyle = '#1a2244';
    ctx.beginPath();
    ctx.arc(x, y + u.h * 0.06, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7ec8ff';
    ctx.fillRect(x - 4, y + u.h * 0.06, 8, 2);
    // Horns
    ctx.beginPath();
    ctx.moveTo(x - 6, y + u.h * 0.02); ctx.lineTo(x - 10, y - 8); ctx.lineTo(x - 4, y - 2);
    ctx.moveTo(x + 6, y + u.h * 0.02); ctx.lineTo(x + 10, y - 8); ctx.lineTo(x + 4, y - 2);
    ctx.fillStyle = '#a89cff';
    ctx.fill();
    // Twin arm-mounted plasma cannons
    ctx.fillStyle = '#5a5a78';
    ctx.fillRect(x - facing * (u.w * 0.5), y + u.h * 0.20, facing * u.w, 8);
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(x + facing * (u.w * 0.4), y + u.h * 0.22, facing * (u.w * 0.45), 5);
    // Glow muzzle
    ctx.fillStyle = '#7ec8ff';
    ctx.shadowColor = '#7ec8ff'; ctx.shadowBlur = 10;
    ctx.fillRect(x + facing * (u.w * 0.83), y + u.h * 0.22, facing * 5, 5);
    ctx.shadowBlur = 0;
    // Shoulder spikes
    ctx.fillStyle = '#7ec8ff';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x - u.w * 0.3 + i * 4, y + u.h * 0.10);
      ctx.lineTo(x - u.w * 0.3 + i * 4 + 3, y + u.h * 0.10);
      ctx.lineTo(x - u.w * 0.3 + i * 4 + 1.5, y + u.h * 0.02);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + u.w * 0.18 + i * 4, y + u.h * 0.10);
      ctx.lineTo(x + u.w * 0.18 + i * 4 + 3, y + u.h * 0.10);
      ctx.lineTo(x + u.w * 0.18 + i * 4 + 1.5, y + u.h * 0.02);
      ctx.closePath();
      ctx.fill();
    }
  };

  // ============================================================
  //  VECTOR SPRITE ENGINE
  //  Each unit is described as an SVG (built parametrically for
  //  humanoids so they all share proportions, bespoke for mounts /
  //  vehicles). SVGs are rasterized once into <img> at high res and
  //  blitted with drawImage — crisp, swappable, App-Store clean.
  //  If a sprite hasn't loaded yet (or none exists) we fall back to
  //  the hand-coded canvas drawer below.
  // ============================================================

  // Sprites are authored facing RIGHT, feet centered at the bottom of
  // the viewBox. The engine mirrors them for the enemy side.
  const SPRITE_VB = { w: 120, h: 200 };        // humanoid viewBox
  const spriteCache = {};                       // key -> { img, ready }

  // ---- Parametric humanoid ----
  // A clean cel-shaded marcher: dark outline (via stroke), 2-tone
  // fills, a mid-stride pose so it reads as walking. cfg picks palette,
  // headgear and weapon so all 15 humans look like one art set.
  function svgHumanoid(cfg) {
    const c = Object.assign({
      skin: '#e0a86b', skinSh: '#c2854a',
      torso: '#7a5a3a', torsoSh: '#5c4329',
      legs: '#4a3320', legsSh: '#2f2010', boots: '#241810',
      hair: '#2c1c0e', accent: '#cccccc', accentSh: '#8a8a8a',
      headgear: 'none', weapon: 'none', cape: null,
    }, cfg);
    const OUT = '#15110c';                       // outline color
    const O = `stroke="${OUT}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;
    // limb(): dark outline underlay + colored fill on top → bold cel outline
    const limb = (d, col, w) =>
      `<path d="${d}" fill="none" stroke="${OUT}" stroke-width="${w + 4}" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
    const parts = [];

    // Cape (behind everything)
    if (c.cape) {
      parts.push(`<path d="M58 68 Q34 100 30 156 L60 142 L68 78 Z" fill="${c.cape}" ${O}/>`);
    }
    // Back arm (behind torso) — bent, hanging
    parts.push(limb('M55 74 q-13 10 -12 30', c.skinSh, 12));
    // Back leg (stepped back)
    parts.push(limb('M55 116 l-9 42 -3 22', c.legsSh, 15));
    parts.push(`<path d="M37 190 l20 0" fill="none" stroke="${c.boots}" stroke-width="10" stroke-linecap="round"/>`);
    // Front leg (stepped forward)
    parts.push(limb('M66 116 l10 40 5 22', c.legs, 15));
    parts.push(`<path d="M76 190 l22 0" fill="none" stroke="${c.boots}" stroke-width="10" stroke-linecap="round"/>`);
    // Torso
    parts.push(`<path d="M43 64 q17 -9 34 0 l5 52 q-22 9 -44 0 Z" fill="${c.torso}" ${O}/>`);
    parts.push(`<path d="M60 64 l5 0 5 52 q-5 1.6 -10 2.6 Z" fill="${c.torsoSh}"/>`);
    if (c.belt) parts.push(`<rect x="40" y="108" width="40" height="7" rx="2" fill="${c.belt}" ${O}/>`);
    // Neck
    parts.push(`<path d="M55 56 l10 0 0 11 -10 0 Z" fill="${c.skinSh}"/>`);
    // Head
    parts.push(`<circle cx="60" cy="40" r="20" fill="${c.skin}" ${O}/>`);
    parts.push(`<path d="M60 20 a20 20 0 0 1 0 40 Z" fill="${c.skinSh}" opacity="0.5"/>`);
    // Hair (unless a covering helmet)
    if (!['helm', 'visor', 'brodie', 'combat'].includes(c.headgear)) {
      parts.push(`<path d="M40 40 q-2 -25 20 -25 q22 0 20 25 q-7 -13 -20 -13 q-13 0 -20 13 Z" fill="${c.hair}" ${O}/>`);
    }
    // Face — brow + eye + nose, facing right
    parts.push(`<circle cx="71" cy="40" r="2.6" fill="${OUT}"/>`);
    parts.push(`<path d="M78 44 q3 2 0 5" fill="none" stroke="${c.skinSh}" stroke-width="2"/>`);
    // Headgear
    if (c.headgear === 'helm') {            // medieval great-helm
      parts.push(`<path d="M39 42 a21 22 0 0 1 42 0 l0 5 -42 0 Z" fill="${c.accent}" ${O}/>`);
      parts.push(`<rect x="58" y="38" width="22" height="4" rx="1" fill="${OUT}"/>`);
      parts.push(`<rect x="58" y="14" width="4" height="12" rx="2" fill="${c.accentSh}" ${O}/>`);
      parts.push(`<path d="M60 14 l8 -3 -8 -3 Z" fill="${c.crest || '#c43838'}"/>`);
    } else if (c.headgear === 'hood') {     // archer hood
      parts.push(`<path d="M37 44 q2 -29 23 -29 q21 0 23 29 q-11 -15 -23 -15 q-12 0 -23 15 Z" fill="${c.accent}" ${O}/>`);
    } else if (c.headgear === 'brodie') {   // WW1 helmet
      parts.push(`<path d="M35 38 a25 13 0 0 1 50 0 Z" fill="${c.accent}" ${O}/>`);
      parts.push(`<ellipse cx="60" cy="38" rx="25" ry="4.5" fill="${c.accentSh}"/>`);
    } else if (c.headgear === 'combat') {   // modern combat helmet
      parts.push(`<path d="M38 42 a22 21 0 0 1 44 -2 l0 6 -44 0 Z" fill="${c.accent}" ${O}/>`);
      parts.push(`<rect x="40" y="40" width="42" height="4" fill="${c.accentSh}"/>`);
    } else if (c.headgear === 'visor') {    // future visor helmet
      parts.push(`<path d="M39 42 a21 22 0 0 1 42 0 l0 7 -42 0 Z" fill="${c.accent}" ${O}/>`);
      parts.push(`<rect x="55" y="36" width="26" height="7" rx="3.5" fill="#6ec4ff"/>`);
      parts.push(`<rect x="55" y="36" width="26" height="2.5" rx="1" fill="#bfeaff"/>`);
    } else if (c.headgear === 'bandana') {  // sniper wrap
      parts.push(`<path d="M40 38 a20 20 0 0 1 40 0 l0 5 -40 0 Z" fill="${c.accent}" ${O}/>`);
      parts.push(`<path d="M40 40 l-10 4 4 6 8 -4 Z" fill="${c.accent}" ${O}/>`);
    }

    // Weapon + front arm (in front of torso)
    parts.push(weaponSVG(c.weapon, c, O));
    return svgWrap(parts.join(''));
  }

  function weaponSVG(weapon, c, O) {
    const OUT = '#15110c';
    const arm = (d) =>
      `<path d="${d}" fill="none" stroke="${OUT}" stroke-width="16" stroke-linecap="round"/>` +
      `<path d="${d}" fill="none" stroke="${c.skin}" stroke-width="12" stroke-linecap="round"/>`;
    switch (weapon) {
      case 'club':
        return arm('M66 78 q18 6 24 18') +
          `<g transform="translate(92 92) rotate(28)"><rect x="-5" y="-2" width="10" height="34" rx="4" fill="#7a4e22" ${O}/><circle cx="0" cy="-6" r="13" fill="#8a5a2a" ${O}/></g>`;
      case 'sling':
        return arm('M66 76 q16 -4 22 -18') +
          `<circle cx="92" cy="48" r="11" fill="none" stroke="#6a4828" stroke-width="3"/><circle cx="92" cy="37" r="4" fill="#888" ${O}/>`;
      case 'sword':
        return arm('M66 78 q20 2 28 -6') +
          `<g transform="translate(96 70) rotate(-32)"><rect x="-7" y="0" width="14" height="4" fill="#caa84a" ${O}/><path d="M-3 0 L3 0 L2 -42 L0 -48 L-2 -42 Z" fill="#dfe4e8" ${O}/></g>`;
      case 'bow':
        return arm('M66 78 q22 0 30 -2') +
          `<path d="M98 50 q16 28 0 56" fill="none" stroke="#6a3a1a" stroke-width="5"/><path d="M98 50 L98 106" stroke="#ddd" stroke-width="1.5"/><path d="M82 78 L112 78" stroke="#3a2210" stroke-width="3"/>`;
      case 'rifle':
        return arm('M66 80 q20 0 30 2') +
          `<g transform="translate(70 84)"><rect x="0" y="-3" width="44" height="6" rx="2" fill="#222" ${O}/><rect x="-8" y="-2" width="12" height="8" rx="2" fill="#5a3a1a" ${O}/></g>`;
      case 'cannon':
        return arm('M64 80 q18 -2 26 -6') +
          `<g transform="translate(74 70) rotate(-8)"><rect x="0" y="-9" width="40" height="18" rx="6" fill="#2c2c2c" ${O}/><rect x="36" y="-10" width="6" height="20" rx="2" fill="#181818"/></g>`;
      case 'sniper':
        return arm('M66 82 q22 0 34 0') +
          `<g transform="translate(68 86)"><rect x="0" y="-2.5" width="54" height="5" rx="2" fill="#2a2a1a" ${O}/><rect x="20" y="-7" width="14" height="5" rx="2" fill="#111"/><rect x="-8" y="-1.5" width="12" height="7" rx="2" fill="#3a3a22" ${O}/></g>`;
      case 'laser':
        return arm('M66 80 q20 0 30 0') +
          `<g transform="translate(70 84)"><rect x="0" y="-4" width="40" height="9" rx="4" fill="#2a3550" ${O}/><rect x="34" y="-2" width="12" height="4" rx="2" fill="#6ec4ff"/><circle cx="46" cy="0" r="3" fill="#bfeaff"/></g>`;
      default:
        return arm('M66 80 q14 8 12 26');
    }
  }

  function svgWrap(inner) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SPRITE_VB.w} ${SPRITE_VB.h}" width="${SPRITE_VB.w*2}" height="${SPRITE_VB.h*2}">${inner}</svg>`;
  }
  // Bespoke sprites (mounts / vehicles) use their own viewBox aspect.
  function svgWrapVB(w, h, inner) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w*2}" height="${h*2}">${inner}</svg>`;
  }

  // ---- Bespoke beast / vehicle sprites (authored facing RIGHT) ----
  const OUTC = '#15110c';
  const Ob = `stroke="${OUTC}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;

  function svgDino() {  // raptor + tribal rider
    return svgWrapVB(170, 150, `
      <path d="M150 96 q14 -10 16 2 q-8 4 -16 4 Z" fill="#4d7a3c" ${Ob}/>
      <path d="M40 92 Q10 88 16 70 Q26 80 44 84 Z" fill="#3f6831" ${Ob}/>
      <path d="M44 96 q-6 26 -2 44 l12 0 q-2 -22 4 -40 Z" fill="#3f6831" ${Ob}/>
      <path d="M108 98 q-2 26 2 44 l12 0 q0 -22 4 -42 Z" fill="#4d7a3c" ${Ob}/>
      <path d="M44 132 l18 0" fill="none" stroke="#2c4a22" stroke-width="9" stroke-linecap="round"/>
      <path d="M110 134 l18 0" fill="none" stroke="#2c4a22" stroke-width="9" stroke-linecap="round"/>
      <path d="M40 96 q30 -28 78 -10 q26 8 32 16 q-30 14 -70 12 q-30 -2 -40 -18 Z" fill="#4d7a3c" ${Ob}/>
      <path d="M118 86 l30 6 q6 4 4 12 l-22 -4 q-8 -6 -12 -14 Z" fill="#56894a" ${Ob}/>
      <path d="M150 96 l10 -1" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
      <circle cx="140" cy="92" r="2.6" fill="${OUTC}"/>
      <path d="M70 70 q6 -16 18 -10 l-3 12 Z" fill="#7a4e22" ${Ob}/>
      <circle cx="80" cy="58" r="8" fill="#d99a63" ${Ob}/>
      <path d="M64 60 q12 -4 20 6" fill="none" stroke="${OUTC}" stroke-width="9" stroke-linecap="round"/>
      <path d="M84 56 l18 -10" fill="none" stroke="#5a3a18" stroke-width="3"/>
    `);
  }

  function svgHorse() {  // armored warhorse + lancer w/ red caparison
    return svgWrapVB(180, 150, `
      <path d="M150 78 q22 -6 24 8 q-2 10 -14 8 Z" fill="#7a5a3a" ${Ob}/>
      <path d="M40 80 q60 -22 104 -6 q20 8 18 26 q-70 16 -120 6 q-12 -10 -2 -32 Z" fill="#8a6a46" ${Ob}/>
      <path d="M30 84 q-14 -4 -10 -22 q12 6 24 12 Z" fill="#6e4f30" ${Ob}/>
      <path d="M40 96 l-4 44 12 0 4 -40 Z" fill="#6e4f30" ${Ob}/>
      <path d="M70 100 l-2 42 12 0 2 -40 Z" fill="#7a5a3a" ${Ob}/>
      <path d="M118 100 l-2 42 12 0 2 -40 Z" fill="#6e4f30" ${Ob}/>
      <path d="M144 96 l2 44 12 0 -2 -42 Z" fill="#7a5a3a" ${Ob}/>
      <path d="M44 104 q40 18 96 2 l-6 30 -84 0 Z" fill="#c43838" ${Ob}/>
      <path d="M150 70 q16 -14 14 -30 q-10 4 -16 14 Z" fill="#8a6a46" ${Ob}/>
      <circle cx="158" cy="66" r="2.4" fill="${OUTC}"/>
      <path d="M150 40 q-6 8 -2 18" fill="none" stroke="#2c1c0e" stroke-width="4"/>
      <path d="M82 56 q4 -18 18 -14 l-2 16 Z" fill="#9aa0ab" ${Ob}/>
      <circle cx="92" cy="46" r="9" fill="#c2c8d0" ${Ob}/>
      <rect x="90" y="44" width="12" height="3" fill="${OUTC}"/>
      <path d="M100 50 l46 -30" fill="none" stroke="#caa84a" stroke-width="4"/>
      <path d="M146 20 l8 -3 -6 8 Z" fill="#dfe4e8" ${Ob}/>
    `);
  }

  function svgMammoth() {  // hero: woolly mammoth + chief
    return svgWrapVB(180, 160, `
      <path d="M44 90 Q14 96 18 74 Q30 86 50 88 Z" fill="#5a3a22" ${Ob}/>
      <path d="M40 88 q34 -34 92 -16 q34 10 30 40 q-6 26 -44 30 q-58 6 -82 -14 q-14 -16 4 -40 Z" fill="#6e4426" ${Ob}/>
      <g stroke="#4a2e16" stroke-width="3"><path d="M48 70 l0 10"/><path d="M64 64 l0 12"/><path d="M84 62 l0 12"/><path d="M104 64 l0 12"/><path d="M124 70 l0 10"/></g>
      <path d="M132 92 q22 -4 30 10 q-4 12 -18 10 Z" fill="#6e4426" ${Ob}/>
      <ellipse cx="150" cy="88" rx="22" ry="20" fill="#6e4426" ${Ob}/>
      <path d="M158 96 q4 28 -6 44 q-10 2 -10 -8 q2 -22 6 -36 Z" fill="#f3e6c0" ${Ob}/>
      <path d="M148 96 q12 26 0 48" fill="none" stroke="#5a3a22" stroke-width="9" stroke-linecap="round"/>
      <circle cx="156" cy="82" r="2.6" fill="${OUTC}"/>
      <path d="M44 96 l-4 46 14 0 2 -44 Z" fill="#4a2e16" ${Ob}/>
      <path d="M84 100 l-2 44 14 0 2 -44 Z" fill="#5a3a22" ${Ob}/>
      <path d="M120 100 l2 44 14 0 -2 -44 Z" fill="#4a2e16" ${Ob}/>
      <path d="M70 54 q6 -20 22 -14 l-3 16 Z" fill="#8a5a2a" ${Ob}/>
      <circle cx="84" cy="42" r="9" fill="#d99a63" ${Ob}/>
      <path d="M74 34 q10 -10 22 -2 q-6 -2 -22 2 Z" fill="#2c1c0e" ${Ob}/>
      <path d="M92 40 l22 -16" fill="none" stroke="#5a3a18" stroke-width="3"/>
      <path d="M114 24 l8 -2 -6 8 Z" fill="#aaa" ${Ob}/>
    `);
  }

  function svgTankSteam() {  // industrial steam tank
    return svgWrapVB(170, 120, `
      <rect x="20" y="96" width="130" height="14" rx="7" fill="#1a1a1a" ${Ob}/>
      <g fill="#3a3a3a">${Array.from({length:9},(_,i)=>`<circle cx="${30+i*15}" cy="103" r="6" stroke="${OUTC}" stroke-width="2"/>`).join('')}</g>
      <path d="M28 96 q0 -34 30 -34 l70 0 q16 0 16 16 l0 22 Z" fill="#6b5848" ${Ob}/>
      <rect x="60" y="44" width="44" height="22" rx="5" fill="#7a6452" ${Ob}/>
      <rect x="100" y="50" width="46" height="9" rx="4" fill="#2a2a2a" ${Ob}/>
      <rect x="44" y="34" width="12" height="22" rx="3" fill="#3a2a22" ${Ob}/>
      <ellipse cx="50" cy="30" rx="9" ry="5" fill="rgba(140,140,140,0.6)"/>
      <circle cx="80" cy="78" r="6" fill="#caa84a" ${Ob}/>
    `);
  }

  function svgTankModern() {  // modern MBT
    return svgWrapVB(180, 110, `
      <rect x="16" y="84" width="150" height="16" rx="8" fill="#1a1a1a" ${Ob}/>
      <g fill="#333">${Array.from({length:7},(_,i)=>`<circle cx="${34+i*20}" cy="92" r="9" stroke="${OUTC}" stroke-width="2"/>`).join('')}</g>
      <path d="M22 84 l8 -22 120 0 8 22 Z" fill="#5a6a40" ${Ob}/>
      <path d="M54 62 q4 -16 28 -16 l40 0 q14 0 14 16 Z" fill="#66794a" ${Ob}/>
      <rect x="118" y="50" width="56" height="7" rx="3" fill="#3a3a2a" ${Ob}/>
      <rect x="166" y="48" width="8" height="11" rx="2" fill="#222" ${Ob}/>
      <rect x="78" y="38" width="16" height="12" rx="2" fill="#44502f" ${Ob}/>
    `);
  }

  function svgMech() {  // future bipedal mech
    return svgWrapVB(150, 160, `
      <path d="M42 92 l-10 36 -2 24 18 0 4 -24 Z" fill="#7a6fb0" ${Ob}/>
      <path d="M104 92 l10 36 2 24 -18 0 -4 -24 Z" fill="#6a5fa0" ${Ob}/>
      <path d="M26 150 l24 0" fill="none" stroke="#3a3460" stroke-width="10" stroke-linecap="round"/>
      <path d="M96 150 l24 0" fill="none" stroke="#3a3460" stroke-width="10" stroke-linecap="round"/>
      <path d="M40 44 q36 -14 70 0 l6 50 q-40 16 -82 0 Z" fill="#8a7fc0" ${Ob}/>
      <path d="M76 44 l6 0 6 50 q-6 2 -12 3 Z" fill="#6a5fa0"/>
      <rect x="52" y="56" width="46" height="16" rx="4" fill="#2a2350" ${Ob}/>
      <rect x="56" y="59" width="38" height="9" rx="3" fill="#6ec4ff"/>
      <path d="M110 56 l34 -6 q8 4 4 14 l-30 4 Z" fill="#5a5090" ${Ob}/>
      <circle cx="146" cy="56" r="5" fill="#ff6b6b" ${Ob}/>
      <path d="M40 56 l-22 4 q-6 6 0 14 l24 -4 Z" fill="#6a5fa0" ${Ob}/>
    `);
  }

  function svgHover() {  // future hover gunship
    return svgWrapVB(160, 120, `
      <ellipse cx="80" cy="96" rx="60" ry="9" fill="rgba(255,144,238,0.4)"/>
      <path d="M24 74 q56 -26 112 0 q-56 22 -112 0 Z" fill="#c46ad6" ${Ob}/>
      <path d="M48 66 q32 -22 64 0 q-32 12 -64 0 Z" fill="#e6b8f0" ${Ob}/>
      <ellipse cx="80" cy="60" rx="14" ry="10" fill="#bfeaff" ${Ob}/>
      <circle cx="84" cy="58" r="3" fill="#2a2350"/>
      <rect x="120" y="72" width="34" height="7" rx="3" fill="#2a2350" ${Ob}/>
      <circle cx="154" cy="75" r="4" fill="#ff90ee"/>
      <path d="M22 78 l-10 2 4 8 8 -2 Z" fill="#a050c0" ${Ob}/>
      <path d="M138 78 l10 2 -4 8 -8 -2 Z" fill="#a050c0" ${Ob}/>
    `);
  }

  function svgTitan() {  // hero: armored future titan
    return svgWrapVB(150, 170, `
      <path d="M40 96 l-10 40 -2 26 20 0 4 -26 Z" fill="#3a4a78" ${Ob}/>
      <path d="M106 96 l10 40 2 26 -20 0 -4 -26 Z" fill="#2e3c64" ${Ob}/>
      <path d="M24 158 l26 0" fill="none" stroke="#1d2540" stroke-width="12" stroke-linecap="round"/>
      <path d="M98 158 l26 0" fill="none" stroke="#1d2540" stroke-width="12" stroke-linecap="round"/>
      <path d="M36 44 q38 -16 76 0 l8 56 q-46 18 -92 0 Z" fill="#46568a" ${Ob}/>
      <path d="M74 44 l8 0 8 56 q-8 3 -16 4 Z" fill="#2e3c64"/>
      <path d="M30 50 l-16 8 q-6 8 2 18 l20 -8 Z" fill="#3a4a78" ${Ob}/>
      <path d="M118 50 l16 8 q6 8 -2 18 l-20 -8 Z" fill="#3a4a78" ${Ob}/>
      <circle cx="36" cy="92" r="9" fill="#7ec8ff"/><circle cx="112" cy="92" r="9" fill="#7ec8ff"/>
      <path d="M52 30 q22 -16 44 0 l0 18 -44 0 Z" fill="#54649a" ${Ob}/>
      <path d="M58 36 l32 0 0 8 -32 0 Z" fill="#ff5a5a"/>
      <path d="M52 30 l-6 -14 10 6 Z" fill="#54649a" ${Ob}/>
      <path d="M96 30 l6 -14 -10 6 Z" fill="#54649a" ${Ob}/>
    `);
  }

  // ---- Per-unit sprite definitions ----
  // Humanoid configs share the builder; bespoke SVGs (mounts, vehicles,
  // beasts) are authored as functions returning a full <svg>.
  const SPRITE_DEFS = {
    // ---- Stone Age ----
    club:  () => svgHumanoid({ skin:'#d99a63', skinSh:'#b87b46', torso:'#caa17a', torsoSh:'#a87f56', legs:'#8a5a36', legsSh:'#5e3f24', boots:'#4a2f18', hair:'#2c1c0e', weapon:'club' }),
    sling: () => svgHumanoid({ skin:'#d99a63', skinSh:'#b87b46', torso:'#b98e5e', torsoSh:'#946b42', legs:'#7a4e2e', legsSh:'#523218', boots:'#3a2510', hair:'#3a2412', weapon:'sling' }),
    // ---- Medieval ----
    swordsman: () => svgHumanoid({ skin:'#e3ab72', skinSh:'#c2854a', torso:'#9aa0ab', torsoSh:'#737985', legs:'#3a3a44', legsSh:'#26262e', boots:'#1c1c22', accent:'#c2c8d0', accentSh:'#9098a2', crest:'#c43838', belt:'#6a4a22', headgear:'helm', weapon:'sword' }),
    archer:    () => svgHumanoid({ skin:'#e3ab72', skinSh:'#c2854a', torso:'#4f6a39', torsoSh:'#3a5028', legs:'#5a4326', legsSh:'#3f2e18', boots:'#33240f', accent:'#3a5a28', accentSh:'#2a4420', hair:'#5a3a1a', belt:'#5a3a18', headgear:'hood', weapon:'bow' }),
    // ---- Industrial ----
    rifleman: () => svgHumanoid({ skin:'#dba36a', skinSh:'#b87b46', torso:'#6f7a45', torsoSh:'#535d31', legs:'#4a4326', legsSh:'#332e18', boots:'#241c0f', accent:'#5a6a40', accentSh:'#44502f', belt:'#3a2010', headgear:'brodie', weapon:'rifle' }),
    cannon:   () => svgHumanoid({ skin:'#dba36a', skinSh:'#b87b46', torso:'#5a4a38', torsoSh:'#3f3526', legs:'#3a2c1c', legsSh:'#281e12', boots:'#1a1208', accent:'#4a4030', accentSh:'#332b20', hair:'#2a1c0e', belt:'#3a2010', headgear:'brodie', weapon:'cannon' }),
    // ---- Modern ----
    soldier: () => svgHumanoid({ skin:'#d8a067', skinSh:'#b07d44', torso:'#52613a', torsoSh:'#3d4a2a', legs:'#444f2c', legsSh:'#2f381e', boots:'#20180e', accent:'#46542f', accentSh:'#333f22', belt:'#33281a', headgear:'combat', weapon:'rifle' }),
    sniper:  () => svgHumanoid({ skin:'#d8a067', skinSh:'#b07d44', torso:'#6a6a48', torsoSh:'#4e4e32', legs:'#5a5a3c', legsSh:'#3f3f28', boots:'#28281a', accent:'#5a5838', accentSh:'#403f26', headgear:'bandana', weapon:'sniper' }),
    // ---- Future ----
    laser: () => svgHumanoid({ skin:'#bfeaff', skinSh:'#88c4e4', torso:'#3a4a78', torsoSh:'#2a375c', legs:'#2c3550', legsSh:'#1d2540', boots:'#161d34', accent:'#4a5a90', accentSh:'#36446e', headgear:'visor', weapon:'laser' }),
    // ---- Heroes (humanoid) ----
    hero_paladin: () => svgHumanoid({ skin:'#e8c79a', skinSh:'#c79b62', torso:'#dadce0', torsoSh:'#abb0b8', legs:'#4a4a52', legsSh:'#33333a', boots:'#222', accent:'#e6e9ee', accentSh:'#b6bcc4', crest:'#fcd34d', cape:'#c43872', belt:'#caa84a', headgear:'helm', weapon:'sword' }),
    hero_general: () => svgHumanoid({ skin:'#e0ad8a', skinSh:'#bd875f', torso:'#5d7b3a', torsoSh:'#456029', legs:'#3a2818', legsSh:'#281b10', boots:'#1a1208', accent:'#caa84a', accentSh:'#9c8030', hair:'#2a1c0e', belt:'#5a4022', headgear:'none', weapon:'rifle' }),
    hero_seal:    () => svgHumanoid({ skin:'#c9a978', skinSh:'#9a7a4a', torso:'#2a3520', torsoSh:'#1c2416', legs:'#2a2e1c', legsSh:'#1c2012', boots:'#121208', accent:'#2a3520', accentSh:'#1c2416', headgear:'bandana', weapon:'sniper' }),
    // ---- Bespoke beasts / vehicles ----
    dino:       svgDino,
    knight:     svgHorse,
    tank1:      svgTankSteam,
    tank2:      svgTankModern,
    mech:       svgMech,
    flier:      svgHover,
    hero_grog:  svgMammoth,
    hero_titan: svgTitan,
  };

  // Natural aspect (w/h) per sprite so the blit doesn't distort them.
  const SPRITE_ASPECT = {
    dino: 170/150, knight: 180/150, hero_grog: 180/160,
    tank1: 170/120, tank2: 180/110, mech: 150/160,
    flier: 160/120, hero_titan: 150/170,
  };

  function getSprite(key) {
    // Map boss synthetic keys to their base unit
    let k = key;
    if (k.startsWith('boss_')) k = k.replace(/^boss_/, '').replace(/_\d+$/, '');
    const cached = spriteCache[k];
    if (cached) return cached.ready ? cached : null;
    const def = SPRITE_DEFS[k];
    if (!def) { spriteCache[k] = { ready: false, img: null, none: true }; return null; }
    const entry = { ready: false, img: new Image() };
    entry.img.onload = () => { entry.ready = true; };
    entry.img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(def());
    spriteCache[k] = entry;
    return null;
  }

  function preloadSprites() {
    for (const k of Object.keys(SPRITE_DEFS)) getSprite(k);
  }

  // ---- Dispatch table ----
  const UNIT_DRAWERS = {
    club:         drawClubman,
    sling:        drawSlinger,
    dino:         drawDinoRider,
    swordsman:    drawSwordsman,
    archer:       drawArcher,
    knight:       drawHorseAndRider,
    rifleman:     drawRifleman,
    cannon:       drawCannoneer,
    tank1:        drawSteamTank,
    soldier:      drawSoldier,
    sniper:       drawSniper,
    tank2:        drawModernTank,
    laser:        drawLaserTrooper,
    mech:         drawMech,
    flier:        drawHover,
    hero_grog:    drawHeroGrog,
    hero_paladin: drawHeroPaladin,
    hero_general: drawHeroGeneral,
    hero_seal:    drawHeroSeal,
    hero_titan:   drawHeroTitan,
  };

  // ---- Unit silhouettes ----
  // Each unit gets a dedicated drawer so the silhouettes are
  // recognizable at a glance, not just colored rectangles. All
  // drawers accept (u, x, y, facing, walkSwing, bodyColor) where
  // y is the top of the unit and (x, y, u.w, u.h) is the bounding box.
  function drawUnit(u) {
    const def = UNITS[u.key] || {};
    const facing = u.side === 'player' ? 1 : -1;
    const isHero = u.key && u.key.startsWith('hero_');
    const isBoss = u.isBoss;
    const scale = isBoss ? 1.45 : (isHero ? 1.18 : 1.0);
    const drawW = u.w * scale;
    const drawH = u.h * scale;
    const feetY = GROUND_Y - u.yOffset;
    const topY = feetY - u.h;       // drawer's y-arg (unscaled — canvas transform handles scale)

    // Walk swing — -1..1, used by drawers for limb cycling
    const walkSwing = Math.sin(u.walkPhase);
    const bodyColor = u.color || def.color || '#888';

    // Soft elliptical foot shadow (scaled with display size)
    ctx.fillStyle = 'rgba(0,0,0,0.40)';
    ctx.beginPath();
    ctx.ellipse(u.x, feetY - 1, drawW * 0.42, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hero / boss ground halo
    if (isHero) {
      const pulse = 0.6 + Math.sin(performance.now() / 220) * 0.2;
      const halo = ctx.createRadialGradient(u.x, feetY - drawH * 0.3, 4, u.x, feetY - drawH * 0.3, drawW * 1.4);
      halo.addColorStop(0, `rgba(252,211,77,${pulse * 0.5})`);
      halo.addColorStop(1, 'rgba(252,211,77,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(u.x, feetY - drawH * 0.3, drawW * 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(252,211,77,${pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(u.x, feetY - 1, drawW * 0.5, 4.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (isBoss) {
      const pulse = 0.55 + Math.sin(performance.now() / 180) * 0.25;
      const halo = ctx.createRadialGradient(u.x, feetY - drawH * 0.3, 4, u.x, feetY - drawH * 0.3, drawW * 1.5);
      halo.addColorStop(0, `rgba(160,32,160,${pulse * 0.55})`);
      halo.addColorStop(1, 'rgba(160,32,160,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(u.x, feetY - drawH * 0.3, drawW * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Resolve drawer. Bosses use their base unit's drawer; synthetic
    // boss keys look like `boss_<baseKey>_<waveNum>`.
    let drawerKey = u.key;
    if (drawerKey.startsWith('boss_')) {
      drawerKey = drawerKey.replace(/^boss_/, '').replace(/_\d+$/, '');
    }

    // Prefer a loaded vector sprite; fall back to the canvas drawer.
    const sprite = getSprite(u.key);
    ctx.save();
    if (scale !== 1.0) {
      ctx.translate(u.x, feetY);
      ctx.scale(scale, scale);
      ctx.translate(-u.x, -feetY);
    }
    if (u.hitFlash > 0) {
      ctx.shadowColor = `rgba(255,255,255,${Math.min(1, u.hitFlash * 4)})`;
      ctx.shadowBlur = 14;
    } else if (isHero) {
      ctx.shadowColor = 'rgba(252,211,77,0.45)';
      ctx.shadowBlur = 8;
    } else if (isBoss) {
      ctx.shadowColor = 'rgba(255,80,255,0.5)';
      ctx.shadowBlur = 10;
    }
    if (sprite && sprite.ready) {
      const aspect = SPRITE_ASPECT[drawerKey];   // bespoke vehicles/beasts
      let sw, sh, bob, lean;
      if (aspect) {
        // Preserve the sprite's natural aspect; gentle bob, no lean
        // (tanks/hovercraft shouldn't tilt like walkers).
        sh = u.h * 1.14;
        sw = sh * aspect;
        bob = Math.sin(u.walkPhase * 1.4) * (u.h * 0.012);
        lean = 0;
      } else {
        // Humanoid: a touch wider than the hitbox, bob + slight march lean.
        sw = u.w * 1.18;
        sh = u.h * 1.06;
        bob = Math.abs(Math.sin(u.walkPhase * 1.6)) * (u.h * 0.025);
        lean = Math.sin(u.walkPhase * 1.6) * 0.04;
      }
      ctx.translate(u.x, feetY - bob);
      if (lean) ctx.rotate(lean * facing);
      ctx.scale(facing, 1);            // mirror for enemy side
      ctx.drawImage(sprite.img, -sw / 2, -sh, sw, sh);
    } else {
      const drawer = UNIT_DRAWERS[drawerKey] || drawGenericHumanoid;
      drawer(u, u.x, topY, facing, walkSwing, bodyColor);
    }
    ctx.shadowBlur = 0;
    ctx.restore();

    const cy = feetY - drawH / 2;

    // Hero name badge floating above
    if (isHero) {
      ctx.font = '800 13px "Inter",sans-serif';
      ctx.fillStyle = '#fcd34d';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.shadowColor = 'rgba(252,211,77,0.6)'; ctx.shadowBlur = 8;
      ctx.fillText('★ ' + u.name, u.x, feetY - drawH - 4);
      ctx.shadowBlur = 0;
    } else if (isBoss) {
      ctx.font = '800 13px "Inter",sans-serif';
      ctx.fillStyle = '#ff9cff';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(255,80,255,0.6)'; ctx.shadowBlur = 8;
      ctx.fillText('👑 BOSS', u.x, feetY - drawH - 4);
      ctx.shadowBlur = 0;
    }

    // HP bar above the sprite
    const barW = drawW + 4;
    const barY = feetY - drawH - (isHero || isBoss ? 20 : 8);
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(u.x - barW / 2, barY, barW, 5);
    const pct = Math.max(0, u.hp / u.hpMax);
    const grad = ctx.createLinearGradient(u.x - barW / 2, 0, u.x + barW / 2, 0);
    if (u.side === 'player') { grad.addColorStop(0, '#3FB950'); grad.addColorStop(1, '#6ee87f'); }
    else                     { grad.addColorStop(0, '#F85149'); grad.addColorStop(1, '#ff8a82'); }
    ctx.fillStyle = grad;
    ctx.fillRect(u.x - barW / 2 + 1, barY + 1, (barW - 2) * pct, 3);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(u.x - barW / 2 + 0.5, barY + 0.5, barW - 1, 4);
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
    const era = ERAS[playerEra];
    const eEra = ERAS[enemyEra];

    // Gold
    const goldEl = document.getElementById('aow-gold');
    if (goldEl) goldEl.textContent = Math.floor(gold);

    // Era pill (icon + name + XP sub-text + bar)
    const eraIconEl = document.getElementById('aow-era-icon');
    const eraNameEl = document.getElementById('aow-era-name');
    const eraSubEl  = document.getElementById('aow-era-sub');
    const xpBar     = document.getElementById('aow-xp-bar');
    if (eraIconEl) eraIconEl.textContent = era.icon;
    if (eraNameEl) eraNameEl.textContent = era.name;
    if (eraSubEl)  eraSubEl.textContent  = playerEra >= ERAS.length - 1
      ? `${xp} XP · MAX`
      : `${xp} / ${era.upXP} XP`;
    if (xpBar) {
      const pct = playerEra >= ERAS.length - 1 ? 100 : Math.min(100, (xp / era.upXP) * 100);
      xpBar.style.width = pct + '%';
    }

    // Base HP bars (text + fill width)
    const baseEl = document.getElementById('aow-base-hp');
    const enemyEl = document.getElementById('aow-enemy-hp');
    const playerBar = document.getElementById('aow-player-hp-bar');
    const enemyBar  = document.getElementById('aow-enemy-hp-bar');
    if (baseEl)  baseEl.textContent  = `${Math.max(0, Math.floor(playerBaseHp))} / ${playerBaseMax}`;
    if (enemyEl) enemyEl.textContent = `${Math.max(0, Math.floor(enemyBaseHp))} / ${enemyBaseMax}`;
    if (playerBar) playerBar.style.width = (Math.max(0, playerBaseHp) / playerBaseMax * 100) + '%';
    if (enemyBar)  enemyBar.style.width  = (Math.max(0, enemyBaseHp)  / enemyBaseMax  * 100) + '%';

    // Era-themed castle icons on the side bars
    const playerIcon = document.getElementById('aow-player-side-icon');
    const enemyIcon  = document.getElementById('aow-enemy-side-icon');
    if (playerIcon) playerIcon.textContent = era.icon;
    if (enemyIcon)  enemyIcon.textContent  = eEra.icon;

    // Combo pill (only when combo > 0)
    const comboEl = document.getElementById('aow-combo');
    const comboXEl = document.getElementById('aow-combo-x');
    const comboLblEl = document.getElementById('aow-combo-label');
    if (comboEl) {
      if (combo > 0) {
        comboEl.style.display = '';
        if (comboXEl)  comboXEl.textContent = '×' + comboMult().toFixed(1);
        // Label intensifies at higher streaks: "5 kills" → "INSANE!" → "GODLIKE!"
        let label = combo + ' kill' + (combo === 1 ? '' : 's');
        if      (combo >= 25) label = 'GODLIKE!';
        else if (combo >= 15) label = 'INSANE!';
        else if (combo >= 8)  label = 'RAMPAGE!';
        if (comboLblEl) comboLblEl.textContent = label;
        // Color + scale tier
        const tier = combo >= 25 ? 3 : combo >= 15 ? 2 : combo >= 8 ? 1 : 0;
        comboEl.dataset.tier = tier;
      } else {
        comboEl.style.display = 'none';
      }
    }

    // Age Up button
    const ageBtn = document.getElementById('aow-ageup-btn');
    if (ageBtn) {
      const lbl = ageBtn.querySelector('.aow-action-lbl');
      const ico = ageBtn.querySelector('.aow-action-ico');
      if (playerEra >= ERAS.length - 1) {
        if (ico) ico.textContent = '🌟';
        if (lbl) lbl.textContent = 'Max Age';
        ageBtn.disabled = true;
      } else {
        if (ico) ico.textContent = '⬆️';
        if (lbl) lbl.textContent = `Age Up · ${ERAS[playerEra + 1].name}`;
        ageBtn.disabled = xp < era.upXP;
      }
    }

    // Special button
    const specEl  = document.getElementById('aow-special-btn');
    const specCdEl = document.getElementById('aow-special-cd');
    if (specEl) {
      const spec = ERAS[playerEra].special;
      const lbl = specEl.querySelector('.aow-action-lbl');
      const ico = specEl.querySelector('.aow-action-ico');
      if (ico) ico.textContent = spec.icon;
      if (lbl) lbl.textContent = spec.name;
      if (specCdEl) specCdEl.textContent = specialReadyT > 0 ? `${Math.ceil(specialReadyT)}s` : 'READY';
      specEl.disabled = specialReadyT > 0;
    }

    // Wave indicator
    const waveEl = document.getElementById('aow-wave');
    const waveNumEl = document.getElementById('aow-wave-num');
    const waveSubEl = document.getElementById('aow-wave-sub');
    if (waveEl) {
      waveEl.classList.toggle('aow-wave-boss', bossWaveActive);
      if (waveNumEl) waveNumEl.textContent = (bossWaveActive ? 'BOSS · ' : '') + 'WAVE ' + waveNum;
      if (waveSubEl) {
        if (waveBreatherT > 0) waveSubEl.textContent = `next in ${Math.ceil(waveBreatherT)}s`;
        else if (bossWaveActive && !bossKilledThisWave) waveSubEl.textContent = 'kill the boss';
        else waveSubEl.textContent = `${waveEnemiesRemaining} incoming`;
      }
    }

    // Hero button
    const heroBtn = document.getElementById('aow-hero-btn');
    if (heroBtn) {
      const h = heroForEra(playerEra);
      const lbl = heroBtn.querySelector('.aow-action-lbl');
      const ico = heroBtn.querySelector('.aow-action-ico');
      const cdEl = document.getElementById('aow-hero-cd');
      if (h) {
        if (ico) ico.textContent = h.icon;
        if (lbl) lbl.textContent = h.name;
        if (cdEl) {
          if (heroReadyT > 0) cdEl.textContent = `${Math.ceil(heroReadyT)}s`;
          else if (gold < h.cost) cdEl.textContent = `$${h.cost}`;
          else cdEl.textContent = `$${h.cost} · READY`;
        }
        heroBtn.disabled = heroReadyT > 0 || gold < h.cost;
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
          <span class="aow-spawn-name">${def.name}</span>
          <span class="aow-spawn-cost">$${def.cost}</span>
        `;
        btn.title = `${def.name} — HP ${def.hp} · DMG ${def.dmg} · Range ${def.range} · Speed ${def.speed}`;
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
    const m = Math.floor(runStats.time / 60);
    const s = Math.floor(runStats.time % 60).toString().padStart(2, '0');
    ov.style.display = 'flex';
    ov.innerHTML = `
      <h2 style="${won ? 'background:linear-gradient(135deg,#3FB950,#fcd34d);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent' : 'color:#F85149'}">
        ${won ? '🏆 VICTORY' : '💀 DEFEAT'}
      </h2>
      <p>${won ? 'You wiped the enemy base.' : 'Your base has fallen.'}</p>
      <div style="display:flex;gap:24px;margin-top:16px;font-family:var(--font-mono);font-size:13px">
        <div><div style="color:var(--text-dim);font-size:10px;letter-spacing:1.5px;text-transform:uppercase">Time</div><div style="font-weight:800;font-size:18px;color:#fcd34d">${m}:${s}</div></div>
        <div><div style="color:var(--text-dim);font-size:10px;letter-spacing:1.5px;text-transform:uppercase">Kills</div><div style="font-weight:800;font-size:18px;color:#fcd34d">${runStats.kills}</div></div>
        <div><div style="color:var(--text-dim);font-size:10px;letter-spacing:1.5px;text-transform:uppercase">Best Combo</div><div style="font-weight:800;font-size:18px;color:#ff77c8">×${(1 + comboBest * 0.05).toFixed(1)}</div></div>
        <div><div style="color:var(--text-dim);font-size:10px;letter-spacing:1.5px;text-transform:uppercase">Reached</div><div style="font-weight:800;font-size:18px;color:#fcd34d">${ERAS[playerEra].name}</div></div>
      </div>
      <p style="font-size:12px; color: var(--text-dim); margin-top:18px">Press SPACE or click Restart</p>
    `;
  }

  function destroy() {
    cancelAnimationFrame(rafId);
    running = false;
  }

  return { init, start: reset, destroy };
})();
