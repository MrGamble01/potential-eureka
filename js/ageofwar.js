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
  const specialCooldownMax = 25;
  let goldFloaters = [];
  let dmgFloaters = [];
  let muzzleFlashes = [];
  let strikes = [];                // air-strike effects (meteor / arrows / bombs)
  let ageFlash = 0;                // 1 → 0 right after aging up
  let ageBannerT = 0;              // seconds banner stays visible
  let ageBannerText = '';
  let bgClouds = [];               // parallax cloud x positions
  let ambient = [];                // era-themed background particles (birds, smoke, snow, neon)
  let deadUnits = [];              // { x, feetY, sprite, drawW, drawH, dir, rot, t } toppling emoji corpses
  let particles = [];              // { x, y, vx, vy, color, life, size }
  let playerTurrets = [null, null, null, null];  // each: { era, atkT, ...TURRETS[era] }
  let enemyTurrets  = [null, null, null, null];

  // ---- Difficulty ----
  const DIFFICULTIES = {
    easy:   { label: 'Easy',   spawnMult: 1.5, dmgMult: 0.7, hpMult: 0.8, color: '#3FB950' },
    normal: { label: 'Normal', spawnMult: 1.0, dmgMult: 1.0, hpMult: 1.0, color: '#58A6FF' },
    hard:   { label: 'Hard',   spawnMult: 0.7, dmgMult: 1.25, hpMult: 1.2, color: '#fcd34d' },
    insane: { label: 'Insane', spawnMult: 0.5, dmgMult: 1.6, hpMult: 1.5, color: '#F85149' },
  };
  let difficulty = 'normal';

  // ---- Combo / streak ----
  let combo = 0;
  let comboT = 0;                 // seconds until streak breaks
  const COMBO_WINDOW = 3.0;
  let comboBest = 0;              // best in current run
  // Bonus multiplier: 1.0 at combo 0, +5% per kill stacking up to +200% (5x).
  function comboMult() { return Math.min(5, 1 + combo * 0.05); }

  // ---- Run stats (shown on win/lose + drive achievements) ----
  const runStats = { kills: 0, gold: 0, time: 0, specialsFired: 0, biggestCombo: 0, agesReached: 0, turretsBuilt: 0, heroesSummoned: 0 };

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
    { id: 'collect_50',   icon: '🪙',  title: 'Payday',           desc: 'Earn $10,000 in one run.' },
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
    if (runStats.gold >= 10000) unlock('collect_50');
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
    { era: 0, key: 'hero_grog',    name: 'Grog the Stomper', icon: '🦣', sprite: '🦣',  cost: 800,  hp: 1200, dmg: 80,  range: 28,  atkSpd: 0.6, speed: 38, color: '#7a4a22', xp: 200, gold: 400, silhouette: 'beast',  cd: 60 },
    { era: 1, key: 'hero_paladin', name: 'Sir Lancelot',     icon: '🛡️', sprite: '⚔️',  cost: 1800, hp: 2400, dmg: 130, range: 28,  atkSpd: 0.7, speed: 40, color: '#dadce0', xp: 400, gold: 800, silhouette: 'humanoid', cd: 70 },
    { era: 2, key: 'hero_general', name: 'The General',      icon: '🎖️', sprite: '🎖️',  cost: 4000, hp: 3600, dmg: 240, range: 240, atkSpd: 0.9, speed: 40, color: '#5d7b3a', xp: 700, gold: 1500, silhouette: 'humanoid', cd: 80 },
    { era: 3, key: 'hero_seal',    name: 'Black Ops',         icon: '🎯', sprite: '🕵',   cost: 8500, hp: 4500, dmg: 480, range: 320, atkSpd: 1.6, speed: 42, color: '#2a3520', xp: 1300, gold: 2600, silhouette: 'humanoid', cd: 90 },
    { era: 4, key: 'hero_titan',   name: 'Titan',            icon: '⚡', sprite: '👹',  cost: 18000, hp: 8000, dmg: 900, range: 140, atkSpd: 0.7, speed: 38, color: '#7ec8ff', xp: 2800, gold: 5500, silhouette: 'vehicle', cd: 110 },
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
    ageFlash = 0;
    ageBannerT = 0;
    ageBannerText = '';
    deadUnits = [];
    particles = [];
    playerTurrets = [null, null, null, null];
    enemyTurrets  = [null, null, null, null];
    combo = 0; comboT = 0; comboBest = 0;
    runStats.kills = 0; runStats.gold = 0; runStats.time = 0;
    runStats.specialsFired = 0;
    runStats.biggestCombo = 0; runStats.agesReached = 0;
    runStats.turretsBuilt = 0; runStats.heroesSummoned = 0;
    heroReadyT = 6;   // first summon available 6s in
    currentHeroCd = HEROES[0].cd;
    waveNum = 1;
    waveEnemiesRemaining = 4;
    waveBreatherT = 0;
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
    // Per-silhouette sizing tuned for legibility at this canvas resolution.
    const w = def.silhouette === 'vehicle' ? 78 : def.silhouette === 'beast' ? 72 : def.silhouette === 'flier' ? 64 : 46;
    const h = def.silhouette === 'flier' ? 64 : def.silhouette === 'vehicle' ? 68 : def.silhouette === 'beast' ? 74 : 82;
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
    // Dust kicked up at the feet on deploy (ground units only)
    if (!flying) {
      const feetY = GROUND_Y - u.yOffset;
      for (let i = 0; i < 7; i++) {
        const dp = Math.random() < 0.5 ? -1 : 1;
        particles.push({
          x: u.x, y: feetY - 2,
          vx: dp * (20 + Math.random() * 50),
          vy: -(12 + Math.random() * 22),
          color: '#d8c8a8',
          size: 2 + Math.random() * 2.5,
          life: 0.35 + Math.random() * 0.2,
        });
      }
    }
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
      waveEnemiesRemaining = bossWaveActive ? 1 : (3 + Math.floor(waveNum * 0.4));
      waveBreatherT = bossWaveActive ? 3.5 : 2.5;
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
    if (enemyEra < playerEra && Math.random() < 0.30) enemyEra++;
    const choices = unitsForEra(enemyEra);
    if (bossWaveActive && waveEnemiesRemaining === 1) {
      // Spawn a single beefy boss instead of normal unit
      const baseKey = choices[choices.length - 1];
      const baseDef = UNITS[baseKey];
      const bossKey = 'boss_' + baseKey + '_' + waveNum;
      if (!UNITS[bossKey]) {
        UNITS[bossKey] = {
          ...baseDef,
          name: 'Boss ' + baseDef.name,
          hp: baseDef.hp * 5,
          dmg: baseDef.dmg * 1.8,
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
      const heavy = Math.random() < 0.2 + (waveNum - 1) * 0.04;
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
    enemySpawnT = (1.2 + Math.random() * 1.4 + pressureFactor * 0.8) * D.spawnMult;
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
        const deathScale = u.isBoss ? 1.6 : (u.key && u.key.startsWith('hero_') ? 1.3 : 1);
        const deathDef = UNITS[u.key] || {};
        deadUnits.push({
          x: u.x, feetY: GROUND_Y - u.yOffset,
          sprite: deathDef.sprite || u.icon || '⚔',
          drawW: u.w * deathScale, drawH: u.h * deathScale,
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
          // OG Age of War: a kill pays out gold instantly — no coins to
          // chase on the battlefield. Combo multiplier still applies.
          const earned = Math.round(u.gold * mult);
          gold += earned;
          runStats.gold += earned;
          goldFloaters.push({
            text: '+$' + earned, x: u.x, y: GROUND_Y - u.h - 14,
            color: combo >= 10 ? '#ff77c8' : '#fcd34d', t: 1.1,
          });
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
      // Topple forward and settle flat (~90°); facing handled by mirror at draw
      d.rot = Math.min(d.rot + dt * 6, Math.PI / 2);
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

    // Era-specific atmosphere behind the action: drifting dust (stone),
    // gliding birds (medieval), smog plumes (industrial), jet contrails
    // (modern), neon hex motes (future).
    drawAmbient();

    // Ground (per-era color + speckle texture)
    drawGround(playerEra);
    // Scattered per-era ground detail: rocks, grass tufts, scrap, hex chips
    drawGroundDecor(playerEra);

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

    // Toppling corpses (behind live units so survivors march "over" them).
    // Same emoji sprite as the live unit — mirrored for facing, falling flat
    // and fading out, so deaths read consistently with the roster.
    for (const d of deadUnits) {
      const alpha = Math.max(0, d.t / 0.9);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(d.x, d.feetY);
      if (d.dir < 0) ctx.scale(-1, 1);
      ctx.rotate(d.rot);
      ctx.font = `${Math.round(d.drawH * 0.95)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(d.sprite, 0, -d.drawH / 2);
      ctx.restore();
    }

    // Units
    for (const u of units) drawUnit(u);

    // Particles (over units so explosions read clearly)
    for (const p of particles) {
      const a = Math.max(0, Math.min(1, p.life * 1.5));
      const sz = p.size * (0.4 + 0.6 * a);   // shrink as it fades out
      ctx.fillStyle = p.color;
      ctx.globalAlpha = a;
      ctx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
      ctx.globalAlpha = 1;
    }

    // Projectiles
    for (const p of projectiles) drawProjectile(p);

    // Muzzle flashes — hot core + glow + a quick spark cross
    for (const m of muzzleFlashes) {
      const k = Math.max(0, m.t / 0.12);   // 1 → 0 over the flash lifetime
      const r = 5 + (1 - k) * 16;
      ctx.fillStyle = `rgba(255,210,120,${k * 0.5})`;
      ctx.beginPath(); ctx.arc(m.x, m.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(255,250,220,${k * 0.9})`;
      ctx.beginPath(); ctx.arc(m.x, m.y, r * 0.45, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(255,230,150,${k * 0.8})`;
      ctx.lineWidth = 1.5;
      const sp = r * 1.6;
      ctx.beginPath();
      ctx.moveTo(m.x - sp, m.y); ctx.lineTo(m.x + sp, m.y);
      ctx.moveTo(m.x, m.y - sp * 0.6); ctx.lineTo(m.x, m.y + sp * 0.6);
      ctx.stroke();
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
    ['#a8c8e8', '#e8d4a8'],  // stone — warm dawn
    ['#7eb6e8', '#cde8f4'],  // medieval — bright day
    ['#9a8aa8', '#d0b08a'],  // industrial — smoggy sunset
    ['#5a8aac', '#b8c8d0'],  // modern — overcast
    ['#2a3a78', '#7e90c8'],  // future — twilight
  ];
  const OG_SUN = ['#fff0a8', '#fff4d0', '#ffa860', null, '#a8e0ff'];
  const OG_HILL = ['#7e5a3a', '#4a6a32', '#5a4a3a', '#3a4a48', '#2a3a68'];
  const OG_GROUND = ['#a87e4a', '#6a8a44', '#7a6648', '#6a7060', '#4a5a90'];
  // Grass/decor tint per era
  const GROUND_COLORS = OG_GROUND;
  const GROUND_SPECKS = ['#8a5a30', '#4a6a30', '#5a4828', '#4a5040', '#3a4a78'];

  function drawGround(eraIdx) {
    // OG style: solid flat ground with a single dark top edge line.
    const base = GROUND_COLORS[eraIdx] || '#7a6648';
    ctx.fillStyle = base;
    ctx.fillRect(0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y);
    // Stable speckle texture so the ground reads as dirt/terrain rather
    // than a flat slab. Seeded per index + era so specks never jitter.
    const groundH = HEIGHT - GROUND_Y;
    ctx.fillStyle = GROUND_SPECKS[eraIdx] || '#5a4828';
    ctx.globalAlpha = 0.45;
    for (let i = 0; i < 150; i++) {
      const s = (i * 2654435761 + eraIdx * 40503) >>> 0;
      const sx = s % WIDTH;
      const sy = GROUND_Y + 4 + ((s >>> 11) % (groundH - 6));
      const sz = (s >>> 5) & 1 ? 2 : 1;
      ctx.fillRect(sx, sy, sz, sz);
    }
    ctx.globalAlpha = 1;
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

  // ============================================================
  //  Hand-drawn cartoon unit renderer
  //  Layered Canvas characters: articulated legs + arms with knee/elbow
  //  bends, bold dark outlines, cel-shaded torso, and a walk cycle.
  //  Replaces the emoji sprites era by era. Each drawer takes
  //  (u, x, y, facing, walk, bodyColor) with the origin at the
  //  TOP-CENTER of the unit (feet are at y + u.h).
  // ============================================================
  function skinFor(era) { return era < 4 ? '#e8b48a' : '#d9c6b0'; }

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
      // Dark outline pass first so the leg reads as solid against a busy bg.
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

    // Arms — both swing during walk. Front arm holds the weapon (drawn by
    // the caller); back arm bobs at opposite phase. 3-segment limbs.
    const armSwing = -swing * 6;
    const frontShoulder = { x: x + facing * (bodyW * 0.45), y: bodyTop + 5 };
    const backShoulder  = { x: x - facing * (bodyW * 0.45), y: bodyTop + 5 };
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
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(shoulder.x, shoulder.y);
    ctx.lineTo(elbowX,     elbowY);
    ctx.lineTo(hand.x,     hand.y);
    ctx.stroke();
    ctx.strokeStyle = bodyColor;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(shoulder.x, shoulder.y);
    ctx.lineTo(elbowX,     elbowY);
    ctx.lineTo(hand.x,     hand.y);
    ctx.stroke();
    ctx.fillStyle = opts.skin || '#e8b48a';
    ctx.beginPath();
    ctx.arc(hand.x, hand.y, 3.8, 0, Math.PI * 2);
    ctx.fill();
    if (weaponDraw) weaponDraw(hand.x, hand.y);
  }

  function drawHead(cx, cy, r, skin, opts = {}) {
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
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(cx + facing * 1.4, cy - 1.2, 1.6, 1.6);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(cx + facing * -1.4, cy - 1.0, 1.2, 1.4);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
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
      ctx.fillStyle = '#5a3a18';
      ctx.fillRect(-2, -10, 4, 14);
      ctx.fillStyle = '#7a4e22';
      ctx.beginPath();
      ctx.arc(0, -14, 5, 0, Math.PI * 2);
      ctx.fill();
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
    // Sling whirled overhead
    drawArmAndWeapon(x, y, { x: base.shoulderX, y: base.shoulderY }, { x: base.handX + facing * 3, y: base.handY - 14 }, bodyColor, (hx, hy) => {
      ctx.strokeStyle = '#6a4828';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(hx, hy - 6, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#888';
      ctx.beginPath();
      ctx.arc(hx + facing * 3, hy - 12, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  const drawDinoRider = (u, x, y, facing, walk, bodyColor) => {
    const gallop = Math.sin(u.walkPhase * 1.4) * 2.5;
    const bodyTop = y + u.h * 0.42;
    const bodyH = u.h * 0.34;
    const outline = 'rgba(0,0,0,0.85)';
    // Legs (outlined, two pairs offset by gallop)
    const dinoLeg = (lx, lift) => {
      ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = 9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(lx, bodyTop + bodyH * 0.7); ctx.lineTo(lx, y + u.h - 1 + lift); ctx.stroke();
      ctx.strokeStyle = shadeColor(bodyColor, -34); ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(lx, bodyTop + bodyH * 0.7); ctx.lineTo(lx, y + u.h - 1 + lift); ctx.stroke();
    };
    dinoLeg(x - u.w * 0.22, gallop);
    dinoLeg(x + u.w * 0.20, -gallop);
    // Tail (outlined)
    ctx.fillStyle = bodyColor; ctx.strokeStyle = outline; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x - facing * u.w * 0.34, bodyTop + bodyH * 0.15);
    ctx.lineTo(x - facing * u.w * 0.80, bodyTop + bodyH * 0.05);
    ctx.lineTo(x - facing * u.w * 0.48, bodyTop + bodyH * 0.70);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Body (rounded, shaded, outlined)
    roundRectPath(x - u.w * 0.42, bodyTop, u.w * 0.84, bodyH, 9);
    const bg = ctx.createLinearGradient(0, bodyTop, 0, bodyTop + bodyH);
    bg.addColorStop(0, shadeColor(bodyColor, 20));
    bg.addColorStop(1, shadeColor(bodyColor, -18));
    ctx.fillStyle = bg; ctx.fill();
    ctx.strokeStyle = outline; ctx.lineWidth = 2.5; ctx.stroke();
    // Back spikes
    ctx.fillStyle = shadeColor(bodyColor, -36);
    for (let i = -3; i <= 3; i++) {
      const sx = x + i * (u.w * 0.10);
      ctx.beginPath();
      ctx.moveTo(sx - 4, bodyTop + 1);
      ctx.lineTo(sx,     bodyTop - 6);
      ctx.lineTo(sx + 4, bodyTop + 1);
      ctx.closePath(); ctx.fill();
    }
    // Neck + head (outlined)
    const hx = x + facing * u.w * 0.52, hy = bodyTop - u.h * 0.02;
    ctx.fillStyle = bodyColor; ctx.strokeStyle = outline; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x + facing * u.w * 0.28, bodyTop + 3);
    ctx.lineTo(hx - facing * u.w * 0.02, hy - u.h * 0.12);
    ctx.lineTo(hx + facing * u.w * 0.26, hy - u.h * 0.05);
    ctx.lineTo(hx + facing * u.w * 0.30, hy + u.h * 0.06);
    ctx.lineTo(x + facing * u.w * 0.32, bodyTop + bodyH * 0.55);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Eye + teeth
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx + facing * 1, hy - u.h * 0.04, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(hx + facing * 2, hy - u.h * 0.04, 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(hx + facing * u.w * 0.16, hy + u.h * 0.05);
    ctx.lineTo(hx + facing * u.w * 0.26, hy + u.h * 0.05);
    ctx.lineTo(hx + facing * u.w * 0.20, hy + u.h * 0.10);
    ctx.closePath(); ctx.fill();
    // Caveman rider (outlined torso + shaggy head)
    const ry = bodyTop - u.h * 0.17;
    ctx.fillStyle = '#7a4222'; roundRectPath(x - 5, ry, 10, 13, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#2a1808'; ctx.beginPath(); ctx.arc(x, ry - 2, 5.5, 0, Math.PI * 2); ctx.fill();
    drawHead(x + facing * 0.5, ry - 1, 4, skinFor(0), { facing });
  };

  const drawHeroGrog = (u, x, y, facing, walk, bodyColor) => {
    // Woolly mammoth with a tribal rider — humped back, domed head,
    // big curved tusks, shaggy fur.
    const gallop = Math.sin(u.walkPhase * 1.4) * 3;
    const fur = '#6b4426', furDk = '#3a2812', furLt = '#8a6038', outline = 'rgba(0,0,0,0.88)';
    const W = u.w, H = u.h, f = facing, cx = x;
    const midY = y + H * 0.52;
    // ---- Legs (4 thick fur columns) ----
    const legTop = y + H * 0.58, legBot = y + H - 1;
    const grogLeg = (lx, lift) => {
      ctx.strokeStyle = outline; ctx.lineWidth = 15; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(lx, legTop); ctx.lineTo(lx, legBot + lift); ctx.stroke();
      ctx.strokeStyle = furDk; ctx.lineWidth = 11;
      ctx.beginPath(); ctx.moveTo(lx, legTop); ctx.lineTo(lx, legBot + lift); ctx.stroke();
      ctx.fillStyle = '#e8dcc0';
      ctx.fillRect(lx - 5, legBot + lift - 2, 4, 3);
      ctx.fillRect(lx + 1, legBot + lift - 2, 4, 3);
    };
    grogLeg(cx - W * 0.34, gallop);
    grogLeg(cx + W * 0.30, gallop);
    grogLeg(cx - W * 0.05, -gallop);
    grogLeg(cx + W * 0.16, -gallop);
    // ---- Body: humped oval, high at the shoulder ----
    ctx.fillStyle = fur; ctx.strokeStyle = outline; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - f * W * 0.52, midY + H * 0.10);
    ctx.bezierCurveTo(cx - f * W * 0.62, y + H * 0.30, cx - f * W * 0.12, y + H * 0.18, cx + f * W * 0.16, y + H * 0.22);
    ctx.bezierCurveTo(cx + f * W * 0.44, y + H * 0.26, cx + f * W * 0.56, y + H * 0.46, cx + f * W * 0.50, midY + H * 0.12);
    ctx.lineTo(cx - f * W * 0.44, midY + H * 0.16);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Shaggy belly fringe
    ctx.fillStyle = furDk;
    for (let i = -5; i <= 5; i++) {
      const fx = cx + i * (W * 0.085);
      ctx.beginPath(); ctx.moveTo(fx - 4, midY + H * 0.09); ctx.lineTo(fx, midY + H * 0.20); ctx.lineTo(fx + 4, midY + H * 0.09); ctx.closePath(); ctx.fill();
    }
    // Back highlight along the hump
    ctx.strokeStyle = furLt; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - f * W * 0.30, y + H * 0.26);
    ctx.quadraticCurveTo(cx, y + H * 0.17, cx + f * W * 0.16, y + H * 0.23);
    ctx.stroke();
    // ---- Head: big domed head at the front ----
    const hx = cx + f * W * 0.46, hy = y + H * 0.46;
    ctx.fillStyle = fur; ctx.strokeStyle = outline; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(hx, hy, W * 0.24, H * 0.21, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(hx - f * W * 0.03, hy - H * 0.15, W * 0.15, H * 0.11, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Ear
    ctx.fillStyle = furDk;
    ctx.beginPath(); ctx.ellipse(hx - f * W * 0.13, hy - H * 0.01, W * 0.08, H * 0.11, 0, 0, Math.PI * 2); ctx.fill();
    // Eye
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx + f * W * 0.05, hy - H * 0.04, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(hx + f * W * 0.06, hy - H * 0.04, 1.3, 0, Math.PI * 2); ctx.fill();
    // ---- Trunk (curved, tapering) ----
    ctx.strokeStyle = outline; ctx.lineWidth = 10; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hx + f * W * 0.12, hy + H * 0.06);
    ctx.quadraticCurveTo(hx + f * W * 0.34, hy + H * 0.22, hx + f * W * 0.18, hy + H * 0.42);
    ctx.stroke();
    ctx.strokeStyle = fur; ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.moveTo(hx + f * W * 0.12, hy + H * 0.06);
    ctx.quadraticCurveTo(hx + f * W * 0.34, hy + H * 0.22, hx + f * W * 0.18, hy + H * 0.42);
    ctx.stroke();
    // ---- Tusks (two big curved ivory tusks) ----
    const tusk = (off) => {
      ctx.strokeStyle = outline; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(hx + f * W * 0.08, hy + H * 0.11 + off);
      ctx.quadraticCurveTo(hx + f * W * 0.36, hy + H * 0.24 + off, hx + f * W * 0.42, hy + H * 0.02 + off);
      ctx.stroke();
      ctx.strokeStyle = '#f1e7c8'; ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(hx + f * W * 0.08, hy + H * 0.11 + off);
      ctx.quadraticCurveTo(hx + f * W * 0.36, hy + H * 0.24 + off, hx + f * W * 0.42, hy + H * 0.02 + off);
      ctx.stroke();
    };
    tusk(4); tusk(8);
    // ---- Rider on the hump ----
    const ry = y + H * 0.06, rx = cx - f * W * 0.05;
    ctx.fillStyle = '#7a4222'; ctx.strokeStyle = 'rgba(0,0,0,0.82)'; ctx.lineWidth = 2.5;
    roundRectPath(rx - 6, ry, 12, 16, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2a1808'; ctx.beginPath(); ctx.arc(rx, ry - 3, 7, 0, Math.PI * 2); ctx.fill();
    drawHead(rx + f * 0.5, ry - 2, 5, skinFor(0), { facing });
    // Spear
    ctx.strokeStyle = '#5a3a18'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(rx + f * 7, ry + 4); ctx.lineTo(rx + f * 17, ry - H * 0.20); ctx.stroke();
    ctx.fillStyle = '#cbd5e1'; ctx.strokeStyle = outline; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(rx + f * 17, ry - H * 0.20);
    ctx.lineTo(rx + f * 22, ry - H * 0.24);
    ctx.lineTo(rx + f * 16, ry - H * 0.14);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  };

  // === MEDIEVAL ===
  const drawSwordsman = (u, x, y, facing, walk, bodyColor) => {
    const swing = walk * 4, f = facing;
    const base = drawHumanoidBase(x, y, u.h, u.w, f, swing, bodyColor, {
      skin: skinFor(1), pantsColor: '#6b7280', bootColor: '#3b3f47', belt: '#6b4a2a',
    });
    const { bodyTop, bodyBottom, bodyW, headR, headCenterY } = base;
    const bodyH = bodyBottom - bodyTop;
    // Tabard (surcoat) with a cross
    ctx.fillStyle = '#2f4aa0';
    roundRectPath(x - bodyW * 0.26, bodyTop + 1, bodyW * 0.52, bodyH - 2, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillRect(x - 1.5, bodyTop + 4, 3, bodyH * 0.62);
    ctx.fillRect(x - bodyW * 0.14, bodyTop + bodyH * 0.26, bodyW * 0.28, 3);
    // Round shield strapped over the chest
    const shCx = x + f * bodyW * 0.18, shCy = bodyTop + bodyH * 0.55, shR = bodyW * 0.42;
    ctx.fillStyle = '#c0c6d4'; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(shCx, shCy, shR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2f4aa0';
    ctx.fillRect(shCx - shR * 0.15, shCy - shR * 0.78, shR * 0.3, shR * 1.56);
    ctx.fillRect(shCx - shR * 0.78, shCy - shR * 0.15, shR * 1.56, shR * 0.3);
    ctx.fillStyle = '#e6c34a'; ctx.beginPath(); ctx.arc(shCx, shCy, shR * 0.18, 0, Math.PI * 2); ctx.fill();
    // Great helm (covers the head)
    const hw = (headR + 1.6) * 2, hh = headR * 2.2;
    ctx.fillStyle = '#cdd3df'; ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 1.8;
    roundRectPath(x - hw / 2, headCenterY - headR - 1, hw, hh, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.13)';
    roundRectPath(x - hw / 2, headCenterY - headR - 1, hw / 2 - f * (hw / 2), hh, 4); ctx.fill();
    ctx.fillStyle = '#23252b';
    ctx.fillRect(x - headR * 0.85, headCenterY - 1, headR * 1.7, 2);          // eye slit
    ctx.fillRect(x - 1, headCenterY + 1.5, 2, headR * 0.9);                   // breath slit
    ctx.fillStyle = '#c0392b';                                               // plume
    ctx.beginPath(); ctx.moveTo(x, headCenterY - headR - 1);
    ctx.quadraticCurveTo(x - f * 7, headCenterY - headR - 10, x - f * 1, headCenterY - headR - 1); ctx.fill();
    // Sword raised in the front hand
    drawArmAndWeapon(x, y, { x: base.shoulderX, y: base.shoulderY }, { x: base.handX + f * 3, y: base.handY - 7 }, bodyColor, (hx, hy) => {
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(f * -0.75);
      ctx.fillStyle = '#8a6a2a'; ctx.fillRect(-5, -1, 10, 3);                 // crossguard
      ctx.fillStyle = '#5a3a1a'; ctx.fillRect(-1.5, 0, 3, 6);                 // grip
      ctx.fillStyle = '#c8a84a'; ctx.beginPath(); ctx.arc(0, 7, 2.2, 0, Math.PI * 2); ctx.fill();
      const bl = ctx.createLinearGradient(-2, 0, 2, 0);
      bl.addColorStop(0, '#9aa0ad'); bl.addColorStop(0.5, '#eef1f6'); bl.addColorStop(1, '#9aa0ad');
      ctx.fillStyle = bl;
      ctx.beginPath(); ctx.moveTo(-2.4, -1); ctx.lineTo(2.4, -1); ctx.lineTo(2.4, -26); ctx.lineTo(0, -31); ctx.lineTo(-2.4, -26); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.restore();
    }, { skin: skinFor(1) });
  };

  const drawArcher = (u, x, y, facing, walk, bodyColor) => {
    const swing = walk * 3, f = facing;
    const base = drawHumanoidBase(x, y, u.h, u.w, f, swing, bodyColor, {
      skin: skinFor(1), pantsColor: '#5a4326', bootColor: '#3a2a16', belt: '#4a3318',
    });
    const { bodyTop, bodyBottom, bodyW, headR, headCenterY } = base;
    // Quiver on the back shoulder
    ctx.fillStyle = '#6b4a28'; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1.5;
    roundRectPath(x - f * bodyW * 0.52, bodyTop + 2, 5, 16, 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#dadada';
    for (let i = 0; i < 3; i++) ctx.fillRect(x - f * bodyW * 0.52 + 0.6 + i * 1.6, bodyTop - 4, 1.3, 6);
    // Head + green hood
    drawHead(x, headCenterY, headR, skinFor(1), { facing: f });
    ctx.fillStyle = '#3f5d34'; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(x - f * 1, headCenterY - 1, headR + 1.6, Math.PI * 0.62, Math.PI * 1.95);
    ctx.lineTo(x - f * (headR + 1), headCenterY + headR * 0.9);
    ctx.quadraticCurveTo(x - f * headR * 0.5, headCenterY + headR * 0.2, x - f * 1, headCenterY - headR);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Bow + nocked arrow in the front hand
    const bowHandX = x + f * bodyW * 0.6, bowHandY = bodyTop + (bodyBottom - bodyTop) * 0.45;
    drawArmAndWeapon(x, y, { x: base.shoulderX, y: base.shoulderY }, { x: bowHandX, y: bowHandY }, bodyColor, (hx, hy) => {
      const bh = u.h * 0.44;
      ctx.strokeStyle = '#6b4423'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(hx, hy - bh * 0.5);
      ctx.quadraticCurveTo(hx + f * bh * 0.4, hy, hx, hy + bh * 0.5); ctx.stroke();
      const nockX = x + f * bodyW * 0.06, nockY = headCenterY + headR * 0.7;
      ctx.strokeStyle = '#ededed'; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(hx, hy - bh * 0.5); ctx.lineTo(nockX, nockY); ctx.lineTo(hx, hy + bh * 0.5); ctx.stroke();
      ctx.strokeStyle = '#caa46a'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(nockX, nockY); ctx.lineTo(hx + f * 5, hy); ctx.stroke();
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath(); ctx.moveTo(hx + f * 5, hy); ctx.lineTo(hx + f * 10, hy - 2.2); ctx.lineTo(hx + f * 10, hy + 2.2); ctx.closePath(); ctx.fill();
    }, { skin: skinFor(1) });
  };

  const drawKnight = (u, x, y, facing, walk, bodyColor) => {
    const f = facing, W = u.w, H = u.h, cx = x;
    const gallop = Math.sin(u.walkPhase * 1.5) * 3;
    const horse = '#6b4a2e', horseDk = '#412c18', armor = bodyColor, cloth = '#7a2f8a';
    const outline = 'rgba(0,0,0,0.85)';
    const legTop = y + H * 0.56, legBot = y + H - 1;
    const hleg = (lx, lift) => {
      ctx.strokeStyle = outline; ctx.lineWidth = 9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(lx, legTop); ctx.lineTo(lx, legBot + lift); ctx.stroke();
      ctx.strokeStyle = horseDk; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(lx, legTop); ctx.lineTo(lx, legBot + lift); ctx.stroke();
      ctx.fillStyle = '#15110c'; ctx.fillRect(lx - 3, legBot + lift - 2, 6, 3);
    };
    hleg(cx - f * W * 0.34, gallop);
    hleg(cx + f * W * 0.30, -gallop);
    // Tail
    ctx.strokeStyle = horseDk; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - f * W * 0.44, y + H * 0.44);
    ctx.quadraticCurveTo(cx - f * W * 0.6, y + H * 0.52, cx - f * W * 0.55, y + H * 0.74); ctx.stroke();
    // Barrel
    ctx.fillStyle = horse; ctx.strokeStyle = outline; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(cx, y + H * 0.5, W * 0.46, H * 0.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Neck + head toward facing
    const nx = cx + f * W * 0.44, ny = y + H * 0.33;
    ctx.beginPath();
    ctx.moveTo(cx + f * W * 0.30, y + H * 0.4);
    ctx.lineTo(nx - f * W * 0.05, ny - H * 0.03);
    ctx.lineTo(nx + f * W * 0.12, ny);
    ctx.lineTo(nx + f * W * 0.15, ny + H * 0.13);
    ctx.lineTo(cx + f * W * 0.34, y + H * 0.52);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(nx + f * W * 0.1, ny + H * 0.03, W * 0.13, H * 0.09, f * 0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = horseDk;                                          // ear + mane
    ctx.beginPath(); ctx.moveTo(nx - f * 1, ny - H * 0.05); ctx.lineTo(nx - f * 3, ny - H * 0.14); ctx.lineTo(nx + f * 2, ny - H * 0.05); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = horseDk; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx + f * W * 0.28, y + H * 0.36); ctx.lineTo(nx - f * W * 0.03, ny); ctx.stroke();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(nx + f * W * 0.09, ny + H * 0.01, 1.3, 0, Math.PI * 2); ctx.fill();
    // Barding cloth
    ctx.fillStyle = cloth; ctx.strokeStyle = outline; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - f * W * 0.4, y + H * 0.5); ctx.lineTo(cx + f * W * 0.32, y + H * 0.5);
    ctx.lineTo(cx + f * W * 0.26, y + H * 0.72); ctx.lineTo(cx - f * W * 0.34, y + H * 0.72);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#e6c34a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx - f * W * 0.34, y + H * 0.7); ctx.lineTo(cx + f * W * 0.27, y + H * 0.7); ctx.stroke();
    // Near legs over the barding
    hleg(cx + f * W * 0.16, -gallop * 0.6);
    hleg(cx - f * W * 0.18, gallop * 0.6);
    // Rider
    const rx = cx - f * W * 0.04, ry = y + H * 0.1;
    ctx.fillStyle = armor; ctx.strokeStyle = outline; ctx.lineWidth = 2.2;
    roundRectPath(rx - 7, ry, 14, 18, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = shadeColor(armor, 16);
    ctx.beginPath(); ctx.arc(rx + f * 5, ry + 3, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shadeColor(armor, 8); ctx.strokeStyle = outline; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(rx + f * 1, ry - 6, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#23252b'; ctx.fillRect(rx + f * 1 - 4, ry - 7, 8, 1.8);
    ctx.fillStyle = '#c0392b';
    ctx.beginPath(); ctx.moveTo(rx + f * 1, ry - 12); ctx.quadraticCurveTo(rx - f * 5, ry - 18, rx - f * 1, ry - 11); ctx.fill();
    // Couched lance
    ctx.strokeStyle = '#7a5326'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(rx - f * 8, ry + 14); ctx.lineTo(rx + f * W * 0.5, ry + 2); ctx.stroke();
    ctx.fillStyle = '#cbd5e1'; ctx.strokeStyle = outline; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(rx + f * W * 0.5, ry + 2); ctx.lineTo(rx + f * W * 0.42, ry - 2.5); ctx.lineTo(rx + f * W * 0.42, ry + 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = cloth;
    ctx.beginPath(); ctx.moveTo(rx + f * W * 0.33, ry + 3.5); ctx.lineTo(rx + f * W * 0.2, ry - 1.5); ctx.lineTo(rx + f * W * 0.22, ry + 6); ctx.closePath(); ctx.fill();
  };

  // === INDUSTRIAL ===
  const drawRifleman = (u, x, y, facing, walk, bodyColor) => {
    const swing = walk * 3.5, f = facing;
    const base = drawHumanoidBase(x, y, u.h, u.w, f, swing, bodyColor, {
      skin: skinFor(2), pantsColor: shadeColor(bodyColor, -16), bootColor: '#26261e', belt: '#4a3318',
    });
    const { bodyTop, bodyBottom, bodyW, headR, headCenterY } = base;
    const midY = bodyTop + (bodyBottom - bodyTop) * 0.4;
    // Webbing strap across the chest
    ctx.strokeStyle = '#3a2a16'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - f * bodyW * 0.42, bodyTop + 2); ctx.lineTo(x + f * bodyW * 0.42, bodyBottom - 3); ctx.stroke();
    // Head + brodie helmet (dome + wide brim)
    drawHead(x, headCenterY, headR, skinFor(2), { facing: f });
    ctx.fillStyle = shadeColor(bodyColor, -4); ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(x, headCenterY - 1, headR + 1, Math.PI, 0); ctx.fill(); ctx.stroke();
    ctx.fillRect(x - headR - 3, headCenterY - 2.4, (headR + 3) * 2, 2.6);
    // Back support hand under the barrel
    ctx.fillStyle = skinFor(2); ctx.beginPath(); ctx.arc(x + f * bodyW * 0.5, midY + 3, 3, 0, Math.PI * 2); ctx.fill();
    // Rifle aimed forward, held in the front hand
    drawArmAndWeapon(x, y, { x: base.shoulderX, y: base.shoulderY }, { x: base.handX + f * 7, y: midY }, bodyColor, (hx, hy) => {
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(f * -0.07);
      ctx.fillStyle = '#5a3a1a'; ctx.fillRect(f * -16, -1.6, f * 12, 5);          // stock
      ctx.fillStyle = '#2a2a2e'; ctx.fillRect(f * -5, -1.3, f * 24, 2.8);          // body + barrel
      ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1.5;                            // bayonet
      ctx.beginPath(); ctx.moveTo(f * 19, 0); ctx.lineTo(f * 28, 0); ctx.stroke();
      ctx.restore();
    }, { skin: skinFor(2) });
  };

  const drawCannoneer = (u, x, y, facing, walk, bodyColor) => {
    const f = facing, W = u.w, H = u.h, outline = 'rgba(0,0,0,0.85)';
    const wheelY = y + H - 8, wheelR = H * 0.17;
    // Carriage trail
    ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - f * W * 0.5, y + H - 2); ctx.lineTo(x + f * W * 0.12, wheelY - 3); ctx.stroke();
    // Wheel with spokes
    ctx.fillStyle = '#6b4a28'; ctx.strokeStyle = outline; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(x, wheelY, wheelR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#3a2410'; ctx.lineWidth = 1.6;
    for (let a = 0; a < 6; a++) { const ang = a * Math.PI / 3 + u.walkPhase * 0.4; ctx.beginPath(); ctx.moveTo(x, wheelY); ctx.lineTo(x + Math.cos(ang) * wheelR, wheelY + Math.sin(ang) * wheelR); ctx.stroke(); }
    ctx.fillStyle = '#2a1c10'; ctx.beginPath(); ctx.arc(x, wheelY, 2.6, 0, Math.PI * 2); ctx.fill();
    // Barrel angled up toward facing
    ctx.save(); ctx.translate(x, wheelY - 7); ctx.rotate(f * -0.34);
    const bg = ctx.createLinearGradient(0, -6, 0, 6); bg.addColorStop(0, '#4a4a52'); bg.addColorStop(1, '#1f1f24');
    ctx.fillStyle = bg; ctx.strokeStyle = outline; ctx.lineWidth = 2;
    roundRectPath(0, -6, f * W * 0.66, 12, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#555'; roundRectPath(f * W * 0.58, -7.5, f * W * 0.1, 15, 2); ctx.fill(); ctx.stroke();   // muzzle ring
    ctx.restore();
    // Crewman behind the breech (compact figure)
    const cmx = x - f * W * 0.4, cmTop = y + H * 0.36, cmBot = wheelY - 2;
    ctx.strokeStyle = outline; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cmx, cmBot - 8); ctx.lineTo(cmx - f * 2, cmBot); ctx.stroke();             // leg
    ctx.beginPath(); ctx.moveTo(cmx, cmBot - 8); ctx.lineTo(cmx + f * 4, cmBot); ctx.stroke();
    ctx.fillStyle = bodyColor; ctx.strokeStyle = outline; ctx.lineWidth = 2;
    roundRectPath(cmx - 5, cmTop, 10, (cmBot - 8) - cmTop, 3); ctx.fill(); ctx.stroke();                   // torso
    ctx.strokeStyle = bodyColor; ctx.lineWidth = 5; ctx.lineCap = 'round';                                 // arm to breech
    ctx.beginPath(); ctx.moveTo(cmx + f * 3, cmTop + 4); ctx.lineTo(cmx + f * 12, cmTop + 2); ctx.stroke();
    drawHead(cmx, cmTop - 4, 5, skinFor(2), { facing: f });
    ctx.fillStyle = shadeColor(bodyColor, -6); ctx.beginPath(); ctx.arc(cmx, cmTop - 5, 5.5, Math.PI, 0); ctx.fill();  // cap
    ctx.fillRect(cmx - 6, cmTop - 5, 12, 1.8);
  };

  const drawSteamTank = (u, x, y, facing, walk, bodyColor) => {
    const f = facing, W = u.w, H = u.h, outline = 'rgba(0,0,0,0.85)';
    const ironDk = shadeColor(bodyColor, -24), ironLt = shadeColor(bodyColor, 20);
    // Tracks
    const trackY = y + H * 0.6, trackH = H * 0.36;
    ctx.fillStyle = '#2a2a2e'; ctx.strokeStyle = outline; ctx.lineWidth = 2.5;
    roundRectPath(x - W * 0.48, trackY, W * 0.96, trackH, trackH * 0.5); ctx.fill(); ctx.stroke();
    const phase = u.walkPhase * 2;
    for (let i = -2; i <= 2; i++) {
      const wx = x + i * (W * 0.2);
      ctx.fillStyle = '#555'; ctx.beginPath(); ctx.arc(wx, trackY + trackH * 0.5, trackH * 0.32, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(wx, trackY + trackH * 0.5); ctx.lineTo(wx + Math.cos(phase + i) * trackH * 0.3, trackY + trackH * 0.5 + Math.sin(phase + i) * trackH * 0.3); ctx.stroke();
    }
    // Hull
    const hullY = y + H * 0.26, hullH = H * 0.4;
    const g = ctx.createLinearGradient(0, hullY, 0, hullY + hullH); g.addColorStop(0, ironLt); g.addColorStop(1, ironDk);
    ctx.fillStyle = g; ctx.strokeStyle = outline; ctx.lineWidth = 2.5;
    roundRectPath(x - W * 0.42, hullY, W * 0.84, hullH, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = ironDk;
    for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.arc(x + i * (W * 0.12), hullY + 3.5, 1.3, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(x + i * (W * 0.12), hullY + hullH - 3.5, 1.3, 0, Math.PI * 2); ctx.fill(); }
    // Cannon barrel
    ctx.fillStyle = '#2e2e34'; ctx.strokeStyle = outline; ctx.lineWidth = 2;
    roundRectPath(x + f * W * 0.18, hullY + hullH * 0.32, f * W * 0.42, 7, 3); ctx.fill(); ctx.stroke();
    // Smokestack + puffs
    ctx.fillStyle = ironDk; ctx.strokeStyle = outline; ctx.lineWidth = 2;
    roundRectPath(x - f * W * 0.3, hullY - H * 0.2, f * 8, H * 0.22, 2); ctx.fill(); ctx.stroke();
    const drift = (u.walkPhase * 4) % 9;
    for (let i = 0; i < 3; i++) { ctx.fillStyle = `rgba(190,190,190,${0.55 - i * 0.13})`; ctx.beginPath(); ctx.arc(x - f * W * 0.3 + f * 4 - f * i * 3, hullY - H * 0.2 - i * 7 - drift, 3 + i, 0, Math.PI * 2); ctx.fill(); }
  };

  // Hand-drawn drawers wired in by unit key. Keys absent here fall back to
  // the emoji sprite, so eras can be converted one at a time.
  const UNIT_DRAWERS = {
    club:      drawClubman,
    sling:     drawSlinger,
    dino:      drawDinoRider,
    swordsman: drawSwordsman,
    archer:    drawArcher,
    knight:    drawKnight,
    rifleman:  drawRifleman,
    cannon:    drawCannoneer,
    tank1:     drawSteamTank,
    hero_grog: drawHeroGrog,
  };

  // ---- Optional raster sprites (AI-generated art) ----
  // Drop a transparent PNG at ageofwar/assets/units/<key>.png and add the
  // key to SPRITE_MANIFEST below to render that unit from the image instead
  // of the canvas drawing. The image is anchored at the feet, scaled to the
  // unit's size, and mirrored for facing. The hand-drawn / emoji art stays
  // as the fallback, so the game looks complete while art is still incoming
  // and we can switch units over one at a time. See assets/units/README.md.
  const SPRITE_BASE = 'assets/units/';
  const SPRITE_MANIFEST = {
    // Enable a unit once its art exists, e.g.:  club: {},  knight: { scale: 1.1 }
  };
  const _spriteCache = {};
  function spriteImage(key) {
    const m = SPRITE_MANIFEST[key];
    if (!m || typeof Image === 'undefined') return null;   // not enabled, or non-DOM (tests)
    let e = _spriteCache[key];
    if (e === undefined) {
      const img = new Image();
      e = { img, ok: false };
      img.onload = () => { e.ok = img.naturalWidth > 0; };
      img.onerror = () => { e.ok = false; };
      img.src = SPRITE_BASE + (m.src || key + '.png');
      _spriteCache[key] = e;
    }
    return e.ok ? e.img : null;
  }

  // Render a unit's character: the hand-drawn cartoon drawer for its key
  // when one exists (see UNIT_DRAWERS), otherwise the emoji sprite.
  function drawUnit(u) {
    const def = UNITS[u.key] || {};
    const sprite = def.sprite || u.icon || '⚔';
    const facing = u.side === 'player' ? 1 : -1;
    const isHero = u.key && u.key.startsWith('hero_');
    const isBoss = u.isBoss;

    // Scale: hero +30%, boss +60%, otherwise 1.0
    const scale = isBoss ? 1.6 : (isHero ? 1.30 : 1.0);
    const drawH = u.h * scale;
    const drawW = u.w * scale;
    const feetY = GROUND_Y - u.yOffset;
    const cx = u.x;
    const cy = feetY - drawH / 2;

    // Walk bob — small Y oscillation
    const bob = Math.sin(u.walkPhase * 2) * 2.2;

    // Soft elliptical shadow at feet
    ctx.fillStyle = 'rgba(0,0,0,0.40)';
    ctx.beginPath();
    ctx.ellipse(cx, feetY - 2, drawW * 0.45, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hero / boss ground halo
    if (isHero) {
      const pulse = 0.6 + Math.sin(performance.now() / 220) * 0.2;
      const halo = ctx.createRadialGradient(cx, feetY - drawH * 0.35, 4, cx, feetY - drawH * 0.35, drawW * 1.4);
      halo.addColorStop(0, `rgba(252,211,77,${pulse * 0.55})`);
      halo.addColorStop(1, 'rgba(252,211,77,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, feetY - drawH * 0.35, drawW * 1.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(252,211,77,${pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, feetY - 1, drawW * 0.55, 5, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (isBoss) {
      const pulse = 0.6 + Math.sin(performance.now() / 180) * 0.3;
      const halo = ctx.createRadialGradient(cx, feetY - drawH * 0.35, 4, cx, feetY - drawH * 0.35, drawW * 1.5);
      halo.addColorStop(0, `rgba(160,32,160,${pulse * 0.6})`);
      halo.addColorStop(1, 'rgba(160,32,160,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, feetY - drawH * 0.35, drawW * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Character — priority: raster sprite (if art is enabled for this key)
    // → hand-drawn cartoon drawer → emoji. Hero/boss scale applies to every
    // path so they grow consistently.
    const img = spriteImage(u.key);
    const drawer = UNIT_DRAWERS[u.key];
    if (img) {
      const tune = SPRITE_MANIFEST[u.key] || {};
      const sH = drawH * (tune.scale || 1) * 1.18;          // sprites read a touch taller than the hit box
      const sW = sH * (img.naturalWidth / img.naturalHeight);
      const bobY = Math.sin(u.walkPhase * 2) * 1.5;
      ctx.save();
      ctx.translate(cx, feetY);
      if (facing < 0) ctx.scale(-1, 1);
      if (u.hitFlash > 0)   { ctx.shadowColor = 'rgba(255,255,255,0.95)'; ctx.shadowBlur = 14; }
      else if (isHero)      { ctx.shadowColor = 'rgba(252,211,77,0.55)';  ctx.shadowBlur = 12; }
      else if (isBoss)      { ctx.shadowColor = 'rgba(255,80,255,0.55)';  ctx.shadowBlur = 14; }
      ctx.drawImage(img, -sW / 2, -sH + bobY, sW, sH);
      ctx.shadowBlur = 0;
      ctx.restore();
    } else if (drawer) {
      const topY = feetY - u.h;   // natural top-of-head; scale enlarges it
      const bodyColor = u.hitFlash > 0 ? '#fff' : (u.color || '#b07040');
      ctx.save();
      if (scale !== 1) {
        ctx.translate(cx, feetY);
        ctx.scale(scale, scale);
        ctx.translate(-cx, -feetY);
      }
      if (u.hitFlash > 0)   { ctx.shadowColor = 'rgba(255,255,255,0.9)'; ctx.shadowBlur = 12; }
      else if (isHero)      { ctx.shadowColor = 'rgba(252,211,77,0.5)';  ctx.shadowBlur = 10; }
      else if (isBoss)      { ctx.shadowColor = 'rgba(255,80,255,0.5)';  ctx.shadowBlur = 12; }
      drawer(u, cx, topY, facing, Math.sin(u.walkPhase), bodyColor);
      ctx.shadowBlur = 0;
      ctx.restore();
    } else {
      // Emoji fallback — mirror for enemy side; hit flash glows white.
      ctx.save();
      ctx.translate(cx, cy + bob);
      if (facing < 0) ctx.scale(-1, 1);
      const fontSize = Math.round(drawH * 0.95);
      ctx.font = `${fontSize}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (u.hitFlash > 0) {
        ctx.shadowColor = 'rgba(255,255,255,0.85)';
        ctx.shadowBlur = 14;
      } else if (isHero) {
        ctx.shadowColor = 'rgba(252,211,77,0.6)';
        ctx.shadowBlur = 12;
      } else if (isBoss) {
        ctx.shadowColor = 'rgba(255,80,255,0.55)';
        ctx.shadowBlur = 14;
      }
      ctx.fillText(sprite, 0, 0);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Hero name badge floating above
    if (isHero) {
      ctx.font = '800 13px "Inter",sans-serif';
      ctx.fillStyle = '#fcd34d';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.shadowColor = 'rgba(252,211,77,0.6)'; ctx.shadowBlur = 8;
      ctx.fillText('★ ' + u.name, cx, cy - drawH * 0.55);
      ctx.shadowBlur = 0;
    } else if (isBoss) {
      ctx.font = '800 13px "Inter",sans-serif';
      ctx.fillStyle = '#ff9cff';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(255,80,255,0.6)'; ctx.shadowBlur = 8;
      ctx.fillText('👑 BOSS', cx, cy - drawH * 0.55);
      ctx.shadowBlur = 0;
    }

    // HP bar above the sprite
    const barW = drawW + 4;
    const barY = cy - drawH * 0.5 - (isHero || isBoss ? 20 : 8);
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(cx - barW / 2, barY, barW, 5);
    const pct = Math.max(0, u.hp / u.hpMax);
    const grad = ctx.createLinearGradient(cx - barW / 2, 0, cx + barW / 2, 0);
    if (u.side === 'player') { grad.addColorStop(0, '#3FB950'); grad.addColorStop(1, '#6ee87f'); }
    else                     { grad.addColorStop(0, '#F85149'); grad.addColorStop(1, '#ff8a82'); }
    ctx.fillStyle = grad;
    ctx.fillRect(cx - barW / 2 + 1, barY + 1, (barW - 2) * pct, 3);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - barW / 2, barY, barW, 5);
  }

  function drawProjectile(p) {
    const dir = Math.sign(p.vx) || 1;
    // Classify by color / damage: laser (energy), shell (heavy), arrow, bullet.
    const isLaser = p.color === '#6ec4ff' || p.color === '#ff90ee';
    const isShell = !isLaser && p.dmg >= 100;
    const isArrow = !isLaser && !isShell && p.dmg >= 30;

    // Motion tracer behind energy/metal rounds (not arrows) — a tapered
    // streak fading to transparent at the tail, to convey speed.
    if (!isArrow) {
      const trailLen = isLaser ? 34 : isShell ? 22 : 14;
      const rgb = isShell ? '170,150,130'
                : isLaser ? (p.color === '#6ec4ff' ? '110,196,255' : '255,144,238')
                : '252,211,77';
      const tailX = p.x - dir * trailLen;
      const grad = ctx.createLinearGradient(tailX, 0, p.x, 0);
      grad.addColorStop(0, `rgba(${rgb},0)`);
      grad.addColorStop(1, `rgba(${rgb},0.5)`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = isShell ? 4 : isLaser ? 3 : 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tailX, p.y); ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.lineCap = 'butt';
    }

    if (isLaser) {
      // Glowing laser bolt
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.shadowColor = p.color; ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(p.x - dir * 14, p.y); ctx.lineTo(p.x + dir * 4, p.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (isShell) {
      // Heavy round with a specular highlight (reads as a metal ball)
      ctx.fillStyle = '#3a3a3a';
      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(220,220,220,0.85)';
      ctx.beginPath(); ctx.arc(p.x - dir * 1.5, p.y - 1.6, 1.7, 0, Math.PI * 2); ctx.fill();
    } else if (isArrow) {
      // Arrow: shaft + steel head + red fletching
      ctx.strokeStyle = '#5a3a22';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x - dir * 10, p.y); ctx.lineTo(p.x + dir * 4, p.y);
      ctx.stroke();
      ctx.fillStyle = '#ccc';
      ctx.beginPath();
      ctx.moveTo(p.x + dir * 4, p.y);
      ctx.lineTo(p.x + dir * -1, p.y - 3);
      ctx.lineTo(p.x + dir * -1, p.y + 3);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#aa3322';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.x - dir * 10, p.y); ctx.lineTo(p.x - dir * 13, p.y - 2.5);
      ctx.moveTo(p.x - dir * 10, p.y); ctx.lineTo(p.x - dir * 13, p.y + 2.5);
      ctx.stroke();
    } else {
      // Bright bullet / stone (the tracer supplies the streak)
      ctx.fillStyle = p.color || '#fcd34d';
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
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
