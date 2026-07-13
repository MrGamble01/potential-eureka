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
    { id: 'stone',    name: 'Stone Age',   icon: '🪨', sky: ['#4a3a2a', '#7a604a'], baseColor: '#7a5a3a', upXP:    100,
      special: { name: 'Boulder',    icon: '🪨', dmg: 180, color: '#a07040' } },
    { id: 'medieval', name: 'Castle Age',  icon: '🏰', sky: ['#2a3a55', '#506a85'], baseColor: '#8a8a9c', upXP:    480,
      special: { name: 'Arrow Rain', icon: '🏹', dmg: 320, color: '#b5985a' } },
    { id: 'industrial', name: 'Renaissance', icon: '🏭', sky: ['#2d2a3a', '#4f4c5e'], baseColor: '#6b6878', upXP:   1800,
      special: { name: 'Artillery', icon: '💣', dmg: 560, color: '#888' } },
    { id: 'modern',   name: 'Modern',      icon: '🪖', sky: ['#1d3a45', '#356575'], baseColor: '#5a7a85', upXP:   4500,
      special: { name: 'Air Strike', icon: '✈️', dmg: 900, color: '#ddd' } },
    { id: 'future',   name: 'Future',      icon: '🚀', sky: ['#0e1438', '#243460'], baseColor: '#88a8ff', upXP:  10000,
      special: { name: 'Orbital Laser', icon: '🛰️', dmg: 1500, color: '#6ec4ff' } },
  ];

  // ---- Unit catalog ----
  // Three units per era: cheap melee / ranged / heavy.
  // Stats are sim-tuned so every era forms an intransitive counter
  // triangle (no dominant or dominated unit; see the balance PR for the
  // duel matrices). Two structural premiums to preserve when retuning:
  // walls (short-range heavies) need outsized HP because only the front
  // melee unit fights, and long range must be paid for with fire rate.
  const UNITS = {
    // Stone Age
    club:     { era: 0, name: 'Clubman',    icon: '🦴', sprite: '🧌',  cost: 25,   hp: 84,   dmg: 12,  range: 26,  atkSpd: 1.0,  speed: 50, color: '#b07040', xp: 10,  gold: 12,  silhouette: 'humanoid' },
    sling:    { era: 0, name: 'Slinger',    icon: '🪃', sprite: '🧙',  cost: 55,   hp: 36,   dmg: 21,  range: 150, atkSpd: 1.15, speed: 36, color: '#8a5028', xp: 16,  gold: 26,  silhouette: 'humanoid' },
    dino:     { era: 0, name: 'Dino Rider', icon: '🦖', sprite: '🦖',  cost: 90,   hp: 170,  dmg: 20,  range: 30,  atkSpd: 0.95, speed: 40, color: '#5d8a4a', xp: 30,  gold: 42,  silhouette: 'beast' },

    // Medieval
    swordsman:{ era: 1, name: 'Swordsman',  icon: '⚔️', sprite: '🤺',  cost: 130,  hp: 240,  dmg: 38,  range: 28,  atkSpd: 0.75, speed: 46, color: '#a0a0c0', xp: 38,  gold: 60,  silhouette: 'humanoid' },
    archer:   { era: 1, name: 'Archer',     icon: '🏹', sprite: '🏹',  cost: 200,  hp: 90,   dmg: 48,  range: 200, atkSpd: 1.25, speed: 40, color: '#b5985a', xp: 48,  gold: 92,  silhouette: 'humanoid' },
    knight:   { era: 1, name: 'Knight',     icon: '🐴', sprite: '🐎',  cost: 380,  hp: 560,  dmg: 55,  range: 30,  atkSpd: 1.0,  speed: 54, color: '#9a9bc5', xp: 90,  gold: 175, silhouette: 'beast' },

    // Industrial
    rifleman: { era: 2, name: 'Rifleman',   icon: '🔫', sprite: '💂',  cost: 380,  hp: 270,  dmg: 100, range: 230, atkSpd: 0.7,  speed: 46, color: '#5d7b3a', xp: 110, gold: 180, silhouette: 'humanoid' },
    cannon:   { era: 2, name: 'Cannoneer',  icon: '💣', sprite: '🧨',  cost: 620,  hp: 380,  dmg: 190, range: 270, atkSpd: 1.6,  speed: 36, color: '#4a4030', xp: 170, gold: 290, silhouette: 'humanoid' },
    tank1:    { era: 2, name: 'Steam Tank', icon: '🚂', sprite: '🚂',  cost: 1100, hp: 2600, dmg: 200, range: 90,  atkSpd: 0.95, speed: 42, color: '#6b5848', xp: 320, gold: 520, silhouette: 'vehicle' },

    // Modern
    soldier:  { era: 3, name: 'Soldier',    icon: '🪖', sprite: '🪖',  cost: 850,  hp: 500,  dmg: 190, range: 240, atkSpd: 0.7,  speed: 46, color: '#5a7a45', xp: 240, gold: 410, silhouette: 'humanoid' },
    sniper:   { era: 3, name: 'Sniper',     icon: '🎯', sprite: '🥷',  cost: 1500, hp: 240,  dmg: 490, range: 360, atkSpd: 2.5,  speed: 38, color: '#7a7a4a', xp: 420, gold: 700, silhouette: 'humanoid' },
    tank2:    { era: 3, name: 'Tank',       icon: '🪖', sprite: '🚜',  cost: 2400, hp: 4200, dmg: 380, range: 100, atkSpd: 1.0,  speed: 36, color: '#4d5a3a', xp: 700, gold: 1180, silhouette: 'vehicle' },

    // Future
    laser:    { era: 4, name: 'Laser Trooper', icon: '🪖', sprite: '👽',  cost: 1700, hp: 700,  dmg: 360, range: 280, atkSpd: 0.55, speed: 48, color: '#6ec4ff', xp: 540, gold: 800,  silhouette: 'humanoid' },
    mech:     { era: 4, name: 'Mech',          icon: '🤖', sprite: '🤖',  cost: 3000, hp: 3600, dmg: 540, range: 110, atkSpd: 0.85, speed: 38, color: '#a89cff', xp: 1100,gold: 1450, silhouette: 'vehicle' },
    flier:    { era: 4, name: 'Hover',         icon: '🛸', sprite: '🛸',  cost: 4500, hp: 1500, dmg: 820, range: 250, atkSpd: 1.3,  speed: 56, color: '#ff90ee', xp: 1600,gold: 2150, silhouette: 'flier' },
  };

  function unitsForEra(era) {
    return Object.entries(UNITS).filter(([, u]) => u.era === era).map(([k]) => k);
  }

  // ---- Turret catalog (one per era — upgrade to next era's tier) ----
  const TURRETS = [
    { era: 0, name: 'Rock Sling',    icon: '🪨', cost: 250,  dmg: 14,  range: 200, atkSpd: 1.6, color: '#7a5a3a' },
    { era: 1, name: 'Crossbow',      icon: '🏹', cost: 700,  dmg: 38,  range: 230, atkSpd: 1.2, color: '#a08855' },
    { era: 2, name: 'Cannon Turret', icon: '💣', cost: 2000, dmg: 130, range: 260, atkSpd: 1.4, color: '#555' },
    { era: 3, name: 'MG Nest',       icon: '🔫', cost: 5000, dmg: 240, range: 300, atkSpd: 0.8, color: '#5a7a45' },
    { era: 4, name: 'Plasma Turret', icon: '✨', cost: 12000, dmg: 700, range: 340, atkSpd: 0.9, color: '#6ec4ff' },
  ];
  // Player starts with 2 turret slots and can purchase up to 2 more (max 4).
  // Enemy keeps all 4 unlocked so the AI ramps as it would in canon.
  // The underlying arrays are always sized to TURRET_SLOTS_MAX so positions
  // are stable; slots beyond playerSlotsOwned just render as "locked".
  const TURRET_SLOTS_MAX = 4;
  // Cost progression per purchased slot (slots 2 -> index 2 costs SLOT_COSTS[2], slot 4 -> index 3).
  const SLOT_PURCHASE_COSTS = [0, 0, 600, 2200];
  // Sell refund as a fraction of the turret's purchase cost.
  const SELL_REFUND = 0.5;
  // Back-compat alias (some older spots still read TURRET_SLOTS).
  const TURRET_SLOTS = TURRET_SLOTS_MAX;

  // ---- State ----
  let canvas, ctx;
  let dpr = 1; // devicePixelRatio applied to the backing store; render draws
               // in WIDTH/HEIGHT logical units, so every ctx.setTransform
               // call below must reapply this factor (see draw()'s shake).
  let rafId = null;
  let lastFrame = 0;
  let running = false, gameOver = false, modalPaused = false;
  let outcome = null;
  // Any modal opening calls setModalPaused(true), closing calls (false).
  // Centralised so the sim/render code only checks one flag.
  function setModalPaused(p) {
    modalPaused = !!p;
    // Show a small "PAUSED" hint via the existing banner when paused.
    if (modalPaused) { ageBannerText = '⏸ PAUSED'; ageBannerT = 999; }
    else if (ageBannerText === '⏸ PAUSED') { ageBannerT = 0; }
  }
  function anyModalOpen() {
    for (const id of ['aow-welcome-modal','aow-ach-modal','aow-settings-modal']) {
      const m = document.getElementById(id);
      if (m && m.style.display && m.style.display !== 'none') return true;
    }
    return false;
  }
  let playerEra = 0, enemyEra = 0;
  let gold = 0, xp = 0;
  let playerBaseHp = 1000, playerBaseMax = 1000;
  let enemyBaseHp  = 1000, enemyBaseMax  = 1000;
  let units = [];
  let projectiles = [];
  let nextSpawnId = 1;
  // Training queue: gold is committed up front when the player buys a unit,
  // and the unit actually appears at the base only after its training time.
  // Units are trained one at a time, front-of-queue first (canonical Age of
  // War behaviour). Cap of 5 simultaneous queue slots.
  let trainingQueue = [];                    // [{ key, total, remaining }]
  const TRAINING_MAX = 5;
  function trainingTimeFor(def) {
    // Cost / 500 (s) but always between 0.6s and 7s so cheap units cycle
    // fast while expensive units feel weighty without locking up the lane.
    return Math.max(0.6, Math.min(7, def.cost / 500));
  }
  let spawnCooldowns = {};                   // kept for legacy refs (always empty now)
  let enemySpawnT = 1.6;
  let goldTrickleT = 0;
  let specialReadyT = 6;
  const specialCooldownMax = 20;
  let goldFloaters = [];
  let dmgFloaters = [];
  let muzzleFlashes = [];
  let impactRings = [];                            // hit impact shockwave rings
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
  let playerSlotsOwned = 2;                       // starts with 2 turret slots (canon)

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

  // ---- Haptics ----
  // Buzz the device when your OWN base takes damage, so an attack is felt
  // on mobile even when you're not watching the HP bar. Throttled so
  // sustained fire pulses like an alarm; a stronger pattern kicks in once
  // the base is critical. Honors reduce-motion and is a harmless no-op
  // where the Vibration API is unsupported (desktop, iOS Safari).
  let lastHapticT = -9999, hapticsOK = true;
  function vibrateBaseHit() {
    if (!hapticsOK || gameOver) return;
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    const now = (typeof performance !== 'undefined') ? performance.now() : Date.now();
    if (now - lastHapticT < 300) return;
    lastHapticT = now;
    const critical = playerBaseMax > 0 && playerBaseHp / playerBaseMax <= 0.25;
    navigator.vibrate(critical ? [22, 36, 22] : 16);
  }

  // ---- Run stats (shown on win/lose + drive achievements) ----
  const runStats = { kills: 0, gold: 0, time: 0, specialsFired: 0, coinsCollected: 0, biggestCombo: 0, agesReached: 0, turretsBuilt: 0, heroesSummoned: 0 };

  // ---- Achievements ----
  // Persisted in localStorage across runs. Earned during play, toast
  // pops in the corner. Full list lives in a modal.
  const ACHIEVEMENTS = [
    { id: 'first_blood',  icon: '⚔️',  title: 'First Blood',     desc: 'Kill an enemy unit.' },
    { id: 'first_age',    icon: '🏰',  title: 'Evolving',         desc: 'Reach the Castle Age.' },
    { id: 'industrial',   icon: '🏭',  title: 'Renaissance Man',  desc: 'Reach the Renaissance Age.' },
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
    // On touch devices, swap the keyboard-centric tutorial for tap-friendly
    // wording. Keep the same 5-step structure so the layout is unchanged.
    const isTouch = (typeof window !== 'undefined') &&
                    ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    if (isTouch) {
      const steps = modal.querySelector('.aow-welcome-steps');
      if (steps) {
        steps.innerHTML = `
          <div class="aow-welcome-step"><span class="aow-welcome-num">1</span><div><strong>Tap a unit card</strong> at the bottom to send a soldier into battle. Each unit costs gold and has a brief cooldown.</div></div>
          <div class="aow-welcome-step"><span class="aow-welcome-num">2</span><div><strong>Tap coins</strong> dropped by kills to scoop up gold. Drag a finger across the screen to sweep many at once. Coins you miss auto-collect after a few seconds.</div></div>
          <div class="aow-welcome-step"><span class="aow-welcome-num">3</span><div><strong>Age up</strong> with the <em>Age Up</em> button when you have enough XP. Unlocks stronger units and a new <strong>Special</strong> attack.</div></div>
          <div class="aow-welcome-step"><span class="aow-welcome-num">4</span><div><strong>Summon a Hero</strong> with the <em>Hero</em> button — expensive but devastating. A new hero unlocks each era.</div></div>
          <div class="aow-welcome-step"><span class="aow-welcome-num">5</span><div><strong>Build turrets</strong> in the <em>Turrets</em> tab. They snipe enemies for you while you focus on coins.</div></div>
        `;
      }
    }
    modal.style.display = 'flex';
    setModalPaused(true);
    const close = () => {
      modal.style.display = 'none';
      try { localStorage.setItem('aow-welcome-seen', '1'); } catch {}
      setModalPaused(anyModalOpen());
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
    // Turret-full now requires all 4 slots PURCHASED (was: array-full when
    // slots were free). More meaningful since slots cost gold now.
    if (playerSlotsOwned === TURRET_SLOTS_MAX &&
        playerTurrets.slice(0, playerSlotsOwned).every(t => t)) unlock('turret_full');
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
    { era: 0, key: 'hero_grog',    name: 'Grog the Stomper', icon: '🦣', sprite: '🦣',  cost: 600,  hp: 1200, dmg: 80,  range: 28,  atkSpd: 0.6, speed: 38, color: '#7a4a22', xp: 200, gold: 400, silhouette: 'beast',  cd: 50 },
    { era: 1, key: 'hero_paladin', name: 'Sir Lancelot',     icon: '🛡️', sprite: '⚔️',  cost: 1400, hp: 2400, dmg: 130, range: 28,  atkSpd: 0.7, speed: 40, color: '#dadce0', xp: 400, gold: 800, silhouette: 'humanoid', cd: 55 },
    { era: 2, key: 'hero_general', name: 'The General',      icon: '🎖️', sprite: '🎖️',  cost: 3200, hp: 3600, dmg: 240, range: 240, atkSpd: 0.9, speed: 40, color: '#5d7b3a', xp: 700, gold: 1500, silhouette: 'humanoid', cd: 60 },
    { era: 3, key: 'hero_seal',    name: 'Black Ops',         icon: '🎯', sprite: '🕵',   cost: 7000, hp: 4500, dmg: 480, range: 320, atkSpd: 1.6, speed: 42, color: '#2a3520', xp: 1300, gold: 2600, silhouette: 'humanoid', cd: 65 },
    { era: 4, key: 'hero_titan',   name: 'Titan',            icon: '⚡', sprite: '👹',  cost: 15000, hp: 8000, dmg: 900, range: 140, atkSpd: 0.7, speed: 38, color: '#7ec8ff', xp: 2800, gold: 5500, silhouette: 'vehicle', cd: 70 },
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
  // Bosses every 7 waves starting at wave 7. Previously every 5 made the
  // first boss hit before players could even age up, which felt like an
  // early-game wall. Wave 7 gives ~2 min of room to push to Medieval first.
  function isBossWave(n) { return n > 0 && n % 7 === 0; }

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
  // Persisted mute toggle (set via the settings modal).
  let soundMuted = false;
  try { soundMuted = localStorage.getItem('aow-muted') === '1'; } catch {}
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
      if (soundMuted) return;
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
    // Size the backing store to CSS px * devicePixelRatio for crisp HiDPI
    // rendering. The canvas's on-screen CSS size is already fully
    // responsive (width:100%/height:100% inside an aspect-ratio-locked
    // .aow-stage), so we deliberately do NOT touch canvas.style.width/height
    // here — only the backing-store resolution changes.
    dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    try { hapticsOK = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch {}
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
    trainingQueue = [];
    enemySpawnT = 1.0;
    goldTrickleT = 0;
    specialReadyT = 6;
    goldFloaters = [];
    dmgFloaters = [];
    muzzleFlashes = [];
    impactRings = [];
    strikes = [];
    coinDrops = [];
    ageFlash = 0;
    ageBannerT = 0;
    ageBannerText = '';
    deadUnits = [];
    particles = [];
    playerTurrets = [null, null, null, null];
    enemyTurrets  = [null, null, null, null];
    playerSlotsOwned = 2;
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
    renderTrainingQueue();
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
      attackPose: 0,                       // seconds remaining in strike pose
    };
    units.push(u);
  }

  function tryPlayerSpawn(key) {
    if (gameOver) return;
    const def = UNITS[key];
    if (!def) return;
    if (def.era > playerEra) return;
    if (gold < def.cost) return;
    if (trainingQueue.length >= TRAINING_MAX) return;
    gold -= def.cost;
    const total = trainingTimeFor(def);
    trainingQueue.push({ key, total, remaining: total });
    SFX.spawn();
    renderHud();
    renderTrainingQueue();
    renderSpawnPanel();
  }
  function cancelTrainingAt(idx) {
    // Click a queue slot to cancel: full refund (no penalty -- cheap UX
    // since the only "cost" was the queue slot which is being freed).
    const entry = trainingQueue[idx];
    if (!entry) return;
    const def = UNITS[entry.key];
    if (def) gold += def.cost;
    trainingQueue.splice(idx, 1);
    renderHud();
    renderTrainingQueue();
    renderSpawnPanel();
  }
  function tickTraining(dt) {
    if (!trainingQueue.length) return;
    const front = trainingQueue[0];
    front.remaining -= dt;
    if (front.remaining <= 0) {
      spawnUnit('player', front.key);
      trainingQueue.shift();
      renderTrainingQueue();
      renderSpawnPanel();
    } else {
      // Cheap update: just push the progress style update for the front slot.
      const slot = document.getElementById('aow-train-slot-0');
      if (slot) slot.style.setProperty('--aow-train', ((1 - front.remaining / front.total) * 100) + '%');
    }
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
    // Evolving is the ONLY way to recover base HP, so make it count:
    // raise max HP and FULLY restore current HP to the new max. This turns
    // a well-timed Age Up into a genuine "heal under pressure" moment.
    const hpBoost = 600;
    const before = playerBaseHp;
    playerBaseMax += hpBoost;
    playerBaseHp = playerBaseMax;             // full restore
    const healed = Math.round(playerBaseHp - before);
    if (healed > 0) {
      // Reuse the gold-floater renderer (supports arbitrary text + color)
      // so we can show a green "+N HP" pop above the base on evolve.
      goldFloaters.push({
        text: '+' + healed + ' HP', x: PLAYER_BASE_X + BASE_W / 2,
        y: GROUND_Y - 150, color: '#3FB950', t: 1.6,
      });
    }
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
    renderTrainingQueue();
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
    if (slot >= playerSlotsOwned) return;             // can't build on locked slots
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
  function trySellTurret(slot) {
    if (gameOver) return;
    const t = playerTurrets[slot];
    if (!t) return;
    // Refund based on the turret's original cost (sum of upgrade path
    // would be ideal, but the catalog only stores current-tier cost, so
    // refund a flat 50% of that as the canonical "partial refund").
    const refund = Math.round(t.cost * SELL_REFUND);
    gold += refund;
    playerTurrets[slot] = null;
    SFX.coin();
    goldFloaters.push({
      text: '+$' + refund, x: PLAYER_BASE_X + BASE_W / 2,
      y: GROUND_Y - 110, color: '#fcd34d', t: 1.2,
    });
    renderHud();
    renderTurretPanel();
  }
  function tryBuyTurretSlot() {
    if (gameOver) return;
    if (playerSlotsOwned >= TURRET_SLOTS_MAX) return;
    const cost = SLOT_PURCHASE_COSTS[playerSlotsOwned] || 0;
    if (gold < cost) return;
    gold -= cost;
    playerSlotsOwned += 1;
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
      if (m) { m.style.display = 'flex'; setModalPaused(true); }
    };
    const achClose = document.getElementById('aow-ach-close');
    if (achClose) achClose.onclick = () => {
      const m = document.getElementById('aow-ach-modal');
      if (m) m.style.display = 'none';
      setModalPaused(anyModalOpen());
    };
    const achModal = document.getElementById('aow-ach-modal');
    if (achModal) achModal.addEventListener('click', e => {
      if (e.target === achModal) {
        achModal.style.display = 'none';
        setModalPaused(anyModalOpen());
      }
    });

    // Settings modal (gear icon in the HUD)
    const settingsModal = document.getElementById('aow-settings-modal');
    const settingsBtn   = document.getElementById('aow-settings-btn');
    const settingsClose = document.getElementById('aow-settings-close');
    function openSettings() {
      if (!settingsModal) return;
      // Sync the modal's difficulty pills with current state
      settingsModal.querySelectorAll('#aow-diff-modal button').forEach(b => {
        b.classList.toggle('active', b.dataset.diff === difficulty);
      });
      // Sync mute toggle
      const mt = document.getElementById('aow-mute-toggle');
      if (mt) mt.setAttribute('aria-pressed', String(soundMuted));
      settingsModal.style.display = 'flex';
      setModalPaused(true);
    }
    function closeSettings() {
      if (settingsModal) settingsModal.style.display = 'none';
      setModalPaused(anyModalOpen());
    }
    if (settingsBtn) settingsBtn.onclick = openSettings;
    if (settingsClose) settingsClose.onclick = closeSettings;
    if (settingsModal) settingsModal.addEventListener('click', e => {
      if (e.target === settingsModal) closeSettings();
    });
    // Difficulty buttons inside the modal
    settingsModal && settingsModal.querySelectorAll('#aow-diff-modal button').forEach(btn => {
      btn.onclick = () => {
        difficulty = btn.dataset.diff;
        try { localStorage.setItem('aow-difficulty', difficulty); } catch {}
        // Reflect in both pill rows
        document.querySelectorAll('.aow-diff button').forEach(b => {
          b.classList.toggle('active', b.dataset.diff === difficulty);
        });
      };
    });
    // Mute toggle
    const muteToggle = document.getElementById('aow-mute-toggle');
    if (muteToggle) muteToggle.onclick = () => {
      soundMuted = !soundMuted;
      try { localStorage.setItem('aow-muted', soundMuted ? '1' : '0'); } catch {}
      muteToggle.setAttribute('aria-pressed', String(soundMuted));
    };
    // Replay tutorial
    const replayBtn = document.getElementById('aow-replay-tutorial');
    if (replayBtn) replayBtn.onclick = () => {
      try { localStorage.removeItem('aow-welcome-seen'); } catch {}
      closeSettings();
      maybeShowWelcome();
    };
    // Reset progress
    const resetBtn = document.getElementById('aow-reset-progress');
    if (resetBtn) resetBtn.onclick = () => {
      if (!confirm('Reset all achievements and best run? This cannot be undone.')) return;
      try {
        localStorage.removeItem('aow-achievements');
        localStorage.removeItem('aow-best-run');
      } catch {}
      earnedAchievements = {};
      closeSettings();
    };
    // Click-to-collect coins. Map pointer event to canvas-internal
    // coords (canvas is responsive; rect may differ from intrinsic size).
    // We also handle pointermove during a held press so dragging a
    // finger across the field sweeps up coins — much more forgiving
    // than tapping each one individually on a small touchscreen.
    let pointerHeld = false;
    function pointerToCanvas(e) {
      const rect = canvas.getBoundingClientRect();
      // Map into WIDTH/HEIGHT logical space (not canvas.width/height, which
      // is the DPR-scaled backing store) — game entities live in logical
      // coordinates, so dividing by the backing store here would silently
      // scale every click by devicePixelRatio.
      return {
        x: (e.clientX - rect.left) * (WIDTH  / rect.width),
        y: (e.clientY - rect.top)  * (HEIGHT / rect.height),
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
      if (modalPaused) return; // ignore game keys while a modal has the sim paused
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
      } else if (e.key === 'q' || e.key === 'Q') {
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
      // Gentler scaling so late bosses stay beatable. Heavies now carry a
      // wall-premium HP pool themselves, so the boss multiplier is softer:
      // wave 5 -> ~2.4x HP, wave 10 -> ~3.2x, wave 15 -> ~3.9x, cap ~5x.
      const hpScale  = Math.min(5.0, 2.4 + (waveNum - 5) * 0.15);
      const dmgScale = Math.min(2.4, 1.3 + (waveNum - 5) * 0.08);
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
  // Visual identity of each shooter's projectile. Hit detection is
  // x-based, so the arc fields (vy/grav) added at fire time are purely
  // cosmetic. Unknown keys fall back to dmg-based heuristics in
  // drawProjectile, so modded/boss units still render sensibly.
  const PROJECTILE_KINDS = {
    sling: 'stone', archer: 'arrow', rifleman: 'bullet', cannon: 'shell',
    tank1: 'shell', soldier: 'bullet', sniper: 'tracer', tank2: 'shell',
    laser: 'laser', flier: 'plasma',
    hero_general: 'bullet', hero_seal: 'tracer',
  };
  const TURRET_PROJECTILE_KINDS = ['stone', 'arrow', 'shell', 'bullet', 'plasma'];
  function projectileKindFor(key) {
    if (!key) return null;
    if (key.startsWith('boss_')) key = key.slice(5).replace(/_\d+$/, '');
    return PROJECTILE_KINDS[key] || null;
  }
  // Arc gravity (px/s^2) per kind. Launch vy is derived from the shot
  // distance so every lobbed round rises and lands level with its launch
  // height: vy0 = -g * flight / 2, flight = dist / projectile speed.
  const PROJECTILE_ARC_G = { stone: 700, arrow: 550, shell: 520 };
  function projectileArc(kind, dist, speed) {
    const g = PROJECTILE_ARC_G[kind];
    if (!g) return { vy: 0, grav: 0 };
    const flight = Math.max(0.15, dist / speed);
    return { vy: -g * flight / 2, grav: g };
  }

  function update(dt) {
    if (!running) return;
    // Pause sim while a modal is open so the player isn't punished for
    // reading the tutorial / tweaking settings / browsing achievements.
    if (modalPaused) return;

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

    // Tick the training queue: front entry trains down, spawns when done.
    tickTraining(dt);
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

      u.attackPose = Math.max(0, u.attackPose - dt);
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
          u.attackPose = 0.22;  // hold strike pose ~220ms
          if (isBase) {
            if (u.side === 'player') enemyBaseHp -= u.dmg;
            else                   { playerBaseHp -= u.dmg; vibrateBaseHit(); }
            spawnDmgFloater(u.dmg, baseTargetX, GROUND_Y - 90, u.side === 'player' ? '#F85149' : '#fcd34d');
            // Heavy hit = noticeable shake; small hit = light shake.
            shake(Math.min(8, 1 + u.dmg / 80), 0.18);
          } else if (target) {
            if (u.range > 60) {
              const kind = projectileKindFor(u.key);
              const arc = projectileArc(kind, dist, 360);
              projectiles.push({
                side: u.side, x: u.x, y: GROUND_Y - u.h * 0.6 - u.yOffset,
                vx: dirX * 360, dmg: u.dmg, life: 1.5, color: u.color,
                kind, vy: arc.vy, grav: arc.grav,
                trail: [],
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
      // Record a brief trail (last 6 positions) for fade rendering
      if (!p.trail) p.trail = [];
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 6) p.trail.shift();
      p.x += p.vx * dt;
      if (p.grav) {
        // Cosmetic ballistic arc — collisions stay x-based.
        p.y += p.vy * dt;
        p.vy += p.grav * dt;
        if (p.y > GROUND_Y - 8) { p.y = GROUND_Y - 8; p.vy = 0; p.grav = 0; }
      }
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
          vibrateBaseHit();
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
    for (const r of impactRings) r.t -= dt;
    impactRings = impactRings.filter(r => r.t > 0);
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
        const tKind = TURRET_PROJECTILE_KINDS[t.era] || null;
        const tArc = projectileArc(tKind, bestDist, 380);
        projectiles.push({
          side, x: turretX,
          y: GROUND_Y - 90,
          vx: (target.x > turretX ? 1 : -1) * 380,
          dmg: t.dmg, life: 1.2, color: t.color || '#fcd34d',
          kind: tKind, vy: tArc.vy, grav: tArc.grav,
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
    // Shockwave ring at the impact point
    impactRings.push({ x, y, t: 0.32, max: 0.32, color });
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
      // Reapply dpr on every setTransform — the shake offset (ox, oy) is in
      // logical units, but setTransform's translate is in device pixels, so
      // it must be scaled by dpr too; otherwise HiDPI screens would either
      // lose the backing-store scale (blurry/tiny render) or shake too little.
      ctx.setTransform(dpr, 0, 0, dpr, ox * dpr, oy * dpr);
    } else {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    // ---- Atmosphere ----
    // 4-stop sky gradient (deeper at zenith, hazier near horizon) for depth.
    const [skyTop, skyHorizon] = OG_SKY[playerEra];
    const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    grad.addColorStop(0,    skyTop);
    grad.addColorStop(0.55, skyHorizon);
    grad.addColorStop(0.85, mixHex(skyHorizon, '#ffffff', 0.18));
    grad.addColorStop(1,    mixHex(skyHorizon, '#ffffff', 0.32));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WIDTH, GROUND_Y);

    // Soft sun halo glow behind the disc -- huge atmospheric impact for a
    // tiny amount of paint. Skips at the (null) era (modern, overcast).
    const sunC = OG_SUN[playerEra];
    const sunX = WIDTH * 0.82, sunY = 80;
    if (sunC) {
      // Outer warm halo
      const halo = ctx.createRadialGradient(sunX, sunY, 18, sunX, sunY, 260);
      halo.addColorStop(0,    sunC + 'ee');
      halo.addColorStop(0.18, sunC + '70');
      halo.addColorStop(0.45, sunC + '22');
      halo.addColorStop(1,    sunC + '00');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(sunX, sunY, 260, 0, Math.PI * 2); ctx.fill();
      // Tight inner bloom
      const bloom = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 70);
      bloom.addColorStop(0, '#ffffffcc');
      bloom.addColorStop(0.5, sunC + 'aa');
      bloom.addColorStop(1, sunC + '00');
      ctx.fillStyle = bloom;
      ctx.beginPath(); ctx.arc(sunX, sunY, 70, 0, Math.PI * 2); ctx.fill();
      // Sun disc itself
      ctx.fillStyle = sunC;
      ctx.beginPath(); ctx.arc(sunX, sunY, 36, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1.5; ctx.stroke();
      // Faint vertical god rays (very subtle)
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = sunC + '14';
      for (let r = 0; r < 6; r++) {
        const ang = -Math.PI / 2 + (r - 2.5) * 0.18;
        ctx.beginPath();
        ctx.moveTo(sunX, sunY);
        ctx.lineTo(sunX + Math.cos(ang) * 600 - 24, sunY + Math.sin(ang) * 600);
        ctx.lineTo(sunX + Math.cos(ang) * 600 + 24, sunY + Math.sin(ang) * 600);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }

    // Far-back parallax silhouette — darker, lower-amplitude.
    // Sits below the near hill to suggest a distant horizon.
    const farColor = OG_HILL[playerEra];
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = mixHex(farColor, skyHorizon, 0.45);  // tinted toward sky for atmosphere
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    for (let x = 0; x <= WIDTH; x += 30) {
      const h = 36 + Math.sin(x * 0.014 + 1.7) * 16 + Math.sin(x * 0.04) * 8;
      ctx.lineTo(x, GROUND_Y - h);
    }
    ctx.lineTo(WIDTH, GROUND_Y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Near distant mountain silhouette
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

    // Midground silhouettes (distant trees / windmills / smokestacks / spires
    // depending on era). Drawn before the haze so the haze tints them.
    drawMidgroundSilhouettes(playerEra);

    // Horizon haze band — desaturates+blurs the hill-to-ground transition.
    // Drawn after hills so it tints them; before clouds so clouds stay crisp.
    const hazeBand = ctx.createLinearGradient(0, GROUND_Y - 60, 0, GROUND_Y);
    hazeBand.addColorStop(0, mixHex(skyHorizon, '#ffffff', 0.32) + '00');
    hazeBand.addColorStop(1, mixHex(skyHorizon, '#ffffff', 0.32) + '80');
    ctx.fillStyle = hazeBand;
    ctx.fillRect(0, GROUND_Y - 60, WIDTH, 60);

    // A few simple clouds (cartoon, white)
    for (const c of bgClouds) drawCloud(c.x, c.y, c.r);

    // Midground foliage (per-era trees, lined up just in front of the
    // hills so they break up the empty sky-to-ground gap.)
    drawFoliage(playerEra);

    // Ground (per-era color + speckle texture)
    drawGround(playerEra);

    // Bases (per-era art)
    drawBase(PLAYER_BASE_X, era.baseColor, era.icon, playerEra, playerBaseHp / playerBaseMax);
    const eEra = ERAS[enemyEra];
    drawBase(ENEMY_BASE_X, eEra.baseColor, eEra.icon, enemyEra, enemyBaseHp / enemyBaseMax);

    // Turrets (player + enemy) — small icons on the base ramparts
    drawTurrets(PLAYER_BASE_X, playerTurrets, +1);
    drawTurrets(ENEMY_BASE_X,  enemyTurrets,  -1);

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

    // Muzzle flashes: bursty 6-spoke star with hot center
    for (const m of muzzleFlashes) {
      const k = m.t / 0.12;                 // 1 -> 0
      const r = 6 + (1 - k) * 14;
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.fillStyle = `rgba(255,220,120,${k * 0.85})`;
      ctx.beginPath();
      for (let s = 0; s < 6; s++) {
        const a = (s * Math.PI) / 3;
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.lineTo(Math.cos(a + Math.PI/6) * r * 0.4, Math.sin(a + Math.PI/6) * r * 0.4);
      }
      ctx.fill();
      ctx.fillStyle = `rgba(255,255,220,${k * 0.95})`;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Impact shockwave rings: expand + fade
    for (const r of impactRings) {
      const k = 1 - r.t / r.max;          // 0 -> 1
      const radius = 6 + k * 26;
      ctx.strokeStyle = `rgba(255,236,170,${(1 - k) * 0.9})`;
      ctx.lineWidth = 3 * (1 - k);
      ctx.beginPath();
      ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${(1 - k) * 0.5})`;
      ctx.lineWidth = 1.5 * (1 - k);
      ctx.beginPath();
      ctx.arc(r.x, r.y, radius * 0.6, 0, Math.PI * 2);
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

  // Blend two #rrggbb colors. t=0 returns a, t=1 returns b. Used for
  // atmospheric haze tinting (distant hills toward sky color, etc).
  function mixHex(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
    const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return '#' + ((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0');
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
    // Layered ground: base color → highlight-near-horizon band → darker
    // foreground for depth → speckle texture so it doesn't read as flat.
    const base = GROUND_COLORS[eraIdx] || '#7a6648';
    ctx.fillStyle = base;
    ctx.fillRect(0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y);

    // Brighter highlight strip right at the horizon (sun-lit catch)
    const horizonHi = ctx.createLinearGradient(0, GROUND_Y, 0, GROUND_Y + 28);
    horizonHi.addColorStop(0, 'rgba(255, 245, 200, 0.32)');
    horizonHi.addColorStop(1, 'rgba(255, 245, 200, 0)');
    ctx.fillStyle = horizonHi;
    ctx.fillRect(0, GROUND_Y, WIDTH, 28);

    // Dark horizon edge line (defines the ground silhouette)
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, GROUND_Y); ctx.lineTo(WIDTH, GROUND_Y); ctx.stroke();

    // Deeper-front vertical vignette (the foreground recedes into shadow)
    const fade = ctx.createLinearGradient(0, GROUND_Y, 0, HEIGHT);
    fade.addColorStop(0,    'rgba(255,255,255,0.04)');
    fade.addColorStop(0.55, 'rgba(0,0,0,0.10)');
    fade.addColorStop(1,    'rgba(0,0,0,0.45)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y);

    // Ground texture: deterministic speckles + dirt patches anchored to
    // their x-coord so they don't shimmer between frames. Two passes:
    // light pebbles near the horizon, darker dirt closer to camera.
    ctx.fillStyle = 'rgba(255,255,240,0.10)';
    for (let i = 0; i < 60; i++) {
      const sx = (i * 137 + 53) % WIDTH;
      const sy = GROUND_Y + 6 + (i * 19) % 22;
      ctx.fillRect(sx, sy, 2, 1);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let i = 0; i < 80; i++) {
      const sx = (i * 91 + 17) % WIDTH;
      const sy = GROUND_Y + 30 + (i * 23) % (HEIGHT - GROUND_Y - 32);
      const sz = 1 + (i % 3);
      ctx.fillRect(sx, sy, sz, 1);
    }
    // A few larger dirt smudges
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    for (let i = 0; i < 14; i++) {
      const sx = (i * 211 + 71) % WIDTH;
      const sy = GROUND_Y + 18 + (i * 41) % (HEIGHT - GROUND_Y - 24);
      ctx.beginPath();
      ctx.ellipse(sx, sy, 10 + (i % 4) * 4, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Grass tufts (stone + medieval eras only — green organic)
    if (eraIdx <= 1) {
      ctx.strokeStyle = eraIdx === 0 ? 'rgba(60,120,40,0.6)' : 'rgba(40,110,30,0.7)';
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 36; i++) {
        const gx = (i * 167 + 29) % WIDTH;
        const gy = GROUND_Y + 4 + (i * 13) % 14;
        ctx.beginPath();
        ctx.moveTo(gx - 2, gy + 4); ctx.lineTo(gx,     gy);
        ctx.moveTo(gx,     gy + 4); ctx.lineTo(gx + 1, gy - 1);
        ctx.moveTo(gx + 2, gy + 4); ctx.lineTo(gx + 4, gy);
        ctx.stroke();
      }
    }
  }

  // Midground foliage — small cartoon trees / bushes / pylons arranged at
  // stable seeded positions so the row of units has something to march
  // through instead of standing in front of a flat color. Anchored at
  // GROUND_Y so they sit on the same line as the units.
  function drawFoliage(eraIdx) {
    const drawTree = (x, scale, fillA, fillB) => {
      // Ground shadow (anchors the tree)
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.ellipse(x + 4 * scale, GROUND_Y - 1, 18 * scale, 4 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      // Trunk with a darker side-shadow (light from upper-left)
      ctx.fillStyle = '#5a3a1a';
      ctx.fillRect(x - 3 * scale, GROUND_Y - 18 * scale, 6 * scale, 18 * scale);
      ctx.fillStyle = '#3a2410';
      ctx.fillRect(x + 0.5 * scale, GROUND_Y - 18 * scale, 2.5 * scale, 18 * scale);
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
      // Canopy shading on right side (light from upper-left)
      ctx.save();
      ctx.beginPath();
      ctx.arc(x,              GROUND_Y - 28 * scale, 14 * scale, 0, Math.PI * 2);
      ctx.arc(x - 11 * scale, GROUND_Y - 22 * scale, 11 * scale, 0, Math.PI * 2);
      ctx.arc(x + 11 * scale, GROUND_Y - 22 * scale, 11 * scale, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(x + 1 * scale, GROUND_Y - 36 * scale, 26 * scale, 26 * scale);
      ctx.restore();
      // Two highlight dabs
      ctx.fillStyle = fillB;
      ctx.beginPath();
      ctx.arc(x - 3 * scale, GROUND_Y - 31 * scale, 4 * scale, 0, Math.PI * 2);
      ctx.arc(x - 11 * scale, GROUND_Y - 24 * scale, 2.5 * scale, 0, Math.PI * 2);
      ctx.fill();
    };
    const drawConifer = (x, scale, fill) => {
      // Ground shadow
      ctx.fillStyle = 'rgba(0,0,0,0.30)';
      ctx.beginPath();
      ctx.ellipse(x + 3 * scale, GROUND_Y - 1, 14 * scale, 3.5 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4a2e14';
      ctx.fillRect(x - 2 * scale, GROUND_Y - 6 * scale, 4 * scale, 6 * scale);
      ctx.fillStyle = fill;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1.4;
      // Shadow color for the right-side of each tier
      const sh = 'rgba(0,0,0,0.20)';
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
        // Right-half shadow (light from upper-left)
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x,       yTop);
        ctx.lineTo(x - w/2, yBot);
        ctx.lineTo(x + w/2, yBot);
        ctx.closePath();
        ctx.clip();
        ctx.fillStyle = sh;
        ctx.fillRect(x, yTop, w, yBot - yTop);
        ctx.restore();
      }
    };
    const drawBush = (x, scale, fill) => {
      // Ground shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(x + 2 * scale, GROUND_Y - 1, 11 * scale, 3 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = fill;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(x - 6 * scale, GROUND_Y - 6 * scale, 7 * scale, 0, Math.PI * 2);
      ctx.arc(x + 5 * scale, GROUND_Y - 7 * scale, 8 * scale, 0, Math.PI * 2);
      ctx.arc(x,              GROUND_Y - 10 * scale, 9 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Right-side shading clip
      ctx.save();
      ctx.beginPath();
      ctx.arc(x - 6 * scale, GROUND_Y - 6 * scale, 7 * scale, 0, Math.PI * 2);
      ctx.arc(x + 5 * scale, GROUND_Y - 7 * scale, 8 * scale, 0, Math.PI * 2);
      ctx.arc(x,              GROUND_Y - 10 * scale, 9 * scale, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(x + 1 * scale, GROUND_Y - 16 * scale, 18 * scale, 18 * scale);
      ctx.restore();
    };
    const drawRock = (x, scale) => {
      // Ground shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(x + 3 * scale, GROUND_Y - 1, 16 * scale, 3 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
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
      // Highlight + shadow side
      ctx.fillStyle = '#a8957a';
      ctx.fillRect(x - 8 * scale, GROUND_Y - 9 * scale, 5 * scale, 2 * scale);
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(x, GROUND_Y - 5 * scale, 14 * scale, 7 * scale, 0, Math.PI, 0);
      ctx.lineTo(x + 14 * scale, GROUND_Y);
      ctx.lineTo(x - 14 * scale, GROUND_Y);
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = 'rgba(0,0,0,0.20)';
      ctx.fillRect(x + 2 * scale, GROUND_Y - 12 * scale, 14 * scale, 14 * scale);
      ctx.restore();
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
    // Soft volumetric cloud: three painted passes per cloud so they have
    // light/mid/shadow tone instead of reading as a flat white sticker.
    // Five-lobe silhouette with top-light highlights + sky-tinted underside.
    const lobes = [
      { dx: 0,            dy: 0,            r: r          },
      { dx: r * 0.85,     dy: r * 0.10,     r: r * 0.85   },
      { dx: -r * 0.85,    dy: r * 0.15,     r: r * 0.78   },
      { dx: r * 0.35,     dy: -r * 0.45,    r: r * 0.65   },
      { dx: -r * 0.30,    dy: -r * 0.40,    r: r * 0.60   },
    ];

    // 1) Soft cool underside shadow (the cloud's belly catches sky color)
    ctx.fillStyle = 'rgba(80, 120, 170, 0.22)';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.55, r * 1.55, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2) Main cloud body — slightly cool off-white
    ctx.fillStyle = '#f0f5fa';
    ctx.beginPath();
    for (const l of lobes) {
      ctx.moveTo(x + l.dx + l.r, y + l.dy);
      ctx.arc(x + l.dx, y + l.dy, l.r, 0, Math.PI * 2);
    }
    ctx.fill();

    // 2b) Inner cool shade — paints lobe undersides with a sky-blue tint
    ctx.save();
    ctx.beginPath();
    for (const l of lobes) {
      ctx.moveTo(x + l.dx + l.r, y + l.dy);
      ctx.arc(x + l.dx, y + l.dy, l.r, 0, Math.PI * 2);
    }
    ctx.clip();
    ctx.fillStyle = 'rgba(140, 170, 200, 0.35)';
    ctx.fillRect(x - r * 2, y + r * 0.05, r * 4, r * 1.2);
    ctx.restore();

    // 3) Top highlights — bright catch on the upper-left of each lobe
    ctx.fillStyle = '#ffffff';
    for (const l of lobes) {
      const hx = x + l.dx - l.r * 0.25;
      const hy = y + l.dy - l.r * 0.30;
      ctx.beginPath();
      ctx.arc(hx, hy, l.r * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
    // 3b) Crisp specular dab at the very top
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    for (const l of lobes) {
      const hx = x + l.dx - l.r * 0.40;
      const hy = y + l.dy - l.r * 0.55;
      ctx.beginPath();
      ctx.arc(hx, hy, l.r * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Distant midground silhouettes — sit between the back hills and the
  // play area to fill the visually empty middle band of the screen.
  // Era-specific: stone gets tree clusters, medieval gets a windmill +
  // tree, industrial gets smokestacks with plumes, modern gets low
  // buildings + antenna, future gets glowing spire towers.
  function drawMidgroundSilhouettes(eraIdx) {
    const skyHorizon = OG_SKY[eraIdx][1];
    const hillC = OG_HILL[eraIdx];
    // Silhouette color: hill tinted toward sky (atmospheric perspective)
    const silColor = mixHex(hillC, skyHorizon, 0.55);
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = silColor;
    const groups = [
      { cx: WIDTH * 0.28, scale: 1.0 },
      { cx: WIDTH * 0.72, scale: 0.9 },
    ];
    const baseY = GROUND_Y - 14;
    for (const g of groups) {
      const s = g.scale;
      if (eraIdx === 0) {
        for (let i = 0; i < 5; i++) {
          const tx = g.cx + (i - 2) * 14 * s;
          const ty = baseY - 22 * s + Math.abs(i - 2) * 2;
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(tx - 8 * s, baseY);
          ctx.lineTo(tx + 8 * s, baseY);
          ctx.closePath(); ctx.fill();
        }
      } else if (eraIdx === 1) {
        const wx = g.cx;
        ctx.fillRect(wx - 6 * s, baseY - 36 * s, 12 * s, 36 * s);
        ctx.beginPath();
        ctx.moveTo(wx - 9 * s, baseY - 36 * s);
        ctx.lineTo(wx + 9 * s, baseY - 36 * s);
        ctx.lineTo(wx, baseY - 46 * s);
        ctx.closePath(); ctx.fill();
        ctx.save();
        ctx.translate(wx, baseY - 40 * s);
        ctx.rotate(Math.sin(performance.now() / 1800 + g.cx) * 0.05);
        for (let i = 0; i < 4; i++) {
          ctx.rotate(Math.PI / 2);
          ctx.fillRect(-1.5 * s, 0, 3 * s, 20 * s);
        }
        ctx.restore();
        ctx.beginPath();
        ctx.arc(wx + 22 * s, baseY - 14 * s, 8 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(wx + 21 * s, baseY - 8 * s, 2 * s, 8 * s);
      } else if (eraIdx === 2) {
        for (let i = 0; i < 3; i++) {
          const sx = g.cx + (i - 1) * 14 * s;
          const sh = (28 + (i % 2) * 8) * s;
          ctx.fillRect(sx - 3 * s, baseY - sh, 6 * s, sh);
          ctx.save();
          ctx.fillStyle = mixHex(silColor, '#ffffff', 0.55);
          ctx.globalAlpha = 0.45;
          ctx.beginPath();
          ctx.ellipse(sx + 2 * s, baseY - sh - 8 * s, 9 * s, 6 * s, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      } else if (eraIdx === 3) {
        for (let i = 0; i < 4; i++) {
          const sx = g.cx + (i - 1.5) * 18 * s;
          const sh = (18 + (i % 3) * 10) * s;
          ctx.fillRect(sx - 8 * s, baseY - sh, 16 * s, sh);
        }
        const ax = g.cx + 10 * s;
        ctx.fillRect(ax - 1 * s, baseY - 60 * s, 2 * s, 60 * s);
        ctx.save();
        ctx.fillStyle = '#ff5a5a';
        ctx.globalAlpha = (Math.floor(performance.now() / 700) & 1) ? 0.9 : 0.2;
        ctx.beginPath();
        ctx.arc(ax, baseY - 62 * s, 2 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        for (let i = 0; i < 4; i++) {
          const sx = g.cx + (i - 1.5) * 14 * s;
          const sh = (40 + (i % 2) * 14) * s;
          ctx.fillRect(sx - 2 * s, baseY - sh, 4 * s, sh);
          ctx.save();
          ctx.fillStyle = '#7ec8ff';
          ctx.globalAlpha = 0.6 + Math.sin(performance.now() / 320 + i) * 0.25;
          ctx.beginPath();
          ctx.arc(sx, baseY - sh - 2 * s, 2 * s, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }
    ctx.restore();
  }

  function drawBase(x, color, icon, eraIdx, hpFrac) {
    // Dispatch to era-specific art so each side reflects its era.
    if (eraIdx === undefined) eraIdx = 0;
    if (hpFrac === undefined) hpFrac = 1;
    switch (eraIdx) {
      case 0: drawBaseStone(x, color); break;
      case 1: drawBaseMedieval(x, color); break;
      case 2: drawBaseIndustrial(x, color); break;
      case 3: drawBaseModern(x, color); break;
      case 4: drawBaseFuture(x, color); break;
      default: drawBaseMedieval(x, color);
    }
    if (hpFrac < 0.7) drawBaseDamage(x, hpFrac);
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

  // Battle-damage overlay: cracks open below 70% HP, smoke rises below
  // 45%, open flames below 20% — one glance at a base reads the war state.
  // Crack positions are fixed (no per-frame randomness) so damage looks
  // structural instead of flickering.
  function drawBaseDamage(x, frac) {
    const now = performance.now();
    const cracks = [
      [x + BASE_W * 0.22, GROUND_Y - 4,  x + BASE_W * 0.30, GROUND_Y - 34, x + BASE_W * 0.24, GROUND_Y - 58],
      [x + BASE_W * 0.72, GROUND_Y - 2,  x + BASE_W * 0.64, GROUND_Y - 28, x + BASE_W * 0.70, GROUND_Y - 50],
      [x + BASE_W * 0.46, GROUND_Y - 10, x + BASE_W * 0.52, GROUND_Y - 40, x + BASE_W * 0.44, GROUND_Y - 66],
    ];
    const n = frac < 0.25 ? 3 : frac < 0.5 ? 2 : 1;
    ctx.strokeStyle = 'rgba(10,8,6,0.75)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const c = cracks[i];
      ctx.beginPath();
      ctx.moveTo(c[0], c[1]); ctx.lineTo(c[2], c[3]); ctx.lineTo(c[4], c[5]);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(c[2], c[3]); ctx.lineTo(c[2] + (i % 2 ? -9 : 9), c[3] - 8);
      ctx.stroke();
      ctx.lineWidth = 2;
    }
    if (frac < 0.45) {
      const plumes = frac < 0.2 ? [0.3, 0.62] : [0.42];
      for (let pi = 0; pi < plumes.length; pi++) {
        const px = x + BASE_W * plumes[pi];
        for (let i = 0; i < 4; i++) {
          const t = ((now / 1300) + i / 4 + pi * 0.37) % 1;
          const sy = GROUND_Y - 55 - t * 70;
          const sx = px + Math.sin((t * 5) + pi * 2) * 7;
          ctx.fillStyle = `rgba(70,66,62,${(1 - t) * 0.4})`;
          ctx.beginPath();
          ctx.arc(sx, sy, 5 + t * 9, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    if (frac < 0.2) {
      const spots = [0.3, 0.62];
      for (let fi = 0; fi < spots.length; fi++) {
        const fx = x + BASE_W * spots[fi], fy = GROUND_Y - 46 - fi * 10;
        const fl = 0.75 + Math.sin(now / 90 + fi * 1.7) * 0.25;
        const glow = ctx.createRadialGradient(fx, fy, 2, fx, fy, 26);
        glow.addColorStop(0, `rgba(255,160,60,${0.5 * fl})`);
        glow.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(fx, fy, 26, 0, Math.PI * 2); ctx.fill();
        for (let i = 0; i < 3; i++) {
          const tx = fx + (i - 1) * 7;
          const th = (13 + i * 4) * fl;
          ctx.fillStyle = i === 1 ? `rgba(255,214,110,${0.9 * fl})` : `rgba(255,140,50,${0.85 * fl})`;
          ctx.beginPath();
          ctx.moveTo(tx - 4, fy + 8);
          ctx.quadraticCurveTo(tx - 5 + Math.sin(now / 70 + i) * 2.5, fy - th * 0.5, tx, fy - th);
          ctx.quadraticCurveTo(tx + 5 + Math.sin(now / 80 + i * 2) * 2.5, fy - th * 0.5, tx + 4, fy + 8);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
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

    // Campfire flicker inside the cave mouth: warm radial glow + animated flame tongues + ember dots.
    const flameT = performance.now() / 120;
    const flicker = 0.85 + Math.sin(flameT) * 0.15;
    const glow = ctx.createRadialGradient(cx, GROUND_Y - 8, 2, cx, GROUND_Y - 8, 28);
    glow.addColorStop(0, `rgba(255, 200, 80, ${0.85 * flicker})`);
    glow.addColorStop(0.5, `rgba(255, 130, 40, ${0.45 * flicker})`);
    glow.addColorStop(1, 'rgba(255, 80, 20, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, GROUND_Y - 8, 28, 0, Math.PI * 2); ctx.fill();
    // Flame tongues (3 layered)
    ctx.fillStyle = `rgba(255,180,60,${0.85 * flicker})`;
    ctx.beginPath();
    ctx.moveTo(cx - 8, GROUND_Y - 4);
    ctx.quadraticCurveTo(cx - 5, GROUND_Y - 18, cx, GROUND_Y - 22 - Math.sin(flameT * 1.3) * 3);
    ctx.quadraticCurveTo(cx + 5, GROUND_Y - 18, cx + 8, GROUND_Y - 4);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = `rgba(255,230,140,${flicker})`;
    ctx.beginPath();
    ctx.moveTo(cx - 4, GROUND_Y - 4);
    ctx.quadraticCurveTo(cx - 2, GROUND_Y - 14, cx, GROUND_Y - 16 - Math.cos(flameT * 1.6) * 2);
    ctx.quadraticCurveTo(cx + 2, GROUND_Y - 14, cx + 4, GROUND_Y - 4);
    ctx.closePath(); ctx.fill();
    // Logs (two crossed sticks)
    ctx.strokeStyle = '#3a2010';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx - 10, GROUND_Y - 3); ctx.lineTo(cx + 10, GROUND_Y - 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 8, GROUND_Y - 5); ctx.lineTo(cx + 8, GROUND_Y - 3); ctx.stroke();

    // Skull mounted above the cave mouth (signature tribal warning)
    const skullY = GROUND_Y - 56;
    ctx.fillStyle = '#e8e0c0';
    ctx.beginPath(); ctx.arc(cx, skullY, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#15110c'; ctx.lineWidth = 1.2; ctx.stroke();
    // Eye sockets
    ctx.fillStyle = '#15110c';
    ctx.beginPath(); ctx.arc(cx - 2, skullY - 1, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 2, skullY - 1, 1.2, 0, Math.PI * 2); ctx.fill();
    // Jaw
    ctx.fillRect(cx - 3, skullY + 4, 6, 3);
    ctx.fillStyle = '#15110c';
    ctx.fillRect(cx - 2, skullY + 5, 1, 1.5);
    ctx.fillRect(cx + 1, skullY + 5, 1, 1.5);
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
    // Wall-mounted torches flanking the gate (animated flame)
    const tT = performance.now() / 110;
    const tFlick = 0.85 + Math.sin(tT) * 0.15;
    const drawTorch = (tx) => {
      // Bracket
      ctx.fillStyle = '#3a2010'; ctx.fillRect(tx - 3, GROUND_Y - 50, 6, 14);
      ctx.strokeStyle = '#15110c'; ctx.lineWidth = 1; ctx.strokeRect(tx - 3, GROUND_Y - 50, 6, 14);
      // Glow
      const g = ctx.createRadialGradient(tx, GROUND_Y - 56, 1, tx, GROUND_Y - 56, 20);
      g.addColorStop(0, `rgba(255,200,80,${0.8 * tFlick})`);
      g.addColorStop(1, 'rgba(255,80,20,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(tx, GROUND_Y - 56, 20, 0, Math.PI * 2); ctx.fill();
      // Flame
      ctx.fillStyle = `rgba(255,170,50,${tFlick})`;
      ctx.beginPath();
      ctx.moveTo(tx - 4, GROUND_Y - 50);
      ctx.quadraticCurveTo(tx - 2, GROUND_Y - 60, tx, GROUND_Y - 64 - Math.sin(tT * 1.3) * 2);
      ctx.quadraticCurveTo(tx + 2, GROUND_Y - 60, tx + 4, GROUND_Y - 50);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = `rgba(255,230,140,${tFlick})`;
      ctx.beginPath();
      ctx.moveTo(tx - 2, GROUND_Y - 50);
      ctx.quadraticCurveTo(tx, GROUND_Y - 58, tx + 2, GROUND_Y - 50);
      ctx.closePath(); ctx.fill();
    };
    drawTorch(x + 8);
    drawTorch(x + BASE_W - 8);

    // Tall pennant flagpole on the rampart (waving)
    const pX = x + BASE_W / 2;
    const pT = performance.now() / 600;
    ctx.strokeStyle = '#1a1208'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(pX, GROUND_Y - 92); ctx.lineTo(pX, GROUND_Y - 130); ctx.stroke();
    ctx.fillStyle = '#caa84a';
    ctx.beginPath(); ctx.arc(pX, GROUND_Y - 131, 2, 0, Math.PI * 2); ctx.fill();
    // Pennant (triangular flag waving)
    ctx.fillStyle = '#c43838';
    const wave = Math.sin(pT) * 2;
    ctx.beginPath();
    ctx.moveTo(pX, GROUND_Y - 128);
    ctx.quadraticCurveTo(pX + 12, GROUND_Y - 126 + wave, pX + 20 + wave, GROUND_Y - 122);
    ctx.quadraticCurveTo(pX + 12, GROUND_Y - 118 + wave, pX, GROUND_Y - 116);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#7a1818'; ctx.lineWidth = 1; ctx.stroke();
    // Gold cross on pennant
    ctx.strokeStyle = '#fcd34d'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pX + 6, GROUND_Y - 126); ctx.lineTo(pX + 6, GROUND_Y - 118);
    ctx.moveTo(pX + 3, GROUND_Y - 122); ctx.lineTo(pX + 9, GROUND_Y - 122);
    ctx.stroke();
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
    // Glowing furnace mouth visible through the door (pulses warm)
    const furnT = performance.now() / 300;
    const furnPulse = 0.7 + Math.sin(furnT) * 0.3;
    const furnGrad = ctx.createRadialGradient(x + 29, GROUND_Y - 18, 1, x + 29, GROUND_Y - 18, 16);
    furnGrad.addColorStop(0, `rgba(255, 180, 60, ${0.9 * furnPulse})`);
    furnGrad.addColorStop(0.6, `rgba(255, 90, 30, ${0.5 * furnPulse})`);
    furnGrad.addColorStop(1, 'rgba(255, 50, 10, 0)');
    ctx.fillStyle = furnGrad;
    ctx.beginPath(); ctx.arc(x + 29, GROUND_Y - 18, 16, 0, Math.PI * 2); ctx.fill();
    // Door bolts
    ctx.fillStyle = '#5a4a35';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.arc(x + 19, GROUND_Y - 32 + i * 8, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 39, GROUND_Y - 32 + i * 8, 1.5, 0, Math.PI * 2); ctx.fill();
    }
    // Windows (lit -- gold panes with cross frame)
    for (let i = 0; i < 3; i++) {
      const wx = x + 14 + i * 22;
      ctx.fillStyle = '#fcd34d';
      ctx.fillRect(wx, GROUND_Y - 62, 8, 8);
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1;
      ctx.strokeRect(wx, GROUND_Y - 62, 8, 8);
      ctx.beginPath(); ctx.moveTo(wx + 4, GROUND_Y - 62); ctx.lineTo(wx + 4, GROUND_Y - 54);
      ctx.moveTo(wx, GROUND_Y - 58); ctx.lineTo(wx + 8, GROUND_Y - 58); ctx.stroke();
    }
    // Chimney top warning light (blinks)
    const blink = Math.floor(performance.now() / 800) & 1;
    if (blink) {
      ctx.fillStyle = '#ff5a5a';
      ctx.beginPath(); ctx.arc(x + BASE_W - 16, GROUND_Y - 112, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,90,90,0.4)';
      ctx.beginPath(); ctx.arc(x + BASE_W - 16, GROUND_Y - 112, 5, 0, Math.PI * 2); ctx.fill();
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
    // Camo dapples on the wall
    ctx.fillStyle = 'rgba(40,55,30,0.55)';
    ctx.beginPath(); ctx.ellipse(x + 22, GROUND_Y - 48, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + 70, GROUND_Y - 22, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + 96, GROUND_Y - 44, 9, 3, 0, 0, Math.PI * 2); ctx.fill();
    // Sandbags
    ctx.fillStyle = '#8a7a55';
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.8;
    for (let i = 0; i < 7; i++) {
      const sx = x - 4 + i * 16;
      ctx.beginPath();
      ctx.ellipse(sx, GROUND_Y - 4, 9, 5, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      // stitch line
      ctx.beginPath(); ctx.moveTo(sx - 7, GROUND_Y - 4); ctx.lineTo(sx + 7, GROUND_Y - 4); ctx.stroke();
    }
    // Door
    ctx.fillStyle = '#1a2418';
    ctx.fillRect(x + BASE_W / 2 - 10, GROUND_Y - 30, 20, 30);
    ctx.strokeStyle = '#0a0e0a'; ctx.lineWidth = 1.4;
    ctx.strokeRect(x + BASE_W / 2 - 10, GROUND_Y - 30, 20, 30);
    // Tactical handle bar
    ctx.fillStyle = '#444'; ctx.fillRect(x + BASE_W / 2 - 6, GROUND_Y - 18, 12, 1.5);

    // Comms tower on the roof: tall mast with red blinker + sweeping radar dish
    const mastX = x + BASE_W - 14;
    const mastTop = GROUND_Y - 116;
    ctx.strokeStyle = '#2a3520'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(mastX, GROUND_Y - 80); ctx.lineTo(mastX, mastTop); ctx.stroke();
    // Cross arms
    ctx.beginPath(); ctx.moveTo(mastX - 6, GROUND_Y - 100); ctx.lineTo(mastX + 6, GROUND_Y - 100); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mastX - 4, GROUND_Y - 108); ctx.lineTo(mastX + 4, GROUND_Y - 108); ctx.stroke();
    // Blinker (red, every ~1s)
    const mBlink = (performance.now() % 1200) < 400;
    ctx.fillStyle = mBlink ? '#ff5a5a' : '#5a2018';
    ctx.beginPath(); ctx.arc(mastX, mastTop - 2, 2.5, 0, Math.PI * 2); ctx.fill();
    if (mBlink) {
      ctx.fillStyle = 'rgba(255,90,90,0.4)';
      ctx.beginPath(); ctx.arc(mastX, mastTop - 2, 6, 0, Math.PI * 2); ctx.fill();
    }

    // Roof-mounted searchlight (sweeps slowly across the sky toward the enemy)
    const lampX = x + 18;
    const lampY = GROUND_Y - 80;
    // Lamp body
    ctx.fillStyle = '#4a4a4a';
    ctx.beginPath(); ctx.arc(lampX, lampY, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#0a0e0a'; ctx.lineWidth = 1.2; ctx.stroke();
    // Sweep angle (0 = up, oscillates)
    const sweep = Math.sin(performance.now() / 2200) * 0.35;
    const beamLen = 80;
    const dx = Math.sin(sweep) * beamLen;
    const dy = -Math.cos(sweep) * beamLen;
    const beam = ctx.createLinearGradient(lampX, lampY, lampX + dx, lampY + dy);
    beam.addColorStop(0, 'rgba(220,240,255,0.45)');
    beam.addColorStop(1, 'rgba(220,240,255,0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(lampX - 3, lampY);
    ctx.lineTo(lampX + dx - 14, lampY + dy);
    ctx.lineTo(lampX + dx + 14, lampY + dy);
    ctx.lineTo(lampX + 3, lampY);
    ctx.closePath(); ctx.fill();
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

    // Holographic shield shimmer arcing over the tower
    const sT = performance.now() / 700;
    const shimmer = 0.35 + Math.sin(sT * 1.3) * 0.2;
    const cxF = x + BASE_W / 2;
    ctx.strokeStyle = `rgba(110, 196, 255, ${shimmer})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(cxF, GROUND_Y - 40, BASE_W / 2 + 6, 80, 0, Math.PI, 2 * Math.PI);
    ctx.stroke();
    ctx.strokeStyle = `rgba(160, 220, 255, ${shimmer * 0.6})`;
    ctx.beginPath();
    ctx.ellipse(cxF, GROUND_Y - 40, BASE_W / 2 + 12, 88, 0, Math.PI, 2 * Math.PI);
    ctx.stroke();
    // Hexagonal shield tessellation flashes (random hex on the dome)
    const hexHash = Math.floor(performance.now() / 280) % 5;
    const hexPos = [[-22, -28], [18, -34], [-12, -52], [22, -58], [0, -68]][hexHash];
    if (hexPos) {
      ctx.strokeStyle = `rgba(180, 230, 255, 0.55)`;
      ctx.lineWidth = 1;
      const hxx = cxF + hexPos[0], hyy = GROUND_Y + hexPos[1];
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        const px = hxx + Math.cos(a) * 5, py = hyy + Math.sin(a) * 5;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.stroke();
    }

    // Orbiting drone with red eye (slow circular orbit above the spire)
    const oT = performance.now() / 1100;
    const ox = cxF + Math.cos(oT) * 30;
    const oy = GROUND_Y - 102 + Math.sin(oT) * 6;
    ctx.fillStyle = '#2a3454';
    ctx.beginPath(); ctx.ellipse(ox, oy, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#15110c'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#ff5a5a';
    ctx.beginPath(); ctx.arc(ox + Math.cos(oT) * 2, oy, 1.2, 0, Math.PI * 2); ctx.fill();
    // Drone underglow
    ctx.fillStyle = 'rgba(110,196,255,0.3)';
    ctx.beginPath(); ctx.ellipse(ox, oy + 4, 5, 2, 0, 0, Math.PI * 2); ctx.fill();
  }

  function drawTurrets(baseX, slots, facing) {
    // facing: +1 = aim right (player), -1 = aim left (enemy).
    // For the player side, slots beyond playerSlotsOwned render as
    // locked padlocks instead of empty mounts. Enemy keeps full ramp.
    const dir = facing || +1;
    const isPlayer = dir === +1;
    for (let i = 0; i < TURRET_SLOTS; i++) {
      const t = slots[i];
      const x = baseX + 12 + (i + 0.5) * ((BASE_W - 24) / TURRET_SLOTS);
      const y = GROUND_Y - 96;
      if (isPlayer && i >= playerSlotsOwned) {
        // Locked slot: small grey padlock so the player can see "future slot here"
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(x - 5, y, 10, 4);
        ctx.strokeStyle = 'rgba(180,180,180,0.6)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(x, y - 4, 3, Math.PI, 2 * Math.PI);
        ctx.stroke();
        ctx.fillStyle = 'rgba(180,180,180,0.55)';
        ctx.fillRect(x - 3, y - 4, 6, 5);
        continue;
      }
      if (!t) {
        // empty slot: low mount platform with bolt holes
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(x - 6, y, 12, 4);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(x - 5, y - 1, 1, 1);
        ctx.fillRect(x + 4, y - 1, 1, 1);
        continue;
      }
      drawTurretArt(x, y, t, dir);
    }
  }

  // Era-themed mini-turret rendered atop the rampart. The era of the
  // turret is inferred from t.name (matches TURRETS catalog).
  function drawTurretArt(x, y, t, dir) {
    const STR = (w=1.2) => { ctx.strokeStyle = '#15110c'; ctx.lineWidth = w; };
    switch (t.name) {
      case 'Rock Sling': {
        // Wooden tripod with a sling pouch holding a stone, ready to whip.
        // Tripod legs
        STR(1.4); ctx.strokeStyle = '#5a3a18';
        ctx.beginPath();
        ctx.moveTo(x - 6, y + 4); ctx.lineTo(x, y - 6);
        ctx.moveTo(x + 6, y + 4); ctx.lineTo(x, y - 6);
        ctx.moveTo(x, y + 4); ctx.lineTo(x, y - 6);
        ctx.stroke();
        // Pivot head
        ctx.fillStyle = '#3a2010'; ctx.beginPath(); ctx.arc(x, y - 6, 2.5, 0, Math.PI * 2); ctx.fill();
        // Sling arm + stone (cocked back)
        ctx.strokeStyle = '#3a2010'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y - 6);
        ctx.lineTo(x - dir * 6, y - 14);
        ctx.stroke();
        ctx.fillStyle = '#7d8084';
        ctx.beginPath(); ctx.arc(x - dir * 7, y - 15, 2.5, 0, Math.PI * 2); ctx.fill();
        STR(0.8); ctx.stroke();
        break;
      }
      case 'Crossbow': {
        // Wooden trestle with a horizontal crossbow bow + bolt.
        ctx.fillStyle = '#5a3a18'; ctx.fillRect(x - 5, y - 2, 10, 6);
        STR(1); ctx.strokeRect(x - 5, y - 2, 10, 6);
        // Bow arms
        ctx.strokeStyle = '#8a6a36'; ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(x - dir * 9, y - 8);
        ctx.quadraticCurveTo(x + dir * 2, y - 4, x + dir * 9, y - 8);
        ctx.stroke();
        // Bowstring
        ctx.strokeStyle = '#e8e0c0'; ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x - dir * 9, y - 8);
        ctx.lineTo(x + dir * 9, y - 8);
        ctx.stroke();
        // Bolt loaded
        ctx.strokeStyle = '#3a2010'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + dir * 8, y - 6); ctx.stroke();
        ctx.fillStyle = '#9aa0ab';
        ctx.beginPath();
        ctx.moveTo(x + dir * 8, y - 6); ctx.lineTo(x + dir * 11, y - 7); ctx.lineTo(x + dir * 11, y - 5);
        ctx.closePath(); ctx.fill();
        break;
      }
      case 'Cannon Turret': {
        // Iron base block + black cannon barrel angled forward.
        ctx.fillStyle = '#444'; ctx.fillRect(x - 6, y - 4, 12, 8);
        STR(1); ctx.strokeRect(x - 6, y - 4, 12, 8);
        // Wheels
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.arc(x - 6, y + 4, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 6, y + 4, 2.5, 0, Math.PI * 2); ctx.fill();
        // Barrel (slightly tilted up)
        ctx.save();
        ctx.translate(x, y - 4);
        ctx.rotate(-dir * 0.25);
        ctx.fillStyle = '#222';
        ctx.fillRect(0, -2, dir * 12, 4);
        STR(0.8); ctx.strokeRect(Math.min(0, dir * 12), -2, Math.abs(dir * 12), 4);
        // Muzzle reinforcement
        ctx.fillRect(dir * 10, -3, dir * 3, 6);
        ctx.restore();
        break;
      }
      case 'MG Nest': {
        // Sandbag ring + tripod-mounted machine gun + ammo belt.
        // Sandbag base
        ctx.fillStyle = '#8a7a55';
        ctx.beginPath(); ctx.ellipse(x, y + 3, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
        STR(0.8); ctx.stroke();
        // MG body
        ctx.fillStyle = '#3a3a3a';
        ctx.fillRect(x - 4, y - 5, 8, 5);
        STR(0.8); ctx.strokeRect(x - 4, y - 5, 8, 5);
        // Barrel (long, perforated cooling jacket)
        ctx.fillStyle = '#222';
        ctx.fillRect(x, y - 4, dir * 12, 2.5);
        // Cooling jacket vents
        ctx.fillStyle = '#5a5a4a';
        ctx.fillRect(x + dir * 3, y - 4, 1, 2.5);
        ctx.fillRect(x + dir * 6, y - 4, 1, 2.5);
        ctx.fillRect(x + dir * 9, y - 4, 1, 2.5);
        // Ammo belt
        ctx.fillStyle = '#caa84a';
        for (let bi = 0; bi < 3; bi++) {
          ctx.fillRect(x - dir * (2 + bi * 2), y - 1, 1.5, 2);
        }
        break;
      }
      case 'Plasma Turret': {
        // Cyan glowing orb on a glowing pedestal + plasma coil.
        const t = performance.now() / 280;
        const pulse = 0.7 + Math.sin(t) * 0.3;
        // Pedestal
        ctx.fillStyle = '#2a3454';
        ctx.fillRect(x - 5, y - 2, 10, 6);
        STR(0.8); ctx.strokeRect(x - 5, y - 2, 10, 6);
        // Glowing core orb
        const glow = ctx.createRadialGradient(x, y - 8, 1, x, y - 8, 12);
        glow.addColorStop(0, `rgba(180,230,255,${pulse})`);
        glow.addColorStop(0.6, `rgba(110,196,255,${pulse * 0.6})`);
        glow.addColorStop(1, 'rgba(110,196,255,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(x, y - 8, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(110,196,255,${pulse})`;
        ctx.beginPath(); ctx.arc(x, y - 8, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x, y - 8, 1.5, 0, Math.PI * 2); ctx.fill();
        // Plasma emitter barrel
        ctx.fillStyle = '#1d2540';
        ctx.fillRect(x, y - 9, dir * 10, 2);
        ctx.fillStyle = `rgba(110,196,255,${pulse})`;
        ctx.fillRect(x + dir * 9, y - 10, dir * 2, 4);
        break;
      }
      default: {
        // Fallback: simple colored block + emoji icon
        ctx.fillStyle = t.color || '#999';
        ctx.fillRect(x - 6, y - 8, 12, 12);
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(t.icon || '', x, y - 2);
      }
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
  // Bold, cel-shaded humanoid with a dynamic running pose. The pose
  // never changes per frame — it's static — but the silhouette is
  // angular enough that the bob/lean applied at draw time reads as
  // active running. Anatomy anchors:
  //   shoulder ≈ (60, 64), hip ≈ (60, 108), head center ≈ (62, 38).
  // Light comes from the upper-left so all sprites stay consistent.
  function svgHumanoid(cfg, pose) {
    const isStrike = pose === 'strike';
    const isStepB  = pose === 'runB';                // alternate stride frame
    const c = Object.assign({
      skin:'#e0a86b', skinSh:'#b07d44', skinHi:'#f3c690',
      torso:'#6f5a3a', torsoSh:'#3f3220',
      legs:'#3a2818', legsSh:'#1f1408',
      boots:'#150e08', bootCuff:'#3a2818',
      hair:'#2c1c0e',
      accent:'#cccccc', accentSh:'#7e858e', accentHi:'#ebeef2',
      headgear:'none', weapon:'none', cape:null, capeSh:'#000',
      belt:null, beltBuckle:'#caa84a',
      pauldron:null, pauldronTrim:'#caa84a',
      chestEmblem:null, emblemColor:'#caa84a',
      build:'normal',          // 'slim' | 'normal' | 'bulky'
      crest:'#c43838',
    }, cfg);

    const OUT = '#0e0a06';
    const STR = `stroke="${OUT}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"`;
    const sw  = c.build === 'bulky' ? 1.18 : c.build === 'slim' ? 0.86 : 1.0;
    const torsoW = 36 * sw;
    const shoLX = 60 - torsoW/2, shoRX = 60 + torsoW/2;
    const limb = (d, col, w) =>
      `<path d="${d}" fill="none" stroke="${OUT}" stroke-width="${w + 3}" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
    const P = [];

    // --- Cape (behind everything) -----------------------------------
    if (c.cape) {
      P.push(`<path d="M${shoLX+2} 64 C 30 96, 26 134, 32 162 L 60 148 L 70 76 Z"
               fill="${c.cape}" ${STR}/>`);
      P.push(`<path d="M 40 100 L 48 144 L 60 148 L 60 88 Z" fill="${c.capeSh}" opacity="0.35"/>`);
    }

    // --- Back leg ----------------------------------------------------
    // Stride A: lifted (high knee). Stride B: planted (straight, foot back).
    if (!isStepB) {
      P.push(limb('M58 110 Q 48 138, 40 162 L 32 174', c.legsSh, 13));
      P.push(`<path d="M 22 168 L 36 168 L 38 178 L 22 178 Z"
               fill="${c.boots}" ${STR}/>`);
      P.push(`<rect x="22" y="166" width="16" height="3.5" fill="${c.bootCuff}" stroke="${OUT}" stroke-width="2"/>`);
    } else {
      // planted, foot trailing behind
      P.push(limb('M58 110 L 50 156 L 42 184', c.legsSh, 13));
      P.push(`<path d="M 32 184 L 56 184 L 58 192 L 32 192 Z"
               fill="${c.boots}" ${STR}/>`);
      P.push(`<rect x="32" y="180" width="26" height="4" fill="${c.bootCuff}" stroke="${OUT}" stroke-width="2"/>`);
    }

    // --- Back arm: bent, swinging back behind hip --------------------
    P.push(limb(`M${shoLX+6} 70 Q 42 92, 48 110`, c.skinSh, 11));
    P.push(`<circle cx="48" cy="112" r="5" fill="${c.skinSh}" stroke="${OUT}" stroke-width="2.5"/>`);

    // --- Torso (slight forward lean) ---------------------------------
    P.push(`<path d="
      M ${shoLX} 66
      Q 60 58, ${shoRX} 66
      L ${shoRX-4} 112
      Q 60 118, ${shoLX+4} 112 Z
    " fill="${c.torso}" ${STR}/>`);
    // Right-side shadow (light from upper-left)
    P.push(`<path d="
      M 60 62 Q ${shoRX-1} 68, ${shoRX-2} 84
      L ${shoRX-4} 112 L 60 116 Z
    " fill="${OUT}" opacity="0.22"/>`);
    // Upper-left chest highlight
    P.push(`<path d="
      M ${shoLX+3} 70 Q ${60-6} 64, 60 78 L 56 96 L ${shoLX+3} 94 Z
    " fill="#ffffff" opacity="0.10"/>`);

    // --- Belt + buckle -----------------------------------------------
    if (c.belt) {
      P.push(`<rect x="${shoLX+3}" y="106" width="${torsoW-6}" height="8" rx="1"
               fill="${c.belt}" ${STR}/>`);
      P.push(`<rect x="57" y="107" width="7" height="6" fill="${c.beltBuckle}"
               stroke="${OUT}" stroke-width="1.5"/>`);
    }

    // --- Chest emblem -------------------------------------------------
    if (c.chestEmblem === 'cross') {
      P.push(`<rect x="58" y="78" width="5" height="20" fill="${c.emblemColor}" stroke="${OUT}" stroke-width="1.5"/>`);
      P.push(`<rect x="51" y="84" width="19" height="5" fill="${c.emblemColor}" stroke="${OUT}" stroke-width="1.5"/>`);
    } else if (c.chestEmblem === 'core') {
      P.push(`<circle cx="60" cy="88" r="7" fill="${OUT}"/>`);
      P.push(`<circle cx="60" cy="88" r="5.5" fill="#bfeaff"/>`);
      P.push(`<circle cx="58" cy="86" r="2" fill="#ffffff"/>`);
    } else if (c.chestEmblem === 'star') {
      P.push(`<path d="M60 80 L 63 88 L 71 88 L 65 93 L 67 101 L 60 96 L 53 101 L 55 93 L 49 88 L 57 88 Z"
               fill="${c.emblemColor}" stroke="${OUT}" stroke-width="1.5" stroke-linejoin="round"/>`);
    } else if (c.chestEmblem === 'stars4') {
      // Four-star general insignia: 4 small gold stars in a row across the chest
      const star = (cx) => `<path d="M ${cx} 82 L ${cx+1.6} 86 L ${cx+5} 86 L ${cx+2.2} 88.5 L ${cx+3.4} 92 L ${cx} 89.7 L ${cx-3.4} 92 L ${cx-2.2} 88.5 L ${cx-5} 86 L ${cx-1.6} 86 Z"
                              fill="${c.emblemColor}" stroke="${OUT}" stroke-width="0.8" stroke-linejoin="round"/>`;
      P.push(star(52) + star(58) + star(64) + star(70));
      // Two rows of ribbon bars beneath
      P.push(`<rect x="50" y="96" width="6" height="3" fill="#ff5a5a" stroke="${OUT}" stroke-width="0.8"/>`);
      P.push(`<rect x="57" y="96" width="6" height="3" fill="#3aa3ff" stroke="${OUT}" stroke-width="0.8"/>`);
      P.push(`<rect x="64" y="96" width="6" height="3" fill="${c.emblemColor}" stroke="${OUT}" stroke-width="0.8"/>`);
      P.push(`<rect x="50" y="100" width="6" height="3" fill="#3FB950" stroke="${OUT}" stroke-width="0.8"/>`);
      P.push(`<rect x="57" y="100" width="6" height="3" fill="#fcd34d" stroke="${OUT}" stroke-width="0.8"/>`);
      P.push(`<rect x="64" y="100" width="6" height="3" fill="#caa84a" stroke="${OUT}" stroke-width="0.8"/>`);
    }
    // Officer epaulettes (gold shoulder boards) -- opt-in
    if (c.epaulettes) {
      P.push(`<path d="M 44 66 L 60 64 L 58 72 L 44 74 Z" fill="${c.emblemColor || '#caa84a'}" stroke="${OUT}" stroke-width="1.5"/>`);
      P.push(`<path d="M 76 64 L 80 72 L 72 72 L 70 64 Z" fill="${c.emblemColor || '#caa84a'}" stroke="${OUT}" stroke-width="1.5"/>`);
      // Gold fringe
      P.push(`<path d="M 44 74 L 46 78 L 48 74 L 50 78 L 52 74 L 54 78 L 56 74 L 58 78" fill="none" stroke="${c.emblemColor || '#caa84a'}" stroke-width="1.5"/>`);
    }

    // --- Front leg ---------------------------------------------------
    // Stride A: planted forward. Stride B: lifted, high knee.
    if (!isStepB) {
      P.push(limb('M62 110 Q 76 138, 82 168 L 86 180', c.legs, 13));
      P.push(`<path d="M 80 178 L 100 178 L 102 188 L 78 188 Z"
               fill="${c.boots}" ${STR}/>`);
      P.push(`<rect x="78" y="174" width="22" height="4" fill="${c.bootCuff}" stroke="${OUT}" stroke-width="2"/>`);
    } else {
      // lifted forward, knee high
      P.push(limb('M62 110 Q 80 130, 86 150 L 92 162', c.legs, 13));
      P.push(`<path d="M 84 156 L 102 156 L 104 166 L 82 166 Z"
               fill="${c.boots}" ${STR}/>`);
      P.push(`<rect x="82" y="154" width="22" height="3.5" fill="${c.bootCuff}" stroke="${OUT}" stroke-width="2"/>`);
    }

    // --- Neck ---------------------------------------------------------
    P.push(`<path d="M 56 58 L 64 58 L 64 68 L 56 68 Z" fill="${c.skinSh}" stroke="${OUT}" stroke-width="2"/>`);

    // --- Head (slight forward tilt) ----------------------------------
    P.push(`<ellipse cx="62" cy="40" rx="17" ry="19" fill="${c.skin}" ${STR}/>`);
    // shadow on right side of face
    P.push(`<path d="M 62 21 A 17 19 0 0 1 62 59 Z" fill="${OUT}" opacity="0.16"/>`);
    // jaw shadow
    P.push(`<path d="M 50 50 Q 62 60, 76 50 L 76 56 Q 62 64, 50 56 Z" fill="${OUT}" opacity="0.12"/>`);
    // ear hint
    P.push(`<path d="M 47 42 Q 44 42, 45 47 Q 48 46, 48 43 Z" fill="${c.skinSh}" stroke="${OUT}" stroke-width="1.5"/>`);

    // --- Hair under hat (skipped for full-cover headgear) ------------
    if (!['helm', 'visor', 'brodie', 'combat'].includes(c.headgear)) {
      P.push(`<path d="M 45 38 Q 42 14, 62 14 Q 82 14, 80 38 Q 76 24, 62 22 Q 48 24, 45 38 Z"
               fill="${c.hair}" ${STR}/>`);
    }

    // --- Face: eye + brow + mouth ------------------------------------
    if (c.headgear !== 'helm' && c.headgear !== 'visor') {
      P.push(`<ellipse cx="73" cy="40" rx="2.2" ry="3" fill="${OUT}"/>`);
      P.push(`<circle cx="73.5" cy="39" r="0.7" fill="#fff" opacity="0.7"/>`);
      P.push(`<path d="M 69 35 Q 73 33, 77 35" fill="none" stroke="${OUT}" stroke-width="1.8" stroke-linecap="round"/>`);
      P.push(`<path d="M 71 49 Q 75 50, 78 48" fill="none" stroke="${OUT}" stroke-width="1.5" stroke-linecap="round"/>`);
    }

    // --- Headgear -----------------------------------------------------
    P.push(headgearSVG(c, OUT, STR));

    // --- Pauldron (over front shoulder) ------------------------------
    if (c.pauldron) {
      P.push(`<path d="M ${shoLX-4} 64 Q ${shoLX+2} 54, ${shoLX+12} 64 L ${shoLX+12} 80 Q ${shoLX+2} 84, ${shoLX-4} 78 Z"
               fill="${c.pauldron}" ${STR}/>`);
      P.push(`<path d="M ${shoLX-3} 77 Q ${shoLX+3} 82, ${shoLX+12} 78"
               fill="none" stroke="${c.pauldronTrim}" stroke-width="2"/>`);
    }

    // --- Weapon + front arm (always in front) ------------------------
    P.push(weaponSVG(c.weapon, c, OUT, STR, shoRX, isStrike));

    return svgWrap(P.join(''));
  }

  function headgearSVG(c, OUT, STR) {
    switch (c.headgear) {
      case 'helm': {       // medieval great-helm
        const out = [];
        out.push(`<path d="M 44 42 A 18 20 0 0 1 80 42 L 80 50 Q 80 56, 75 58 L 49 58 Q 44 56, 44 50 Z"
                  fill="${c.accent}" ${STR}/>`);
        // T-slit visor
        out.push(`<path d="M 58 38 L 70 38 L 70 42 L 58 42 Z" fill="${OUT}"/>`);
        out.push(`<path d="M 63 42 L 66 42 L 66 50 L 63 50 Z" fill="${OUT}"/>`);
        // rivet line
        out.push(`<path d="M 47 50 L 77 50" fill="none" stroke="${c.accentSh}" stroke-width="1.5"/>`);
        // top plume
        out.push(`<path d="M 62 24 L 70 12 L 64 14 L 68 6 L 60 18 Z" fill="${c.crest}" stroke="${OUT}" stroke-width="1.5"/>`);
        out.push(`<rect x="60" y="20" width="4" height="6" fill="${c.accentHi}" stroke="${OUT}" stroke-width="1.5"/>`);
        return out.join('');
      }
      case 'hood': {        // archer hood
        return `<path d="M 42 42 Q 40 14, 62 14 Q 84 14, 82 42 Q 78 24, 70 24 L 68 38 L 56 38 L 54 24 Q 46 24, 42 42 Z"
                  fill="${c.accent}" ${STR}/>`
             + `<path d="M 60 14 L 56 8 L 66 12 Z" fill="${c.accentSh}" ${STR}/>`;
      }
      case 'brodie': {      // WW1 dish helmet
        return `<path d="M 38 36 A 24 14 0 0 1 84 36 L 80 42 L 42 42 Z"
                  fill="${c.accent}" ${STR}/>`
             + `<ellipse cx="61" cy="35" rx="22" ry="4" fill="${c.accentHi}" opacity="0.7"/>`
             + `<path d="M 40 38 L 84 38" stroke="${c.accentSh}" stroke-width="1.5"/>`;
      }
      case 'combat': {      // modern combat helmet w/ NVGs mount
        const out = [];
        out.push(`<path d="M 42 42 A 20 19 0 0 1 82 40 L 82 48 Q 82 52, 77 52 L 47 52 Q 42 52, 42 48 Z"
                  fill="${c.accent}" ${STR}/>`);
        // NVG mount on forehead
        out.push(`<rect x="58" y="36" width="10" height="4" rx="1" fill="${c.accentSh}" stroke="${OUT}" stroke-width="1.5"/>`);
        // ear cup
        out.push(`<ellipse cx="47" cy="48" rx="5" ry="6" fill="${c.accentSh}" stroke="${OUT}" stroke-width="1.5"/>`);
        // strap
        out.push(`<path d="M 52 52 L 50 60 L 62 62" fill="none" stroke="${OUT}" stroke-width="1.8"/>`);
        return out.join('');
      }
      case 'visor': {       // future visor helmet w/ glowing strip
        const out = [];
        out.push(`<path d="M 42 44 A 19 22 0 0 1 80 42 L 80 56 Q 80 60, 76 60 L 48 60 Q 42 60, 42 56 Z"
                  fill="${c.accent}" ${STR}/>`);
        // glowing visor strip
        out.push(`<path d="M 50 38 L 78 38 L 76 50 L 52 50 Z" fill="${OUT}"/>`);
        out.push(`<path d="M 52 40 L 76 40 L 75 47 L 53 47 Z" fill="#3aa3ff"/>`);
        out.push(`<path d="M 54 41 L 75 41" stroke="#bfeaff" stroke-width="1.6"/>`);
        // antenna
        out.push(`<rect x="60" y="14" width="3" height="10" rx="1" fill="${c.accentSh}" stroke="${OUT}" stroke-width="1.4"/>`);
        out.push(`<circle cx="61.5" cy="13" r="2" fill="#ff6b6b"/>`);
        return out.join('');
      }
      case 'bandana': {     // sniper wrap with trailing tail
        return `<path d="M 44 36 Q 44 26, 62 26 Q 80 26, 80 36 L 80 44 L 44 44 Z"
                  fill="${c.accent}" ${STR}/>`
             + `<path d="M 44 38 L 30 44 L 36 50 L 46 46 Z" fill="${c.accent}" ${STR}/>`
             + `<path d="M 44 40 L 80 40" stroke="${c.accentSh}" stroke-width="1.5"/>`;
      }
      case 'beret': {       // officer's beret with badge -- slanted to the side
        return `<path d="M 44 32 Q 44 18, 62 18 Q 84 18, 86 30 L 84 38 Q 64 42, 44 38 Z"
                  fill="${c.accent}" ${STR}/>`
             // Top crown highlight
             + `<path d="M 48 24 Q 62 20, 80 26" fill="none" stroke="${c.accentHi}" stroke-width="2"/>`
             // Slanted side dip (right side falls lower)
             + `<path d="M 80 28 Q 86 32, 84 38" fill="${c.accent}" ${STR}/>`
             // Headband
             + `<path d="M 44 36 L 84 38" stroke="${c.accentSh}" stroke-width="2"/>`
             // Brass badge (front-left of beret)
             + `<circle cx="56" cy="30" r="3.5" fill="${c.emblemColor || '#caa84a'}" stroke="${OUT}" stroke-width="1.5"/>`
             + `<path d="M 53 30 L 56 27 L 59 30 L 56 33 Z" fill="${OUT}" opacity="0.6"/>`;
      }
      default: return '';
    }
  }

  // Weapons: rendered with the front arm(s) wrapped around them so the
  // grip reads. shoRX is the front shoulder X so arms anchor consistently.
  // When isStrike is true, render the wind-down/strike pose:
  //   - melee: weapon swung forward/down at the target
  //   - ranged: muzzle flash + recoil (shoulder kicked back)
  function weaponSVG(weapon, c, OUT, STR, shoRX, isStrike) {
    const arm = (d, w = 11) =>
      `<path d="${d}" fill="none" stroke="${OUT}" stroke-width="${w + 3}" stroke-linecap="round"/>` +
      `<path d="${d}" fill="none" stroke="${c.skin}" stroke-width="${w}" stroke-linecap="round"/>`;
    const hand = (x, y) =>
      `<circle cx="${x}" cy="${y}" r="5" fill="${c.skinSh}" stroke="${OUT}" stroke-width="2.5"/>`;
    const flash = (x, y, r = 8) => `
      <path d="M ${x-r} ${y} L ${x-r*0.4} ${y-r*0.5} L ${x} ${y-r} L ${x+r*0.4} ${y-r*0.5} L ${x+r*1.4} ${y} L ${x+r*0.4} ${y+r*0.5} L ${x} ${y+r} L ${x-r*0.4} ${y+r*0.5} Z" fill="#ffe48a" stroke="${OUT}" stroke-width="1.5"/>
      <circle cx="${x+r*0.2}" cy="${y}" r="${r*0.45}" fill="#fff8d0"/>
    `;

    switch (weapon) {
      case 'club': {
        if (isStrike) {
          // club crashing down forward
          const a = arm(`M${shoRX-2} 70 Q 92 78, 104 92`);
          const club = `
            <g transform="translate(104 92) rotate(46)">
              <rect x="-4" y="-2" width="8" height="36" rx="3" fill="#7a4e22" ${STR}/>
              <path d="M -10 -4 Q 0 -22, 10 -4 L 8 6 Q 0 0, -8 6 Z" fill="#9a6a32" ${STR}/>
              <circle cx="-3" cy="-8" r="1.5" fill="${OUT}"/>
              <circle cx="3" cy="-6" r="1.5" fill="${OUT}"/>
            </g>
            <path d="M 118 116 L 124 110 M 122 122 L 130 120 M 116 128 L 122 130" stroke="${OUT}" stroke-width="2" stroke-linecap="round"/>`;
          return a + hand(104, 92) + club;
        }
        // run: arm raised, club arcing back over shoulder
        const a = arm(`M${shoRX-2} 70 Q 80 56, 92 42`);
        const club = `
          <g transform="translate(92 42) rotate(-26)">
            <rect x="-4" y="-2" width="8" height="36" rx="3" fill="#7a4e22" ${STR}/>
            <path d="M -10 -4 Q 0 -22, 10 -4 L 8 6 Q 0 0, -8 6 Z" fill="#9a6a32" ${STR}/>
            <circle cx="-3" cy="-8" r="1.5" fill="${OUT}"/>
            <circle cx="3" cy="-6" r="1.5" fill="${OUT}"/>
          </g>`;
        return a + hand(92, 42) + club;
      }
      case 'sling': {
        if (isStrike) {
          // mid-release: stone flung forward, sling cords trail back
          const a = arm(`M${shoRX-2} 70 Q 92 60, 106 56`);
          return a + hand(106, 58) + `
            <path d="M 106 58 Q 96 76, 90 88" fill="none" stroke="#5a3a1a" stroke-width="2.5"/>
            <path d="M 106 58 Q 100 80, 96 92" fill="none" stroke="#5a3a1a" stroke-width="2.5"/>
            <circle cx="120" cy="56" r="4.5" fill="#888" ${STR}/>
            <path d="M 116 56 L 100 56" stroke="${OUT}" stroke-width="1.2" stroke-dasharray="2 2" opacity="0.6"/>`;
        }
        const a = arm(`M${shoRX-2} 70 Q 86 50, 92 32`);
        return a + hand(92, 34) + `
          <path d="M 92 34 Q 104 50, 96 70" fill="none" stroke="#5a3a1a" stroke-width="2.5"/>
          <path d="M 92 34 Q 80 50, 88 70" fill="none" stroke="#5a3a1a" stroke-width="2.5"/>
          <circle cx="92" cy="72" r="5" fill="#6a6a6a" ${STR}/>`;
      }
      case 'sword': {
        if (isStrike) {
          // slash follow-through: sword swung forward + down
          const a = arm(`M${shoRX-2} 70 Q 92 80, 110 90`);
          const sword = `
            <g transform="translate(110 90) rotate(54)">
              <rect x="-7" y="0" width="14" height="4" fill="#caa84a" stroke="${OUT}" stroke-width="1.8"/>
              <rect x="-1.5" y="3" width="3" height="7" fill="#7a4e22" stroke="${OUT}" stroke-width="1.4"/>
              <path d="M -3 0 L 3 0 L 2.2 -48 L 0 -54 L -2.2 -48 Z" fill="#e6eaf0" ${STR}/>
              <path d="M -1 0 L -1 -46" stroke="#9098a2" stroke-width="1.4"/>
            </g>
            <path d="M 80 84 Q 100 72, 124 64" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.6"/>`;
          return a + hand(110, 90) + sword;
        }
        const a = arm(`M${shoRX-2} 70 Q 84 54, 96 40`);
        const sword = `
          <g transform="translate(96 40) rotate(-24)">
            <rect x="-7" y="0" width="14" height="4" fill="#caa84a" stroke="${OUT}" stroke-width="1.8"/>
            <rect x="-1.5" y="3" width="3" height="7" fill="#7a4e22" stroke="${OUT}" stroke-width="1.4"/>
            <path d="M -3 0 L 3 0 L 2.2 -48 L 0 -54 L -2.2 -48 Z" fill="#e6eaf0" ${STR}/>
            <path d="M -1 0 L -1 -46" stroke="#9098a2" stroke-width="1.4"/>
          </g>`;
        return a + hand(96, 42) + sword;
      }
      case 'bow': {
        if (isStrike) {
          // loosed: string flat across, arm extended
          const a = arm(`M${shoRX-2} 72 Q 88 78, 104 80`);
          return a + `
            <path d="M 106 50 Q 120 78, 106 106" fill="none" stroke="${OUT}" stroke-width="5"/>
            <path d="M 106 50 Q 117 78, 106 106" fill="none" stroke="#6a3a1a" stroke-width="3"/>
            <path d="M 106 50 L 106 106" stroke="#e8e0c0" stroke-width="1.5"/>
            <path d="M 106 78 L 130 78" stroke="#3a2210" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M 130 78 L 136 76 L 130 80 Z" fill="#3a2210"/>
            ${hand(104, 80)}`;
        }
        const a = arm(`M${shoRX-2} 72 Q 88 78, 100 78`);
        return a + `
          <path d="M 102 50 Q 116 78, 102 106" fill="none" stroke="${OUT}" stroke-width="5"/>
          <path d="M 102 50 Q 113 78, 102 106" fill="none" stroke="#6a3a1a" stroke-width="3"/>
          <path d="M 102 50 L 92 78 L 102 106" fill="none" stroke="#e8e0c0" stroke-width="1.5"/>
          <path d="M 76 76 L 110 78" stroke="#3a2210" stroke-width="2.5" stroke-linecap="round"/>
          <path d="M 110 78 L 116 76 L 110 80 Z" fill="#3a2210"/>
          ${hand(100, 78)}
          ${arm('M52 72 Q 70 80, 90 80', 9)}`;
      }
      case 'rifle': {
        if (isStrike) {
          // recoil: shoulder kicked back, muzzle flash
          const a = arm(`M${shoRX-2} 70 Q 78 76, 96 80`);
          return a + arm(`M 50 78 Q 62 82, 76 86`, 9) + `
            <g transform="translate(64 84) rotate(-6)">
              <rect x="0" y="-3" width="50" height="6" rx="1.5" fill="#222" ${STR}/>
              <rect x="-8" y="-1" width="14" height="8" rx="1.5" fill="#5a3a1a" ${STR}/>
              <rect x="20" y="-6" width="8" height="4" rx="1" fill="#333" stroke="${OUT}" stroke-width="1.2"/>
            </g>
            ${flash(118, 78, 9)}
            <path d="M 116 70 Q 122 64, 130 62" stroke="#fff" stroke-width="1.5" opacity="0.6"/>` +
            hand(96, 82) + hand(76, 86);
        }
        const a = arm(`M${shoRX-2} 72 Q 80 80, 98 84`);
        return a + arm(`M 50 78 Q 64 86, 78 88`, 9) + `
          <g transform="translate(64 86)">
            <rect x="0" y="-3" width="50" height="6" rx="1.5" fill="#222" ${STR}/>
            <rect x="46" y="-1.5" width="10" height="3" rx="1" fill="#111"/>
            <rect x="-8" y="-1" width="14" height="8" rx="1.5" fill="#5a3a1a" ${STR}/>
            <rect x="20" y="-6" width="8" height="4" rx="1" fill="#333" stroke="${OUT}" stroke-width="1.2"/>
          </g>` + hand(98, 86) + hand(78, 88);
      }
      case 'cannon': {
        if (isStrike) {
          // big boom: ringed muzzle blast, shoulder rocks back
          const a = arm(`M${shoRX-2} 72 Q 78 60, 88 56`);
          return a + `
            <g transform="translate(78 62) rotate(-12)">
              <rect x="0" y="-10" width="48" height="20" rx="5" fill="#2a2a2a" ${STR}/>
              <rect x="44" y="-12" width="8" height="24" rx="2" fill="#181818" stroke="${OUT}" stroke-width="2"/>
              <rect x="6" y="-3" width="12" height="3" fill="#caa84a" stroke="${OUT}" stroke-width="1.2"/>
            </g>
            ${flash(132, 50, 14)}
            <circle cx="138" cy="50" r="20" fill="none" stroke="#ffd28a" stroke-width="2.5" opacity="0.6"/>
            <path d="M 96 38 L 90 30 M 104 30 L 102 22 M 90 56 L 76 56" stroke="#ffd28a" stroke-width="2" opacity="0.6"/>` +
            hand(88, 58);
        }
        const a = arm(`M${shoRX-2} 72 Q 80 64, 92 60`);
        return a + `
          <g transform="translate(80 64) rotate(-8)">
            <rect x="0" y="-10" width="48" height="20" rx="5" fill="#2a2a2a" ${STR}/>
            <rect x="44" y="-12" width="8" height="24" rx="2" fill="#181818" stroke="${OUT}" stroke-width="2"/>
            <rect x="6" y="-3" width="12" height="3" fill="#caa84a" stroke="${OUT}" stroke-width="1.2"/>
            <circle cx="14" cy="8" r="3" fill="#caa84a" stroke="${OUT}" stroke-width="1.2"/>
          </g>` + hand(92, 60);
      }
      case 'sniper': {
        if (isStrike) {
          // sharp recoil + small flash at the muzzle
          const a = arm(`M${shoRX-2} 70 Q 84 74, 94 78`);
          return a + arm(`M 50 76 Q 62 80, 78 82`, 9) + `
            <g transform="translate(64 80) rotate(-4)">
              <rect x="0" y="-2.5" width="64" height="5" rx="1" fill="#2a261a" ${STR}/>
              <rect x="-8" y="-1" width="14" height="7" rx="1.5" fill="#3a2410" ${STR}/>
              <rect x="22" y="-9" width="18" height="7" rx="2" fill="#15110c" stroke="${OUT}" stroke-width="1.5"/>
              <circle cx="40" cy="-5.5" r="2" fill="#3aa3ff"/>
            </g>
            ${flash(132, 76, 7)}` +
            hand(94, 80) + hand(78, 82);
        }
        const a = arm(`M${shoRX-2} 72 Q 84 78, 96 82`);
        return a + arm(`M 50 76 Q 64 84, 80 86`, 9) + `
          <g transform="translate(64 84)">
            <rect x="0" y="-2.5" width="64" height="5" rx="1" fill="#2a261a" ${STR}/>
            <rect x="-8" y="-1" width="14" height="7" rx="1.5" fill="#3a2410" ${STR}/>
            <rect x="22" y="-9" width="18" height="7" rx="2" fill="#15110c" stroke="${OUT}" stroke-width="1.5"/>
            <circle cx="40" cy="-5.5" r="2" fill="#3aa3ff"/>
            <rect x="60" y="-3.5" width="6" height="2" fill="#444"/>
          </g>` + hand(96, 84) + hand(80, 86);
      }
      case 'laser': {
        if (isStrike) {
          // beam discharge: glowing barrel, cyan blast forward
          const a = arm(`M${shoRX-2} 70 Q 80 76, 96 80`);
          return a + arm(`M 50 78 Q 62 82, 76 86`, 9) + `
            <g transform="translate(62 82) rotate(-4)">
              <rect x="0" y="-5" width="46" height="11" rx="5" fill="#2a3550" ${STR}/>
              <rect x="36" y="-3" width="14" height="5" rx="2" fill="#bfeaff"/>
              <circle cx="48" cy="0" r="5" fill="#bfeaff"/>
              <circle cx="48" cy="0" r="2.5" fill="#fff"/>
              <rect x="-6" y="-1" width="10" height="8" rx="2" fill="#3a4a78" ${STR}/>
            </g>
            <rect x="110" y="78" width="36" height="6" rx="3" fill="#bfeaff" opacity="0.85"/>
            <rect x="110" y="79.5" width="36" height="3" rx="1.5" fill="#ffffff"/>` +
            hand(96, 82) + hand(76, 86);
        }
        const a = arm(`M${shoRX-2} 72 Q 80 80, 96 84`);
        return a + arm(`M 50 78 Q 64 86, 76 88`, 9) + `
          <g transform="translate(62 84)">
            <rect x="0" y="-5" width="46" height="11" rx="5" fill="#2a3550" ${STR}/>
            <rect x="0" y="-5" width="46" height="3" fill="#5a6a90"/>
            <rect x="36" y="-3" width="14" height="5" rx="2" fill="#3aa3ff"/>
            <circle cx="48" cy="0" r="3.5" fill="#bfeaff"/>
            <circle cx="48" cy="0" r="1.5" fill="#fff"/>
            <rect x="-6" y="-1" width="10" height="8" rx="2" fill="#3a4a78" ${STR}/>
            <rect x="14" y="-9" width="6" height="5" rx="1" fill="#3aa3ff"/>
          </g>` + hand(96, 86) + hand(76, 88);
      }
      default: return arm(`M${shoRX-2} 72 Q 78 96, 76 110`);
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
    // Raptor profile: rear haunch high, neck arched forward, mouth open.
    // Layout: tail at left, back legs ~x=70-95, body bulk ~x=80-150,
    // neck ~x=150-180, head jutting forward at x=180-210.
    return svgWrapVB(220, 170, `
      <!-- Tail base + tip -->
      <path d="M 10 120 Q 36 96, 78 100 L 80 120 Q 40 132, 10 130 Z" fill="#3f6831" ${Ob}/>
      <path d="M 80 100 Q 64 108, 56 116" fill="none" stroke="#2c4a22" stroke-width="2.5"/>

      <!-- Back haunch (big & rounded — raptor power) -->
      <path d="M 60 120 Q 50 80, 84 78 Q 110 80, 110 120 Z" fill="#56894a" ${Ob}/>
      <path d="M 96 88 Q 100 100, 96 116" fill="none" stroke="#2c4a22" stroke-width="2"/>

      <!-- Back leg (planted) -->
      <path d="M 86 118 Q 78 138, 72 156 L 60 162" fill="none" stroke="${OUTC}" stroke-width="14" stroke-linecap="round"/>
      <path d="M 86 118 Q 78 138, 72 156 L 60 162" fill="none" stroke="#3f6831" stroke-width="11" stroke-linecap="round"/>
      <path d="M 54 158 L 76 158 L 78 168 L 54 168 Z" fill="#2c4a22" ${Ob}/>
      <!-- Toe claws -->
      <path d="M 54 168 L 50 172 M 60 168 L 58 173 M 70 168 L 70 173" stroke="${OUTC}" stroke-width="2" stroke-linecap="round"/>

      <!-- Front leg (lifted, sprinting) -->
      <path d="M 116 120 Q 122 136, 116 150 L 124 158" fill="none" stroke="${OUTC}" stroke-width="13" stroke-linecap="round"/>
      <path d="M 116 120 Q 122 136, 116 150 L 124 158" fill="none" stroke="#4d7a3c" stroke-width="10" stroke-linecap="round"/>
      <path d="M 118 154 L 138 154 L 140 162 L 118 162 Z" fill="#2c4a22" ${Ob}/>
      <path d="M 120 162 L 118 167 M 128 162 L 128 167 M 136 162 L 138 167" stroke="${OUTC}" stroke-width="2" stroke-linecap="round"/>

      <!-- Body (chest pushed forward) -->
      <path d="M 60 100 Q 80 70, 130 78 Q 158 84, 156 116 Q 100 122, 64 118 Z" fill="#4d7a3c" ${Ob}/>
      <path d="M 80 110 Q 110 116, 150 112" fill="none" stroke="#2c4a22" stroke-width="2"/>
      <!-- Belly shadow -->
      <path d="M 76 118 Q 110 120, 150 114 L 148 118 Q 100 124, 78 122 Z" fill="${OUTC}" opacity="0.25"/>

      <!-- Neck arching forward -->
      <path d="M 140 80 Q 168 60, 188 70 Q 196 80, 184 92 Q 158 88, 142 100 Z" fill="#56894a" ${Ob}/>

      <!-- Head (raptor profile: long snout, jaw line) -->
      <path d="M 180 64 Q 210 60, 214 78 Q 212 88, 200 92 L 192 92 L 188 86 Q 182 86, 178 80 Z" fill="#56894a" ${Ob}/>
      <!-- Open mouth + teeth -->
      <path d="M 192 86 L 212 80 L 214 84 L 208 88 L 200 92 L 192 92 Z" fill="#2a1a10" ${Ob}/>
      <path d="M 194 86 L 196 92 M 200 86 L 202 92 M 206 84 L 208 90" stroke="#fff" stroke-width="1.8"/>
      <!-- Eye -->
      <circle cx="200" cy="74" r="3" fill="${OUTC}"/>
      <circle cx="200" cy="73" r="1" fill="#ff5a00"/>
      <!-- Nostril -->
      <circle cx="210" cy="74" r="1" fill="${OUTC}"/>
      <!-- Head spines / feather tuft -->
      <path d="M 178 62 L 174 50 L 184 60 L 186 48 L 192 62 Z" fill="#3f6831" ${Ob}/>

      <!-- Saddle -->
      <path d="M 90 78 Q 120 70, 144 78 L 140 88 L 96 86 Z" fill="#7a4e22" ${Ob}/>

      <!-- Rider torso -->
      <path d="M 102 50 Q 122 44, 130 52 L 132 78 Q 116 82, 100 78 Z" fill="#a87f56" ${Ob}/>
      <path d="M 120 50 L 124 78" stroke="${OUTC}" stroke-width="1.5" opacity="0.4"/>
      <!-- Rider head -->
      <ellipse cx="124" cy="36" rx="11" ry="13" fill="#d99a63" ${Ob}/>
      <path d="M 113 30 Q 116 16, 128 16 Q 138 18, 136 32 Q 132 22, 124 22 Q 116 22, 113 30 Z" fill="#2c1c0e" ${Ob}/>
      <circle cx="130" cy="36" r="1.8" fill="${OUTC}"/>
      <!-- Rider arm with spear -->
      <path d="M 108 56 Q 92 50, 80 38" fill="none" stroke="${OUTC}" stroke-width="13" stroke-linecap="round"/>
      <path d="M 108 56 Q 92 50, 80 38" fill="none" stroke="#d99a63" stroke-width="10" stroke-linecap="round"/>
      <path d="M 60 18 L 96 50" stroke="#5a3a18" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M 58 14 L 70 22 L 64 24 Z" fill="#9098a2" ${Ob}/>
    `);
  }

  function svgHorse() {  // armored warhorse + plate-mail lancer
    // Charging right. Layout: tail at left, hind quarters x=40-90,
    // belly x=70-150, chest x=130-180, neck rising x=160-200,
    // head jutting forward at x=200-230. Rider centered over saddle.
    return svgWrapVB(240, 200, `
      <!-- Tail flowing back -->
      <path d="M 14 110 Q 32 102, 60 110 L 58 130 Q 32 132, 12 128 Z" fill="#3a2a18" ${Ob}/>
      <path d="M 18 116 Q 30 116, 50 122" fill="none" stroke="#1c1208" stroke-width="2"/>

      <!-- Hind leg back -->
      <path d="M 70 130 Q 56 156, 50 184 L 40 192" fill="none" stroke="${OUTC}" stroke-width="15" stroke-linecap="round"/>
      <path d="M 70 130 Q 56 156, 50 184 L 40 192" fill="none" stroke="#5a3a1f" stroke-width="12" stroke-linecap="round"/>
      <path d="M 32 188 L 56 188 L 58 196 L 32 196 Z" fill="#1c1208" ${Ob}/>

      <!-- Hind leg forward (mid-stride lift) -->
      <path d="M 102 132 Q 98 148, 108 172 L 116 180" fill="none" stroke="${OUTC}" stroke-width="15" stroke-linecap="round"/>
      <path d="M 102 132 Q 98 148, 108 172 L 116 180" fill="none" stroke="#6a4626" stroke-width="12" stroke-linecap="round"/>
      <path d="M 108 178 L 132 178 L 134 188 L 108 188 Z" fill="#1c1208" ${Ob}/>

      <!-- Body (chest pushed forward, rear muscled) -->
      <path d="M 50 96 Q 80 60, 140 70 Q 180 76, 184 116 Q 130 130, 70 122 Q 40 118, 50 96 Z" fill="#7a5230" ${Ob}/>
      <!-- Belly highlight -->
      <path d="M 60 108 Q 100 120, 170 116 L 168 124 Q 110 128, 60 118 Z" fill="${OUTC}" opacity="0.22"/>

      <!-- Red caparison / barding draped over body -->
      <path d="M 56 112 Q 100 130, 178 118 L 174 156 L 60 148 Z" fill="#b53030" ${Ob}/>
      <path d="M 64 144 L 76 156 L 88 144 L 100 156 L 112 144 L 124 156 L 136 144 L 148 156 L 160 144 L 172 156" fill="none" stroke="${OUTC}" stroke-width="2"/>
      <path d="M 56 116 Q 100 132, 178 122" fill="none" stroke="#8a1a1a" stroke-width="2"/>
      <!-- Gold trim on barding -->
      <path d="M 60 116 Q 100 134, 180 122" fill="none" stroke="#fcd34d" stroke-width="2"/>

      <!-- Front leg planted -->
      <path d="M 160 122 L 162 168 L 166 188" fill="none" stroke="${OUTC}" stroke-width="14" stroke-linecap="round"/>
      <path d="M 160 122 L 162 168 L 166 188" fill="none" stroke="#5a3a1f" stroke-width="11" stroke-linecap="round"/>
      <path d="M 158 188 L 182 188 L 184 196 L 158 196 Z" fill="#1c1208" ${Ob}/>

      <!-- Front leg lifted high (charging) -->
      <path d="M 182 120 Q 196 138, 190 156 L 196 168" fill="none" stroke="${OUTC}" stroke-width="14" stroke-linecap="round"/>
      <path d="M 182 120 Q 196 138, 190 156 L 196 168" fill="none" stroke="#6a4626" stroke-width="11" stroke-linecap="round"/>
      <path d="M 188 166 L 208 166 L 210 174 L 188 174 Z" fill="#1c1208" ${Ob}/>

      <!-- Neck arching forward + up -->
      <path d="M 158 78 Q 180 50, 206 56 Q 216 70, 200 86 Q 178 84, 162 96 Z" fill="#7a5230" ${Ob}/>
      <!-- Neck mane -->
      <path d="M 168 72 L 174 60 L 178 72 L 182 60 L 186 72 L 190 60 L 194 70" fill="none" stroke="#3a2818" stroke-width="3.5" stroke-linecap="round"/>

      <!-- Head (long elegant) -->
      <path d="M 196 56 Q 226 56, 230 76 Q 228 86, 218 90 L 210 92 L 204 86 L 198 82 Q 192 76, 196 56 Z" fill="#7a5230" ${Ob}/>
      <!-- Chamfron (face plate) -->
      <path d="M 196 60 Q 224 60, 228 76 L 224 80 L 210 84 L 198 78 Z" fill="#9aa0ab" ${Ob}/>
      <path d="M 212 60 L 214 50 L 218 62" fill="#fcd34d" stroke="${OUTC}" stroke-width="1.5"/>
      <!-- Eye -->
      <circle cx="218" cy="74" r="2" fill="${OUTC}"/>
      <!-- Mouth + nostril -->
      <path d="M 218 88 L 226 86" stroke="${OUTC}" stroke-width="2" stroke-linecap="round"/>
      <circle cx="223" cy="82" r="1" fill="${OUTC}"/>
      <!-- Forelock -->
      <path d="M 198 50 L 200 38 L 204 50" fill="#3a2818" ${Ob}/>

      <!-- Saddle base under rider -->
      <path d="M 90 70 Q 130 60, 158 72 L 154 88 L 92 86 Z" fill="#5a3018" ${Ob}/>

      <!-- Rider legs (one each side of horse) -->
      <path d="M 96 68 L 88 100 L 80 124" fill="none" stroke="${OUTC}" stroke-width="13" stroke-linecap="round"/>
      <path d="M 96 68 L 88 100 L 80 124" fill="none" stroke="#3a3a48" stroke-width="10" stroke-linecap="round"/>
      <rect x="72" y="120" width="14" height="10" rx="2" fill="#1c1c24" stroke="${OUTC}" stroke-width="2"/>

      <!-- Rider torso (plate mail) -->
      <path d="M 96 30 Q 130 24, 142 32 L 146 70 Q 120 78, 92 72 Z" fill="#c2c8d0" ${Ob}/>
      <!-- Plate shading -->
      <path d="M 118 30 Q 130 28, 142 32 L 146 70 Q 130 74, 122 75 Z" fill="${OUTC}" opacity="0.22"/>
      <!-- Plate seam lines -->
      <path d="M 100 46 Q 122 50, 144 46" fill="none" stroke="${OUTC}" stroke-width="1.5"/>
      <path d="M 100 58 Q 122 62, 144 58" fill="none" stroke="${OUTC}" stroke-width="1.5"/>
      <!-- Gold cross emblem on chest -->
      <rect x="118" y="42" width="4" height="22" fill="#fcd34d" stroke="${OUTC}" stroke-width="1.2"/>
      <rect x="110" y="48" width="20" height="4" fill="#fcd34d" stroke="${OUTC}" stroke-width="1.2"/>

      <!-- Pauldron (over shoulder facing camera) -->
      <path d="M 88 26 Q 96 16, 110 24 L 110 44 Q 96 48, 86 42 Z" fill="#c2c8d0" ${Ob}/>
      <path d="M 88 26 Q 102 22, 110 30" fill="none" stroke="#fcd34d" stroke-width="2"/>

      <!-- Helm (great-helm with plume) -->
      <path d="M 102 -2 Q 124 -2, 134 12 L 134 30 Q 134 36, 128 38 L 108 38 Q 102 36, 102 30 Z" fill="#c2c8d0" ${Ob}/>
      <!-- Visor slit -->
      <rect x="108" y="14" width="22" height="4" fill="${OUTC}"/>
      <rect x="116" y="18" width="4" height="14" fill="${OUTC}"/>
      <!-- Rivets -->
      <path d="M 106 24 L 130 24" stroke="#7e858e" stroke-width="1.4"/>
      <!-- Crest plume -->
      <path d="M 118 -4 L 132 -22 L 124 -16 L 138 -28 L 122 -10 L 134 -14 L 118 0 Z" fill="#c43030" ${Ob}/>

      <!-- Couched lance (long, gold tip, pennant) -->
      <path d="M 110 48 L 244 -10" fill="none" stroke="#5a3a18" stroke-width="6" stroke-linecap="round"/>
      <path d="M 110 48 L 244 -10" fill="none" stroke="#8a5a2a" stroke-width="3" stroke-linecap="round"/>
      <!-- Lance head -->
      <path d="M 238 -8 L 250 -16 L 244 -2 Z" fill="#dfe4e8" ${Ob}/>
      <!-- Pennant flag -->
      <path d="M 220 0 L 232 -4 L 226 8 L 230 18 L 214 14 Z" fill="#c43030" ${Ob}/>
      <path d="M 220 4 L 226 0 L 224 8 Z" fill="#fcd34d"/>

      <!-- Rider hand on lance -->
      <circle cx="110" cy="48" r="5" fill="#3a3a48" stroke="${OUTC}" stroke-width="2"/>

      <!-- Shield arm + heater shield -->
      <path d="M 140 38 Q 156 42, 168 40 L 168 92 Q 152 100, 140 88 Z" fill="#c2c8d0" ${Ob}/>
      <path d="M 154 50 L 154 72" stroke="${OUTC}" stroke-width="2"/>
      <path d="M 144 50 L 164 50" stroke="${OUTC}" stroke-width="2"/>
      <!-- Shield emblem -->
      <path d="M 154 56 L 158 68 L 154 78 L 150 68 Z" fill="#c43030" ${Ob}/>
    `);
  }

  function svgMammoth() {  // hero: woolly mammoth + chieftain (faces right)
    // Big shaggy stone-age boss beast. Head/trunk/tusks on the right;
    // chieftain rides atop a fur saddle with a spear raised high.
    return svgWrapVB(220, 220, `
      <g transform="translate(0 30)">
      <!-- Tail (left) with fur tuft -->
      <path d="M 12 96 Q 0 104, 6 118 L 10 116 Q 14 110, 16 102 Z" fill="#3a2010" ${Ob}/>
      <g stroke="#15110c" stroke-width="2" stroke-linecap="round">
        <path d="M 8 116 L 4 122"/>
        <path d="M 12 118 L 10 126"/>
      </g>

      <!-- Back legs (chunky) -->
      <path d="M 36 124 L 30 162 L 28 178 L 56 178 L 58 162 L 56 124 Z" fill="#3a2010" ${Ob}/>
      <path d="M 30 178 L 56 178 L 58 188 L 28 188 Z" fill="#15110c" ${Ob}/>
      <!-- Fur skirts on back legs -->
      <path d="M 32 154 L 28 160 L 34 160 L 32 168 L 38 164 L 40 172 L 46 162 L 48 170 L 54 158 L 56 168 L 60 156" fill="none" stroke="#15110c" stroke-width="2"/>

      <!-- Front legs (slightly forward) -->
      <path d="M 130 130 L 128 162 L 126 178 L 154 178 L 156 162 L 152 130 Z" fill="#4a2818" ${Ob}/>
      <path d="M 128 178 L 154 178 L 156 188 L 126 188 Z" fill="#15110c" ${Ob}/>
      <path d="M 130 154 L 126 160 L 132 160 L 130 168 L 138 162 L 140 172 L 146 162 L 148 170 L 154 158 L 156 168" fill="none" stroke="#15110c" stroke-width="2"/>

      <!-- Belly + body bulk (big shaggy form) -->
      <path d="M 28 94 Q 40 56, 110 56 Q 174 56, 178 100 Q 180 132, 144 138 L 38 138 Q 18 132, 28 94 Z" fill="#6a3a1c" ${Ob}/>
      <!-- Body fur strokes layered -->
      <g stroke="#3a2010" stroke-width="3" stroke-linecap="round">
        <path d="M 36 88 L 32 96"/>
        <path d="M 52 78 L 48 88"/>
        <path d="M 70 72 L 66 84"/>
        <path d="M 92 70 L 88 82"/>
        <path d="M 114 70 L 110 82"/>
        <path d="M 134 74 L 130 86"/>
        <path d="M 152 80 L 148 92"/>
      </g>
      <!-- Belly fur dangling -->
      <path d="M 40 130 L 36 140 L 44 136 L 48 144 L 56 134 L 60 142 L 68 134 L 74 142 L 82 134 L 88 144 L 96 134 L 104 142 L 112 134 L 120 144 L 128 134 L 134 142 L 142 134" fill="none" stroke="#15110c" stroke-width="2"/>
      <!-- Upper body highlight (light from upper left) -->
      <path d="M 40 80 Q 96 64, 158 78" fill="none" stroke="#8a5a32" stroke-width="3"/>
      <!-- Right-side shadow -->
      <path d="M 110 64 Q 174 60, 178 100 Q 180 132, 144 138 L 120 138 Z" fill="${OUTC}" opacity="0.22"/>

      <!-- Head + dome (right side) -->
      <path d="M 154 70 Q 198 70, 200 110 Q 198 132, 172 134 L 152 134 Q 144 110, 154 70 Z" fill="#6a3a1c" ${Ob}/>
      <!-- Forehead bump highlight -->
      <path d="M 168 76 Q 188 78, 196 92" fill="none" stroke="#8a5a32" stroke-width="3"/>

      <!-- Trunk (curling forward) -->
      <path d="M 178 116 Q 208 124, 212 148 Q 210 168, 196 168 Q 194 156, 200 148 Q 196 138, 184 138 Z" fill="#6a3a1c" ${Ob}/>
      <!-- Trunk fur strokes -->
      <g stroke="#3a2010" stroke-width="2">
        <path d="M 184 124 L 188 130"/>
        <path d="M 190 130 L 194 136"/>
        <path d="M 198 136 L 202 142"/>
        <path d="M 204 144 L 206 150"/>
        <path d="M 202 156 L 206 160"/>
      </g>

      <!-- Tusks (big curving) -->
      <path d="M 170 132 Q 180 162, 198 168 Q 192 162, 188 154 Q 178 138, 172 132 Z" fill="#f3e6c0" ${Ob}/>
      <path d="M 174 134 Q 184 162, 196 168" fill="none" stroke="#caa84a" stroke-width="1.5"/>
      <path d="M 158 134 Q 162 152, 176 162 Q 170 158, 166 152 Q 158 142, 156 134 Z" fill="#f3e6c0" ${Ob}/>

      <!-- Eye + brow -->
      <circle cx="180" cy="100" r="3" fill="${OUTC}"/>
      <circle cx="180" cy="100" r="1" fill="#fff"/>
      <path d="M 174 90 Q 184 86, 188 92" fill="none" stroke="${OUTC}" stroke-width="2.5"/>

      <!-- Ear -->
      <path d="M 150 78 Q 138 70, 132 82 Q 138 94, 154 90 Z" fill="#3a2010" ${Ob}/>

      <!-- Saddle (between bumps) -->
      <path d="M 60 60 Q 100 50, 132 62 L 128 76 Q 96 80, 64 74 Z" fill="#3a2010" ${Ob}/>
      <path d="M 64 64 L 128 66" stroke="#caa84a" stroke-width="1.5"/>

      <!-- Chieftain rider: torso -->
      <path d="M 80 28 Q 102 22, 110 28 L 112 60 Q 90 64, 78 58 Z" fill="#8a5a2a" ${Ob}/>
      <path d="M 78 32 L 112 32" stroke="${OUTC}" stroke-width="1.5"/>
      <!-- Fur shoulder pelt -->
      <path d="M 76 30 Q 90 22, 116 28 L 116 42 Q 92 44, 78 42 Z" fill="#cdb480" ${Ob}/>
      <path d="M 78 38 L 82 44 L 86 38 L 90 44 L 96 38 L 102 44 L 108 38 L 114 44" fill="none" stroke="${OUTC}" stroke-width="1.5"/>
      <!-- Rider legs straddling -->
      <path d="M 76 56 L 70 70" stroke="${OUTC}" stroke-width="9" stroke-linecap="round"/>
      <path d="M 76 56 L 70 70" stroke="#5a3a18" stroke-width="6" stroke-linecap="round"/>
      <path d="M 114 56 L 122 70" stroke="${OUTC}" stroke-width="9" stroke-linecap="round"/>
      <path d="M 114 56 L 122 70" stroke="#5a3a18" stroke-width="6" stroke-linecap="round"/>

      <!-- Rider head -->
      <ellipse cx="96" cy="14" rx="11" ry="13" fill="#d99a63" ${Ob}/>
      <path d="M 96 1 A 11 13 0 0 1 96 27 Z" fill="${OUTC}" opacity="0.15"/>
      <!-- Beard -->
      <path d="M 88 18 Q 96 28, 104 18 L 102 26 Q 96 30, 90 26 Z" fill="#2c1c0e" ${Ob}/>
      <!-- Eyes -->
      <circle cx="92" cy="13" r="1.4" fill="${OUTC}"/>
      <circle cx="100" cy="13" r="1.4" fill="${OUTC}"/>
      <!-- Headdress: feather strap -->
      <path d="M 84 4 L 108 4 L 108 8 L 84 8 Z" fill="#5a3a18" ${Ob}/>
      <!-- Feathers -->
      <path d="M 88 4 L 84 -10 L 90 -2 Z" fill="#ff5a5a" ${Ob}/>
      <path d="M 96 4 L 94 -14 L 100 -4 Z" fill="#cdb480" ${Ob}/>
      <path d="M 104 4 L 108 -10 L 106 -2 Z" fill="#7ec8ff" ${Ob}/>

      <!-- Raised spear (held high) -->
      <path d="M 72 38 L 40 -10" stroke="#5a3a18" stroke-width="4.5" stroke-linecap="round"/>
      <path d="M 72 38 L 40 -10" stroke="#8a5a2a" stroke-width="2.5" stroke-linecap="round"/>
      <!-- Spear head -->
      <path d="M 36 -12 L 28 -22 L 44 -8 Z" fill="#dfe4e8" ${Ob}/>
      <!-- Bound feathers under spear head -->
      <path d="M 44 -2 L 38 -8 L 50 -4 Z" fill="#ff5a5a" ${Ob}/>

      <!-- Rider hand on spear -->
      <circle cx="72" cy="38" r="4.5" fill="#d99a63" stroke="${OUTC}" stroke-width="2"/>
      </g>
    `);
  }

  function svgTankSteam() {  // industrial steampunk land cruiser
    // Brass + riveted iron, billowing smoke from a tall stack, armored
    // boiler hull on a short tank tread base, side-mounted cannon.
    return svgWrapVB(200, 160, `
      <!-- Smoke billow from stack (behind everything) -->
      <ellipse cx="56" cy="14" rx="22" ry="14" fill="#888" opacity="0.5"/>
      <ellipse cx="44" cy="22" rx="16" ry="10" fill="#a8a8a8" opacity="0.55"/>
      <ellipse cx="70" cy="22" rx="14" ry="9" fill="#7a7a7a" opacity="0.6"/>
      <ellipse cx="60" cy="30" rx="20" ry="10" fill="#9a9a9a" opacity="0.5"/>

      <!-- Tread base -->
      <rect x="10" y="118" width="180" height="22" rx="11" fill="#1a1a1a" ${Ob}/>
      <!-- Tread plates -->
      <g>${Array.from({length:11},(_,i)=>`<rect x="${16+i*16}" y="121" width="12" height="16" rx="1.5" fill="#2a2a2a" stroke="${OUTC}" stroke-width="1.5"/>`).join('')}</g>
      <!-- Big drive wheels left + right -->
      <circle cx="24" cy="128" r="14" fill="#3a2c20" ${Ob}/>
      <circle cx="24" cy="128" r="6" fill="#caa84a" ${Ob}/>
      <path d="M 24 122 L 24 134 M 18 128 L 30 128" stroke="${OUTC}" stroke-width="1.5"/>
      <circle cx="176" cy="128" r="14" fill="#3a2c20" ${Ob}/>
      <circle cx="176" cy="128" r="6" fill="#caa84a" ${Ob}/>
      <path d="M 176 122 L 176 134 M 170 128 L 182 128" stroke="${OUTC}" stroke-width="1.5"/>
      <!-- Smaller idler wheels -->
      <g fill="#5a4030">${Array.from({length:5},(_,i)=>`<circle cx="${56+i*22}" cy="130" r="7" stroke="${OUTC}" stroke-width="2"/>`).join('')}</g>

      <!-- Boiler hull (curved iron body) -->
      <path d="M 28 118 Q 18 92, 30 70 L 162 70 Q 178 92, 168 118 Z" fill="#6a4a2a" ${Ob}/>
      <!-- Hull plating shadow -->
      <path d="M 100 70 Q 178 78, 168 118 L 162 118 L 162 76 L 100 76 Z" fill="${OUTC}" opacity="0.22"/>

      <!-- Rivet lines around hull -->
      <g fill="#caa84a">${Array.from({length:8},(_,i)=>`<circle cx="${42+i*16}" cy="78" r="2" stroke="${OUTC}" stroke-width="1"/>`).join('')}</g>
      <g fill="#caa84a">${Array.from({length:8},(_,i)=>`<circle cx="${42+i*16}" cy="112" r="2" stroke="${OUTC}" stroke-width="1"/>`).join('')}</g>

      <!-- Brass band horizontal -->
      <rect x="32" y="94" width="132" height="6" fill="#caa84a" stroke="${OUTC}" stroke-width="1.5"/>
      <rect x="32" y="94" width="132" height="2" fill="#ebd078"/>

      <!-- Side porthole (looks like a window) -->
      <circle cx="84" cy="90" r="7" fill="#15110c" stroke="#caa84a" stroke-width="2"/>
      <circle cx="84" cy="90" r="5" fill="#3a5a78"/>
      <circle cx="82" cy="88" r="1.5" fill="#bfeaff"/>

      <!-- Big smokestack -->
      <rect x="42" y="32" width="20" height="38" rx="2" fill="#3a2c20" ${Ob}/>
      <!-- Stack flare top -->
      <path d="M 38 32 L 66 32 L 62 24 L 42 24 Z" fill="#5a3a22" ${Ob}/>
      <!-- Stack band -->
      <rect x="42" y="44" width="20" height="3" fill="#caa84a" stroke="${OUTC}" stroke-width="1"/>

      <!-- Secondary smaller stack -->
      <rect x="72" y="46" width="10" height="24" rx="1.5" fill="#3a2c20" ${Ob}/>
      <ellipse cx="77" cy="42" rx="10" ry="6" fill="#9a9a9a" opacity="0.55"/>

      <!-- Cannon turret on top -->
      <path d="M 102 70 Q 110 56, 138 58 L 148 70 Z" fill="#5a4030" ${Ob}/>
      <!-- Cannon barrel -->
      <rect x="142" y="60" width="48" height="9" rx="3" fill="#3a2c20" ${Ob}/>
      <rect x="186" y="58" width="6" height="14" rx="1.5" fill="#15110c" ${Ob}/>
      <!-- Barrel reinforcement bands -->
      <rect x="150" y="58" width="3" height="13" fill="#caa84a" stroke="${OUTC}" stroke-width="0.8"/>
      <rect x="166" y="58" width="3" height="13" fill="#caa84a" stroke="${OUTC}" stroke-width="0.8"/>

      <!-- Pressure gauge on side -->
      <circle cx="124" cy="84" r="6" fill="#15110c" stroke="#caa84a" stroke-width="2"/>
      <circle cx="124" cy="84" r="4" fill="#f3e6c0"/>
      <path d="M 124 84 L 126 80" stroke="#c43030" stroke-width="1.5" stroke-linecap="round"/>

      <!-- Steam vents under hull -->
      <ellipse cx="46" cy="118" rx="6" ry="3" fill="#9a9a9a" opacity="0.65"/>
      <ellipse cx="140" cy="118" rx="6" ry="3" fill="#9a9a9a" opacity="0.65"/>
    `);
  }

  function svgTankModern() {  // modern MBT (faces right)
    // Proper main battle tank: angular hull, low-profile turret with
    // commander hatch + crew, gun barrel with thermal sleeve + muzzle
    // brake, side skirts + camo dapples, antenna, smoke grenade rack,
    // fuel cans on the rear deck.
    return svgWrapVB(220, 130, `
      <!-- Tread base + drive wheels -->
      <rect x="14" y="100" width="190" height="20" rx="10" fill="#1a1a1a" ${Ob}/>
      <!-- Tread plate detail -->
      <g>${Array.from({length:18},(_,i)=>`<rect x="${18+i*10}" y="103" width="8" height="14" rx="1" fill="#2a2a2a" stroke="${OUTC}" stroke-width="1"/>`).join('')}</g>
      <!-- Front sprocket wheel -->
      <circle cx="196" cy="110" r="11" fill="#3a3a3a" stroke="${OUTC}" stroke-width="2"/>
      <circle cx="196" cy="110" r="4" fill="#222"/>
      <path d="M 196 99 L 196 121 M 185 110 L 207 110 M 188 102 L 204 118 M 188 118 L 204 102" stroke="${OUTC}" stroke-width="1.5"/>
      <!-- Rear idler wheel -->
      <circle cx="24" cy="110" r="11" fill="#3a3a3a" stroke="${OUTC}" stroke-width="2"/>
      <circle cx="24" cy="110" r="4" fill="#222"/>
      <path d="M 24 99 L 24 121 M 13 110 L 35 110" stroke="${OUTC}" stroke-width="1.5"/>
      <!-- Road wheels (smaller) -->
      <g fill="#3a3a3a">${Array.from({length:5},(_,i)=>`<circle cx="${48+i*30}" cy="112" r="7" stroke="${OUTC}" stroke-width="2"/>`).join('')}</g>

      <!-- Lower hull / side skirt -->
      <path d="M 28 96 L 192 96 L 198 110 L 22 110 Z" fill="#3a4824" ${Ob}/>
      <!-- Side skirt panel lines -->
      <path d="M 60 96 L 60 108 M 96 96 L 96 108 M 132 96 L 132 108 M 168 96 L 168 108" stroke="${OUTC}" stroke-width="1.2" opacity="0.6"/>

      <!-- Main hull -->
      <path d="M 30 78 L 32 70 L 196 70 L 200 80 L 198 96 L 28 96 Z" fill="#5a6a40" ${Ob}/>
      <!-- Hull top highlight -->
      <path d="M 36 72 L 192 72" stroke="#7e9054" stroke-width="2"/>
      <!-- Hull shadow band -->
      <path d="M 28 88 L 200 88 L 198 96 L 28 96 Z" fill="${OUTC}" opacity="0.18"/>
      <!-- Camo dapples on hull -->
      <g fill="#3a4824" opacity="0.75">
        <ellipse cx="56" cy="84" rx="9" ry="3"/>
        <ellipse cx="92" cy="80" rx="7" ry="3"/>
        <ellipse cx="124" cy="86" rx="8" ry="3"/>
        <ellipse cx="160" cy="82" rx="9" ry="3"/>
      </g>

      <!-- Front glacis (angled armor plate) -->
      <path d="M 196 70 L 210 80 L 198 96 Z" fill="#46552e" ${Ob}/>
      <path d="M 200 76 L 206 80" stroke="${OUTC}" stroke-width="1.5"/>
      <!-- Headlights -->
      <circle cx="202" cy="86" r="2" fill="#fcd34d" stroke="${OUTC}" stroke-width="1"/>

      <!-- Rear deck: fuel cans + tow hooks -->
      <rect x="32" y="62" width="10" height="10" rx="1" fill="#3a3a2a" stroke="${OUTC}" stroke-width="1.5"/>
      <rect x="34" y="64" width="6" height="2" fill="#5a5a4a"/>
      <rect x="44" y="62" width="10" height="10" rx="1" fill="#3a3a2a" stroke="${OUTC}" stroke-width="1.5"/>
      <rect x="46" y="64" width="6" height="2" fill="#5a5a4a"/>
      <!-- Rear stowage box -->
      <rect x="58" y="64" width="14" height="8" rx="1" fill="#44502f" stroke="${OUTC}" stroke-width="1.5"/>

      <!-- Turret (low-profile, angular) -->
      <path d="M 78 58 Q 78 44, 96 44 L 158 44 Q 176 44, 176 60 L 168 70 L 84 70 Z" fill="#66794a" ${Ob}/>
      <!-- Turret highlight -->
      <path d="M 84 48 Q 96 46, 158 48" fill="none" stroke="#869c64" stroke-width="2"/>
      <!-- Turret shadow (right side) -->
      <path d="M 128 44 L 158 44 Q 176 44, 176 60 L 168 70 L 128 70 Z" fill="${OUTC}" opacity="0.22"/>
      <!-- Turret panel lines -->
      <path d="M 100 56 L 154 56" stroke="${OUTC}" stroke-width="1" opacity="0.5"/>

      <!-- Commander cupola + hatch -->
      <ellipse cx="116" cy="42" rx="12" ry="5" fill="#3a4824" ${Ob}/>
      <rect x="108" y="32" width="16" height="12" rx="2" fill="#5a6a40" stroke="${OUTC}" stroke-width="1.5"/>
      <!-- Commander silhouette -->
      <ellipse cx="116" cy="32" rx="5" ry="4" fill="#15110c"/>
      <rect x="113" y="26" width="6" height="6" rx="1" fill="#3a3a2a" stroke="${OUTC}" stroke-width="1.2"/>

      <!-- Antenna -->
      <rect x="138" y="34" width="2" height="22" fill="#1a1a1a"/>
      <path d="M 139 32 Q 142 28, 146 30" fill="none" stroke="#1a1a1a" stroke-width="1.5"/>
      <!-- Smoke grenade launcher cluster on turret -->
      <g fill="#1a1a1a" stroke="${OUTC}" stroke-width="1">
        <rect x="148" y="46" width="3" height="6" rx="0.5"/>
        <rect x="152" y="44" width="3" height="6" rx="0.5"/>
        <rect x="156" y="46" width="3" height="6" rx="0.5"/>
      </g>

      <!-- Main gun: mantlet + thermal sleeve + barrel + muzzle brake -->
      <rect x="172" y="56" width="14" height="10" rx="2" fill="#44502f" stroke="${OUTC}" stroke-width="1.5"/>
      <rect x="186" y="58" width="22" height="7" rx="1.5" fill="#2e3520" ${Ob}/>
      <!-- Thermal sleeve segments -->
      <rect x="190" y="57" width="3" height="9" fill="#1a1a1a"/>
      <rect x="196" y="57" width="3" height="9" fill="#1a1a1a"/>
      <rect x="202" y="57" width="3" height="9" fill="#1a1a1a"/>
      <!-- Barrel (long, thin) -->
      <rect x="208" y="59" width="10" height="5" rx="1" fill="#2e3520" ${Ob}/>
      <!-- Muzzle brake -->
      <rect x="216" y="56" width="6" height="11" rx="1" fill="#1a1a1a" stroke="${OUTC}" stroke-width="1.5"/>
      <rect x="218" y="58" width="2" height="3" fill="#5a5a4a"/>
      <rect x="218" y="62" width="2" height="3" fill="#5a5a4a"/>
    `);
  }

  function svgMech() {  // future bipedal mech (faces right)
    // Reverse-jointed digitigrade legs, chunky armored torso, twin
    // shoulder weapons (gatling on left, missile box on right), glowing
    // cyan visor + reactor vents, claw-style feet.
    return svgWrapVB(200, 200, `
      <!-- Back leg: reverse-jointed (digitigrade) -->
      <path d="M 70 100 L 64 130 L 80 156 L 70 180" fill="none" stroke="${OUTC}" stroke-width="22" stroke-linecap="round"/>
      <path d="M 70 100 L 64 130 L 80 156 L 70 180" fill="none" stroke="#2c3550" stroke-width="18" stroke-linecap="round"/>
      <!-- Back knee joint (glowing) -->
      <circle cx="64" cy="130" r="9" fill="#3aa3ff" stroke="${OUTC}" stroke-width="2"/>
      <circle cx="64" cy="130" r="4" fill="#15110c"/>
      <!-- Back ankle -->
      <circle cx="80" cy="156" r="7" fill="#1d2540" stroke="${OUTC}" stroke-width="1.5"/>
      <!-- Back foot (claw) -->
      <path d="M 60 178 L 88 178 L 94 192 L 56 192 Z" fill="#15110c" ${Ob}/>
      <path d="M 60 192 L 56 198 L 64 196 Z M 78 192 L 80 198 L 86 196 Z M 88 192 L 94 198 L 94 194 Z" fill="#15110c" ${Ob}/>

      <!-- Front leg: stepped forward, reverse-jointed -->
      <path d="M 130 100 Q 142 124, 130 148 L 142 178" fill="none" stroke="${OUTC}" stroke-width="22" stroke-linecap="round"/>
      <path d="M 130 100 Q 142 124, 130 148 L 142 178" fill="none" stroke="#3a4870" stroke-width="18" stroke-linecap="round"/>
      <circle cx="142" cy="124" r="9" fill="#3aa3ff" stroke="${OUTC}" stroke-width="2"/>
      <circle cx="142" cy="124" r="4" fill="#15110c"/>
      <circle cx="130" cy="148" r="7" fill="#1d2540" stroke="${OUTC}" stroke-width="1.5"/>
      <!-- Front foot -->
      <path d="M 124 176 L 158 176 L 164 190 L 122 190 Z" fill="#15110c" ${Ob}/>
      <path d="M 124 190 L 120 196 L 128 194 Z M 142 190 L 144 196 L 150 194 Z M 154 190 L 162 196 L 162 192 Z" fill="#15110c" ${Ob}/>

      <!-- Hip block -->
      <path d="M 58 96 L 142 96 L 138 116 L 62 116 Z" fill="#1d2540" ${Ob}/>
      <rect x="92" y="100" width="16" height="12" rx="2" fill="#3aa3ff" stroke="${OUTC}" stroke-width="1.5"/>
      <rect x="95" y="102" width="10" height="8" fill="#bfeaff"/>

      <!-- Main torso plate -->
      <path d="M 46 44 L 154 44 L 158 96 L 42 96 Z" fill="#46568a" ${Ob}/>
      <!-- Right side shadow -->
      <path d="M 100 44 L 154 44 L 158 96 L 102 96 Z" fill="${OUTC}" opacity="0.2"/>
      <!-- Center reactor vent (vertical louvers + glowing core) -->
      <rect x="84" y="56" width="32" height="36" rx="3" fill="#15110c" ${Ob}/>
      <circle cx="100" cy="74" r="10" fill="#15110c"/>
      <circle cx="100" cy="74" r="7" fill="#3aa3ff"/>
      <circle cx="100" cy="74" r="3" fill="#bfeaff"/>
      <!-- Louver slits -->
      <rect x="88" y="60" width="8" height="2.5" fill="#3aa3ff"/>
      <rect x="88" y="86" width="8" height="2.5" fill="#3aa3ff"/>
      <rect x="104" y="60" width="8" height="2.5" fill="#3aa3ff"/>
      <rect x="104" y="86" width="8" height="2.5" fill="#3aa3ff"/>
      <!-- Plate seams -->
      <path d="M 56 50 L 80 50 L 80 92 L 54 92 Z" fill="none" stroke="${OUTC}" stroke-width="1.4"/>
      <path d="M 120 50 L 144 50 L 148 92 L 122 92 Z" fill="none" stroke="${OUTC}" stroke-width="1.4"/>
      <!-- Top torso highlight -->
      <path d="M 50 46 Q 100 38, 150 46" fill="none" stroke="#7e98d8" stroke-width="2"/>

      <!-- Left shoulder pauldron + gatling -->
      <path d="M 30 42 Q 36 26, 56 28 L 62 60 Q 40 68, 24 60 Z" fill="#3a4a78" ${Ob}/>
      <!-- Gatling barrel cluster (mounted forward) -->
      <rect x="20" y="42" width="22" height="14" rx="2" fill="#15110c" stroke="${OUTC}" stroke-width="1.5"/>
      <g fill="#5a5a4a">
        <circle cx="22" cy="46" r="2"/>
        <circle cx="28" cy="46" r="2"/>
        <circle cx="22" cy="52" r="2"/>
        <circle cx="28" cy="52" r="2"/>
      </g>
      <rect x="14" y="46" width="8" height="6" rx="1" fill="#15110c"/>

      <!-- Right shoulder pauldron + missile box -->
      <path d="M 170 42 Q 164 26, 144 28 L 138 60 Q 160 68, 176 60 Z" fill="#54649a" ${Ob}/>
      <rect x="160" y="32" width="32" height="22" rx="2" fill="#2a3552" stroke="${OUTC}" stroke-width="1.5"/>
      <!-- Missile tube ends -->
      <g fill="#ff5a5a" stroke="${OUTC}" stroke-width="1">
        <circle cx="167" cy="40" r="2.4"/>
        <circle cx="177" cy="40" r="2.4"/>
        <circle cx="187" cy="40" r="2.4"/>
        <circle cx="167" cy="48" r="2.4"/>
        <circle cx="177" cy="48" r="2.4"/>
        <circle cx="187" cy="48" r="2.4"/>
      </g>

      <!-- Head / sensor pod -->
      <path d="M 76 14 L 124 14 L 132 40 L 68 40 Z" fill="#3a4a78" ${Ob}/>
      <!-- Visor strip -->
      <rect x="72" y="22" width="56" height="12" rx="2" fill="#0a0e18" stroke="${OUTC}" stroke-width="2"/>
      <rect x="76" y="25" width="48" height="6" fill="#3aa3ff"/>
      <rect x="76" y="25" width="48" height="2" fill="#bfeaff"/>
      <rect x="80" y="26" width="10" height="2" fill="#fff" opacity="0.7"/>
      <!-- Antennae -->
      <rect x="84" y="2" width="3" height="14" fill="#1d2540" stroke="${OUTC}" stroke-width="1.2"/>
      <circle cx="85.5" cy="2" r="2" fill="#ff5a5a"/>
      <rect x="116" y="6" width="3" height="10" fill="#1d2540" stroke="${OUTC}" stroke-width="1.2"/>
      <!-- Jaw -->
      <path d="M 76 36 L 124 36" stroke="${OUTC}" stroke-width="1.5"/>
    `);
  }

  function svgHover() {  // future hover attack gunship (faces right)
    // Sleek dark gunship: pointed nose, swept wings, tail fin, twin
    // engines, glowing cockpit + underwing missile pods. Dark hull
    // with cyan accents replaces the previous pink-saucer cyclops.
    return svgWrapVB(220, 170, `
      <!-- Anti-grav exhaust plumes (below the hull) -->
      <ellipse cx="60"  cy="138" rx="22" ry="6" fill="rgba(120,220,255,0.45)"/>
      <ellipse cx="60"  cy="146" rx="14" ry="3" fill="rgba(200,240,255,0.55)"/>
      <ellipse cx="140" cy="138" rx="22" ry="6" fill="rgba(120,220,255,0.45)"/>
      <ellipse cx="140" cy="146" rx="14" ry="3" fill="rgba(200,240,255,0.55)"/>

      <!-- Tail fin (rear left) -->
      <path d="M 18 80 L 6 56 L 14 86 Z" fill="#2a3454" ${Ob}/>
      <path d="M 10 60 L 12 78" stroke="#7ec8ff" stroke-width="1.5"/>

      <!-- Lower hull (shadow band) -->
      <path d="M 10 96 Q 110 124, 210 92 L 196 116 Q 110 134, 26 118 Z" fill="#1a2238" ${Ob}/>

      <!-- Main hull - sleek arrow shape pointing right -->
      <path d="M 14 76 Q 70 50, 160 60 L 212 88 L 162 100 Q 70 110, 22 96 Z" fill="#3a4870" ${Ob}/>
      <!-- Upper highlight band -->
      <path d="M 30 72 Q 90 56, 158 64" fill="none" stroke="#6a85bc" stroke-width="3"/>
      <path d="M 34 68 Q 90 56, 156 62" fill="none" stroke="#bfdcff" stroke-width="1.4" opacity="0.7"/>

      <!-- Swept-back wing (visible) -->
      <path d="M 50 82 L 18 110 L 30 110 L 84 90 Z" fill="#2a3454" ${Ob}/>
      <path d="M 35 100 L 70 92" stroke="#7ec8ff" stroke-width="1.5"/>

      <!-- Cockpit canopy (forward, glowing) -->
      <path d="M 110 56 Q 140 46, 168 64 L 162 78 Q 130 80, 108 72 Z" fill="#9bdcff" ${Ob}/>
      <path d="M 116 58 Q 140 50, 162 64" fill="none" stroke="#fff" stroke-width="2.2"/>
      <!-- Pilot silhouette through canopy -->
      <ellipse cx="138" cy="68" rx="9" ry="5" fill="#1a2238"/>
      <circle cx="142" cy="66" r="2" fill="#0a0e18"/>

      <!-- Nose tip with sensor -->
      <path d="M 195 80 L 212 88 L 195 96 Z" fill="#15110c" ${Ob}/>
      <circle cx="200" cy="88" r="2.5" fill="#ff5a5a"/>

      <!-- Wing-mounted gun pod (top) -->
      <rect x="72" y="64" width="20" height="6" rx="1.5" fill="#1a2238" stroke="${OUTC}" stroke-width="1.5"/>
      <rect x="88" y="65" width="10" height="4" rx="1" fill="#7ec8ff"/>

      <!-- Underwing missile racks (3 missiles per side) -->
      <g stroke="${OUTC}" stroke-width="1.5">
        <rect x="38" y="106" width="56" height="4" rx="1" fill="#2a3454"/>
        <rect x="40" y="110" width="14" height="10" rx="1" fill="#54649a"/>
        <rect x="58" y="110" width="14" height="10" rx="1" fill="#54649a"/>
        <rect x="76" y="110" width="14" height="10" rx="1" fill="#54649a"/>
      </g>
      <!-- Missile tips -->
      <circle cx="47" cy="115" r="2" fill="#ff5a5a"/>
      <circle cx="65" cy="115" r="2" fill="#ff5a5a"/>
      <circle cx="83" cy="115" r="2" fill="#ff5a5a"/>

      <!-- Right-side missile rack (smaller, forward) -->
      <g stroke="${OUTC}" stroke-width="1.5">
        <rect x="118" y="104" width="40" height="4" rx="1" fill="#2a3454"/>
        <rect x="120" y="108" width="14" height="10" rx="1" fill="#54649a"/>
        <rect x="138" y="108" width="14" height="10" rx="1" fill="#54649a"/>
      </g>
      <circle cx="127" cy="113" r="2" fill="#ff5a5a"/>
      <circle cx="145" cy="113" r="2" fill="#ff5a5a"/>

      <!-- Engine intakes (twin, glowing) -->
      <ellipse cx="60"  cy="92" rx="10" ry="4" fill="#15110c" stroke="${OUTC}" stroke-width="1.5"/>
      <ellipse cx="60"  cy="92" rx="6"  ry="2" fill="#7ec8ff"/>
      <ellipse cx="140" cy="94" rx="10" ry="4" fill="#15110c" stroke="${OUTC}" stroke-width="1.5"/>
      <ellipse cx="140" cy="94" rx="6"  ry="2" fill="#7ec8ff"/>

      <!-- Hull panel lines -->
      <path d="M 80 84 L 130 84" stroke="${OUTC}" stroke-width="1.2" opacity="0.6"/>
      <path d="M 90 92 L 130 92" stroke="${OUTC}" stroke-width="1.2" opacity="0.4"/>

      <!-- Rear running lights -->
      <circle cx="20" cy="86" r="1.6" fill="#ff5a5a"/>
      <circle cx="44" cy="98" r="1.6" fill="#7ec8ff"/>

      <!-- Antenna -->
      <rect x="76" y="56" width="2" height="10" fill="#1a2238"/>
      <circle cx="77" cy="54" r="1.5" fill="#ff5a5a"/>
    `);
  }

  function svgTitan() {  // hero: end-game sci-fi mech colossus (faces right)
    // Big, intimidating walking battle-mech with a glowing visor band,
    // shoulder cannons, exhaust vents, and panel-line detail. Anchored
    // at the bottom of the viewBox like all bespoke sprites.
    return svgWrapVB(200, 220, `
      <!-- Back leg (planted) -->
      <path d="M 64 120 L 56 168 L 58 200" fill="none" stroke="${OUTC}" stroke-width="26" stroke-linecap="round"/>
      <path d="M 64 120 L 56 168 L 58 200" fill="none" stroke="#2a3454" stroke-width="22" stroke-linecap="round"/>
      <!-- Back knee joint -->
      <circle cx="56" cy="168" r="11" fill="#7ec8ff" stroke="${OUTC}" stroke-width="2"/>
      <circle cx="56" cy="168" r="5" fill="#15110c"/>
      <!-- Back foot plate -->
      <path d="M 36 198 L 86 198 L 90 214 L 32 214 Z" fill="#15110c" ${Ob}/>
      <path d="M 40 204 L 84 204" stroke="#7ec8ff" stroke-width="2"/>
      <!-- Back hip thruster -->
      <ellipse cx="68" cy="124" rx="8" ry="5" fill="#ff8a4a"/>

      <!-- Front leg (lifted, stepping forward) -->
      <path d="M 124 120 Q 138 142, 130 168 L 134 196" fill="none" stroke="${OUTC}" stroke-width="26" stroke-linecap="round"/>
      <path d="M 124 120 Q 138 142, 130 168 L 134 196" fill="none" stroke="#3a4a78" stroke-width="22" stroke-linecap="round"/>
      <circle cx="138" cy="146" r="11" fill="#7ec8ff" stroke="${OUTC}" stroke-width="2"/>
      <circle cx="138" cy="146" r="5" fill="#15110c"/>
      <!-- Front foot plate -->
      <path d="M 112 194 L 162 194 L 166 210 L 108 210 Z" fill="#15110c" ${Ob}/>
      <path d="M 116 200 L 160 200" stroke="#7ec8ff" stroke-width="2"/>
      <!-- Front hip thruster -->
      <ellipse cx="124" cy="124" rx="8" ry="5" fill="#ff8a4a"/>

      <!-- Hip / waist armor block -->
      <path d="M 50 116 L 142 116 L 138 138 L 54 138 Z" fill="#1d2540" ${Ob}/>
      <rect x="86" y="120" width="20" height="14" rx="2" fill="#7ec8ff" stroke="${OUTC}" stroke-width="1.5"/>
      <rect x="90" y="123" width="12" height="8" fill="#bfeaff"/>

      <!-- Main torso plate -->
      <path d="M 46 56 L 146 56 L 152 120 L 40 120 Z" fill="#46568a" ${Ob}/>
      <!-- Right shadow on torso (light from upper left) -->
      <path d="M 96 56 L 146 56 L 152 120 L 100 120 Z" fill="${OUTC}" opacity="0.22"/>
      <!-- Center power core panel -->
      <rect x="80" y="68" width="32" height="40" rx="4" fill="#1d2540" ${Ob}/>
      <circle cx="96" cy="88" r="12" fill="#15110c"/>
      <circle cx="96" cy="88" r="9" fill="#7ec8ff"/>
      <circle cx="96" cy="88" r="5" fill="#bfeaff"/>
      <circle cx="93" cy="85" r="2" fill="#fff"/>
      <!-- Side panel seams -->
      <path d="M 56 64 L 76 64 L 78 116 L 52 116 Z" fill="none" stroke="${OUTC}" stroke-width="1.5"/>
      <path d="M 116 64 L 136 64 L 140 116 L 118 116 Z" fill="none" stroke="${OUTC}" stroke-width="1.5"/>
      <!-- Top torso highlight -->
      <path d="M 50 58 Q 96 50, 142 58" fill="none" stroke="#7e98d8" stroke-width="2"/>

      <!-- Left shoulder pauldron + shoulder cannon -->
      <path d="M 28 48 Q 32 28, 56 30 L 60 70 Q 36 76, 24 64 Z" fill="#3a4a78" ${Ob}/>
      <rect x="20" y="34" width="22" height="10" rx="2" fill="#15110c" stroke="${OUTC}" stroke-width="2"/>
      <rect x="14" y="36" width="8" height="6" fill="#ff5a5a"/>

      <!-- Right shoulder pauldron + missile pod -->
      <path d="M 164 48 Q 160 28, 136 30 L 132 70 Q 156 76, 168 64 Z" fill="#54649a" ${Ob}/>
      <rect x="146" y="32" width="26" height="18" rx="3" fill="#1d2540" stroke="${OUTC}" stroke-width="2"/>
      <!-- Missile tips -->
      <g fill="#ff5a5a">
        <circle cx="152" cy="38" r="2.4" stroke="${OUTC}" stroke-width="1"/>
        <circle cx="162" cy="38" r="2.4" stroke="${OUTC}" stroke-width="1"/>
        <circle cx="152" cy="46" r="2.4" stroke="${OUTC}" stroke-width="1"/>
        <circle cx="162" cy="46" r="2.4" stroke="${OUTC}" stroke-width="1"/>
      </g>

      <!-- Back exhaust pack -->
      <rect x="38" y="60" width="6" height="22" fill="#15110c" ${Ob}/>
      <rect x="40" y="56" width="6" height="6" fill="#9a9a9a" stroke="${OUTC}" stroke-width="1"/>
      <ellipse cx="36" cy="56" rx="6" ry="3" fill="#ff8a4a" opacity="0.7"/>

      <!-- Helmet / head module -->
      <path d="M 68 18 L 124 18 L 132 50 L 60 50 Z" fill="#54649a" ${Ob}/>
      <!-- Visor band (horizontal slit) -->
      <rect x="64" y="28" width="64" height="14" rx="2" fill="#0a0e18" stroke="${OUTC}" stroke-width="2"/>
      <!-- Glowing visor strip -->
      <rect x="68" y="32" width="56" height="6" fill="#ff5a5a"/>
      <rect x="68" y="32" width="56" height="2" fill="#ffb0b0"/>
      <!-- Visor specular highlight -->
      <rect x="72" y="33" width="14" height="2" fill="#fff" opacity="0.8"/>
      <!-- Crown / antennae -->
      <path d="M 76 18 L 78 6 L 82 18 Z" fill="#7ec8ff" ${Ob}/>
      <path d="M 114 18 L 116 6 L 120 18 Z" fill="#7ec8ff" ${Ob}/>
      <rect x="94" y="2" width="8" height="14" rx="1.5" fill="#1d2540" stroke="${OUTC}" stroke-width="1.5"/>
      <circle cx="98" cy="2" r="2.5" fill="#ff5a5a"/>
      <!-- Jaw line -->
      <path d="M 70 46 L 122 46" stroke="${OUTC}" stroke-width="1.5"/>
    `);
  }

  // ---- Per-unit sprite definitions ----
  // Humanoid configs share the builder; bespoke SVGs (mounts, vehicles,
  // beasts) are authored as functions returning a full <svg>.
  const SPRITE_DEFS = {
    // ---- Stone Age ----
    club: (pose) => svgHumanoid({
      skin:'#d99a63', skinSh:'#a36a3a', skinHi:'#f0c084',
      torso:'#8e6440', torsoSh:'#5a3e22',
      legs:'#6a4528', legsSh:'#3e2814',
      boots:'#3a2510', bootCuff:'#5a3a1a',
      hair:'#2c1c0e', build:'bulky', weapon:'club',
    }, pose),
    sling: (pose) => svgHumanoid({
      skin:'#d99a63', skinSh:'#a36a3a', skinHi:'#f0c084',
      torso:'#a87a48', torsoSh:'#704826',
      legs:'#5a3820', legsSh:'#34200f',
      boots:'#2a1808', bootCuff:'#4a2a14',
      hair:'#1c1208', build:'slim', weapon:'sling',
    }, pose),
    // ---- Medieval ----
    swordsman: (pose) => svgHumanoid({
      skin:'#e3ab72', skinSh:'#a6743f', skinHi:'#f3c690',
      torso:'#9aa0ab', torsoSh:'#5a606a',
      legs:'#2a2a32', legsSh:'#15151a',
      boots:'#15151a', bootCuff:'#3a3a44',
      accent:'#c2c8d0', accentSh:'#7e858e', accentHi:'#ebeef2',
      crest:'#c43838', belt:'#5a3a18', beltBuckle:'#caa84a',
      pauldron:'#8a9098', pauldronTrim:'#caa84a',
      headgear:'helm', weapon:'sword',
    }, pose),
    archer: (pose) => svgHumanoid({
      skin:'#e3ab72', skinSh:'#a6743f', skinHi:'#f3c690',
      torso:'#46603a', torsoSh:'#26361f',
      legs:'#5a3a20', legsSh:'#321e0e',
      boots:'#26180a', bootCuff:'#4a2a14',
      accent:'#3e5a28', accentSh:'#243818', accentHi:'#5a7a3a',
      hair:'#5a3a1a', belt:'#3a2410', beltBuckle:'#9a7a3a',
      build:'slim', headgear:'hood', weapon:'bow',
    }, pose),
    // ---- Industrial ----
    rifleman: (pose) => svgHumanoid({
      skin:'#dba36a', skinSh:'#a36a3a', skinHi:'#f0c084',
      torso:'#6a7445', torsoSh:'#3d4524',
      legs:'#4a4326', legsSh:'#26210f',
      boots:'#1a1208', bootCuff:'#3a2c18',
      accent:'#7a7050', accentSh:'#4a4230', accentHi:'#a39676',
      belt:'#2a1c0e', beltBuckle:'#caa84a',
      headgear:'brodie', weapon:'rifle',
    }, pose),
    cannon: (pose) => svgHumanoid({
      skin:'#dba36a', skinSh:'#a36a3a', skinHi:'#f0c084',
      torso:'#52442e', torsoSh:'#2c2418',
      legs:'#3a2c1c', legsSh:'#1e1408',
      boots:'#1a1208', bootCuff:'#33261a',
      accent:'#6a604a', accentSh:'#3e3624', accentHi:'#8a7e60',
      hair:'#2a1c0e', belt:'#2a1c0e', beltBuckle:'#caa84a',
      build:'bulky', headgear:'brodie', weapon:'cannon',
    }, pose),
    // ---- Modern ----
    soldier: (pose) => svgHumanoid({
      skin:'#d8a067', skinSh:'#9a6a3a', skinHi:'#f0c084',
      torso:'#4a5a36', torsoSh:'#26321a',
      legs:'#3e4a2a', legsSh:'#1f2812',
      boots:'#15110a', bootCuff:'#2a3220',
      accent:'#4a5a36', accentSh:'#26321a', accentHi:'#6a7a48',
      belt:'#2a221a', beltBuckle:'#7a6a4a',
      chestEmblem:'star', emblemColor:'#caa84a',
      headgear:'combat', weapon:'rifle',
    }, pose),
    sniper: (pose) => svgHumanoid({
      skin:'#d8a067', skinSh:'#9a6a3a', skinHi:'#f0c084',
      torso:'#5a5a3c', torsoSh:'#34341e',
      legs:'#4a4a32', legsSh:'#24241a',
      boots:'#1a180e', bootCuff:'#2a2a1c',
      accent:'#5a5838', accentSh:'#34321e', accentHi:'#7a7850',
      belt:'#2a261a', beltBuckle:'#7a6a4a',
      build:'slim', headgear:'bandana', weapon:'sniper',
    }, pose),
    // ---- Future ----
    laser: (pose) => svgHumanoid({
      skin:'#c5d8e8', skinSh:'#6a8aa0', skinHi:'#e8f0f8',
      torso:'#2a3a68', torsoSh:'#15203e',
      legs:'#1f2a4a', legsSh:'#0e1428',
      boots:'#0a0e1c', bootCuff:'#2a3a68',
      accent:'#3a4a78', accentSh:'#1f2a4a', accentHi:'#6a7ab0',
      belt:'#15110c', beltBuckle:'#3aa3ff',
      chestEmblem:'core',
      headgear:'visor', weapon:'laser',
    }, pose),
    // ---- Heroes (humanoid) ----
    hero_paladin: (pose) => svgHumanoid({
      skin:'#e8c79a', skinSh:'#a8855a', skinHi:'#f5d8a8',
      torso:'#dadce0', torsoSh:'#8a9098',
      legs:'#3a3a42', legsSh:'#1e1e26',
      boots:'#15151a', bootCuff:'#3a3a42',
      accent:'#ebeef2', accentSh:'#8a9098', accentHi:'#ffffff',
      crest:'#fcd34d', cape:'#c43872', capeSh:'#5a1a30',
      belt:'#7a5a2a', beltBuckle:'#fcd34d',
      pauldron:'#ebeef2', pauldronTrim:'#fcd34d',
      chestEmblem:'cross', emblemColor:'#fcd34d',
      build:'bulky', headgear:'helm', weapon:'sword',
    }, pose),
    hero_general: (pose) => svgHumanoid({
      skin:'#e0ad8a', skinSh:'#a37a52', skinHi:'#f3c8a3',
      torso:'#3a4824', torsoSh:'#1e2810',
      legs:'#3a2818', legsSh:'#1e1408',
      boots:'#1a1208', bootCuff:'#3a2818',
      accent:'#2a3520', accentSh:'#141a10', accentHi:'#46582a',
      hair:'#2a1c0e', belt:'#3a2014', beltBuckle:'#caa84a',
      chestEmblem:'stars4', emblemColor:'#caa84a',
      epaulettes:true,
      headgear:'beret', weapon:'sword',
    }, pose),
    hero_seal: (pose) => svgHumanoid({
      skin:'#c9a978', skinSh:'#8a6a3a', skinHi:'#e8c898',
      torso:'#2a3520', torsoSh:'#141a10',
      legs:'#262e1a', legsSh:'#121608',
      boots:'#0e0e08', bootCuff:'#1c1f12',
      accent:'#2a3520', accentSh:'#141a10', accentHi:'#3e4a30',
      belt:'#15110a', beltBuckle:'#5a4a2a',
      build:'slim', headgear:'bandana', weapon:'sniper',
    }, pose),
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
    dino: 220/170, knight: 240/200, hero_grog: 220/220,
    tank1: 200/160, tank2: 220/130, mech: 200/200,
    flier: 220/170, hero_titan: 200/220,
  };

  // Cache lookup returns { runA, runB, strike } where each is { img, ready }.
  // Bespoke sprites (vehicles, beasts) ignore the pose arg so all three
  // images are identical -- harmless duplication, one decode each.
  function getSprite(key, pose) {
    let k = key;
    if (k.startsWith('boss_')) k = k.replace(/^boss_/, '').replace(/_\d+$/, '');
    let entry = spriteCache[k];
    if (!entry) {
      const def = SPRITE_DEFS[k];
      if (!def) { spriteCache[k] = { none: true }; return null; }
      entry = {
        runA:   { ready: false, img: new Image() },
        runB:   { ready: false, img: new Image() },
        strike: { ready: false, img: new Image() },
      };
      entry.runA.img.onload   = () => { entry.runA.ready = true; };
      entry.runB.img.onload   = () => { entry.runB.ready = true; };
      entry.strike.img.onload = () => { entry.strike.ready = true; };
      entry.runA.img.src   = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(def('run'));
      entry.runB.img.src   = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(def('runB'));
      entry.strike.img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(def('strike'));
      spriteCache[k] = entry;
    }
    if (entry.none) return null;
    let slot;
    if (pose === 'strike') slot = entry.strike.ready ? entry.strike : entry.runA;
    else if (pose === 'runB') slot = entry.runB.ready ? entry.runB : entry.runA;
    else slot = entry.runA;
    return slot.ready ? slot : null;
  }

  function preloadSprites() {
    for (const k of Object.keys(SPRITE_DEFS)) getSprite(k, 'run');
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
    // Walk frame swap: alternate runA / runB on each half-cycle of walkPhase.
    // walkPhase advances ~7 rad/s, so legs swap roughly every 0.45s -- in step
    // with the existing bob frequency so the foot lift looks coordinated.
    const stride = (Math.floor(u.walkPhase / Math.PI) & 1) === 0 ? 'run' : 'runB';
    const sprite = getSprite(u.key, u.attackPose > 0 ? 'strike' : stride);
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
        bob = Math.abs(Math.sin(u.walkPhase * 1.6)) * (u.h * 0.012);
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
    // Trails are {x,y} points (older saves may hold bare x numbers).
    const pts = (p.trail || []).map(t => (typeof t === 'number') ? { x: t, y: p.y } : t);
    const kind = p.kind || (
      (p.color === '#6ec4ff' || p.color === '#ff90ee') ? 'laser' :
      p.dmg >= 100 ? 'shell' : p.dmg >= 30 ? 'arrow' : 'bullet');
    const TRAIL_STYLE = {
      laser:  { w: 4,   c: p.color || '#6ec4ff', a: 0.55 },
      plasma: { w: 5,   c: p.color || '#ff90ee', a: 0.5 },
      shell:  { w: 5,   c: '#3a3a3a',            a: 0.4 },
      tracer: { w: 2.4, c: '#ffe9b0',            a: 0.7 },
      bullet: { w: 2.2, c: '#ffd98a',            a: 0.5 },
      arrow:  { w: 2,   c: '#5a3a22',            a: 0.35 },
      stone:  { w: 3,   c: '#8a7a60',            a: 0.3 },
    };
    if (pts.length > 1) {
      const st = TRAIL_STYLE[kind] || TRAIL_STYLE.bullet;
      ctx.lineCap = 'round';
      for (let i = 0; i < pts.length - 1; i++) {
        const a = (i + 1) / pts.length;
        ctx.strokeStyle = st.c;
        ctx.globalAlpha = a * st.a;
        ctx.lineWidth = st.w * a;
        ctx.beginPath();
        ctx.moveTo(pts[i].x, pts[i].y);
        ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // Arcing kinds pitch along their velocity so arrows/shells nose over.
    const ang = Math.atan2(p.vy || 0, p.vx || dir);
    switch (kind) {
      case 'laser':
        ctx.strokeStyle = p.color || '#6ec4ff';
        ctx.lineWidth = 3;
        ctx.shadowColor = p.color || '#6ec4ff'; ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(p.x - dir * 18, p.y);
        ctx.lineTo(p.x + dir * 4,  p.y);
        ctx.stroke();
        ctx.shadowBlur = 0;
        break;
      case 'plasma': {
        ctx.shadowColor = p.color || '#ff90ee'; ctx.shadowBlur = 12;
        ctx.fillStyle = p.color || '#ff90ee';
        ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'shell': {
        // Cannonball: dark sphere with a rim light, faint smoke puffs behind.
        for (let i = 0; i < Math.min(2, pts.length); i++) {
          const q = pts[i];
          ctx.fillStyle = `rgba(120,116,110,${0.18 + i * 0.08})`;
          ctx.beginPath(); ctx.arc(q.x, q.y, 4 + i, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = '#33343a';
        ctx.beginPath(); ctx.arc(p.x, p.y, 5.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath(); ctx.arc(p.x - dir * 1.6, p.y - 1.8, 1.8, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'tracer':
        // Sniper round: long white-hot streak with a warm halo.
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(ang);
        ctx.strokeStyle = 'rgba(255,210,130,0.55)'; ctx.lineWidth = 3.6;
        ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(2, 0); ctx.stroke();
        ctx.strokeStyle = '#fff6e0'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(4, 0); ctx.stroke();
        ctx.restore();
        break;
      case 'arrow':
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(ang);
        ctx.strokeStyle = '#6a4a28'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(5, 0); ctx.stroke();
        ctx.fillStyle = '#cfd4dc';                       // steel head
        ctx.beginPath();
        ctx.moveTo(9, 0); ctx.lineTo(3, -2.6); ctx.lineTo(3, 2.6);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e8e2d0';                       // fletching
        ctx.beginPath();
        ctx.moveTo(-11, 0); ctx.lineTo(-15, -3); ctx.lineTo(-9, 0); ctx.lineTo(-15, 3);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        break;
      case 'stone': {
        // Tumbling rock — rotation phase driven by travel distance.
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.x * 0.04);
        ctx.fillStyle = '#8d8378';
        ctx.beginPath();
        ctx.moveTo(-4, -2.5); ctx.lineTo(0.5, -4); ctx.lineTo(4, -1.5);
        ctx.lineTo(3, 3); ctx.lineTo(-2.5, 3.6); ctx.lineTo(-4.5, 0.5);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.beginPath(); ctx.arc(-1.2, -1.6, 1.4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        break;
      }
      default:
        // Bullet: bright tip + short warm streak.
        ctx.fillStyle = p.color || '#fcd34d';
        ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
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
        if (lbl) lbl.innerHTML = `Age Up<small>${ERAS[playerEra + 1].name}</small>`;
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
        if (lbl) lbl.innerHTML = `Hero<small>${h.name}</small>`;
        if (cdEl) {
          if (heroReadyT > 0) cdEl.textContent = `${Math.ceil(heroReadyT)}s`;
          else if (gold < h.cost) cdEl.textContent = `$${h.cost}`;
          else cdEl.textContent = `$${h.cost} · READY`;
        }
        heroBtn.disabled = heroReadyT > 0 || gold < h.cost;
      }
    }

    // Spawn button affordability + queue-full disabled state. Per-button
    // cooldowns were replaced by the unified training queue, so the only
    // gates here are "can I afford this?" and "is the queue full?".
    const list = document.getElementById('aow-spawn-list');
    if (list) {
      const queueFull = trainingQueue.length >= TRAINING_MAX;
      let i = 0;
      for (let e = 0; e <= playerEra; e++) {
        for (const key of unitsForEra(e)) {
          const def = UNITS[key];
          const btn = list.children[i];
          if (btn) {
            btn.classList.toggle('aow-not-afford', gold < def.cost);
            btn.classList.toggle('aow-queue-full', queueFull);
          }
          i++;
        }
      }
    }
  }

  function renderTrainingQueue() {
    const root = document.getElementById('aow-train-slots');
    if (!root) return;
    root.innerHTML = '';
    for (let i = 0; i < TRAINING_MAX; i++) {
      const slot = document.createElement('button');
      slot.className = 'aow-train-slot';
      slot.id = 'aow-train-slot-' + i;
      const entry = trainingQueue[i];
      if (entry) {
        const def = UNITS[entry.key];
        const svgFn = SPRITE_DEFS[entry.key];
        const iconHtml = svgFn
          ? `<img class="aow-train-sprite" alt="" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgFn('run'))}"/>`
          : `<span class="aow-train-icon">${def?.icon || '?'}</span>`;
        slot.innerHTML = iconHtml + `<span class="aow-train-cancel" aria-hidden="true">×</span>`;
        slot.title = `${def?.name || entry.key} — click to cancel + refund $${def?.cost}`;
        slot.onclick = () => cancelTrainingAt(i);
        if (i === 0) {
          slot.style.setProperty('--aow-train', ((1 - entry.remaining / entry.total) * 100) + '%');
        } else {
          slot.style.setProperty('--aow-train', '0%');
        }
      } else {
        slot.classList.add('aow-train-empty');
        slot.disabled = true;
        slot.innerHTML = `<span class="aow-train-dot">·</span>`;
      }
      root.appendChild(slot);
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
        const svgFn = SPRITE_DEFS[key];
        const iconHtml = svgFn
          ? `<img class="aow-spawn-sprite" alt="" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgFn('run'))}"/>`
          : `<span class="aow-spawn-icon">${def.icon}</span>`;
        btn.innerHTML = `
          <span class="aow-spawn-key">${idx <= 9 ? idx : ''}</span>
          ${iconHtml}
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
    for (let i = 0; i < TURRET_SLOTS_MAX; i++) {
      const slot = document.createElement('div');
      slot.className = 'aow-turret-slot';
      // Slot beyond what we've purchased: show a "Buy slot" prompt with cost.
      if (i >= playerSlotsOwned) {
        slot.classList.add('aow-turret-locked');
        // Only the NEXT-to-unlock slot is buyable; further-out slots stay
        // visible but greyed so the player knows how many slots exist total.
        if (i === playerSlotsOwned) {
          const cost = SLOT_PURCHASE_COSTS[i] || 0;
          slot.innerHTML = `
            <span class="aow-turret-empty">🔒 slot ${i + 1}</span>
            <button class="aow-turret-buy aow-turret-slot-buy" data-buy-slot="1">Buy slot · $${cost}</button>
          `;
        } else {
          slot.innerHTML = `<span class="aow-turret-empty">🔒 slot ${i + 1}</span><span class="aow-turret-maxed">LOCKED</span>`;
        }
        list.appendChild(slot);
        continue;
      }
      const current = playerTurrets[i];
      const next = current ? Math.min(playerEra, current.era + 1) : 0;
      const nextDef = (!current || current.era < playerEra) ? TURRETS[next] : null;
      if (current) {
        const refund = Math.round(current.cost * SELL_REFUND);
        slot.innerHTML = `
          <span class="aow-turret-current">${current.icon}<small>${current.name}</small></span>
          <div class="aow-turret-actions">
            ${nextDef ? `<button class="aow-turret-buy" data-slot="${i}" data-era="${next}">⬆️ ${nextDef.icon} $${nextDef.cost}</button>` : '<span class="aow-turret-maxed">MAX</span>'}
            <button class="aow-turret-sell" data-sell="${i}" title="Sell turret for $${refund}">Sell $${refund}</button>
          </div>
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
    list.querySelectorAll('.aow-turret-buy:not(.aow-turret-slot-buy)').forEach(b => {
      b.addEventListener('click', () => tryBuyTurret(+b.dataset.slot, +b.dataset.era));
    });
    list.querySelectorAll('.aow-turret-slot-buy').forEach(b => {
      b.addEventListener('click', tryBuyTurretSlot);
    });
    list.querySelectorAll('.aow-turret-sell').forEach(b => {
      b.addEventListener('click', () => trySellTurret(+b.dataset.sell));
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
        <div><div style="color:var(--text-dim);font-size:10px;letter-spacing:1.5px;text-transform:uppercase">Best Combo</div><div style="font-weight:800;font-size:18px;color:#ff77c8">×${Math.min(3, 1 + comboBest * 0.04).toFixed(1)}</div></div>
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
