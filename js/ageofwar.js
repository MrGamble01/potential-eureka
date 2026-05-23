/* ============================================
   AGE OF WAR — Side-scrolling lane battler
   Spawn units, push the enemy base, age up to
   unlock stronger units. Last base standing wins.
   ============================================ */

const AgeOfWarGame = (() => {
  // ---- Stage ----
  const WIDTH  = 880;
  const HEIGHT = 360;
  const GROUND_Y = HEIGHT - 60;
  const BASE_W = 90;
  const PLAYER_BASE_X = 8;
  const ENEMY_BASE_X  = WIDTH - BASE_W - 8;

  // ---- Era definitions ----
  // Each era unlocks new units. Aging up costs the next era's XP
  // threshold; XP comes from kills.
  const ERAS = [
    { id: 'stone',   name: 'Stone Age',     icon: '🪨', sky: ['#3a2e1c', '#544132'], baseColor: '#7a5a3a', upXP:   100 },
    { id: 'medieval',name: 'Medieval',      icon: '🏰', sky: ['#2a3245', '#465268'], baseColor: '#8a8a9c', upXP:   500 },
    { id: 'industrial', name: 'Industrial', icon: '🏭', sky: ['#23202e', '#3d3a52'], baseColor: '#6b6878', upXP:  1500 },
    { id: 'future',  name: 'Future',        icon: '🚀', sky: ['#0c1430', '#22305c'], baseColor: '#88a8ff', upXP:  4000 },
  ];

  // ---- Unit catalog ----
  // Two units per era. `range` is melee if low (~24), ranged if high.
  // `dmg`/`atkSpd` (seconds per attack) tuned so each era 2x-3x the last.
  const UNITS = {
    // Stone Age
    club:      { era: 0, name: 'Clubman',   icon: '🦴', cost: 30,   hp: 50,   dmg: 8,   range: 26,  atkSpd: 0.9, speed: 40, color: '#a07040', xp: 10,  gold: 14 },
    sling:     { era: 0, name: 'Slinger',   icon: '🪃', cost: 60,   hp: 28,   dmg: 14,  range: 130, atkSpd: 1.2, speed: 34, color: '#7a5028', xp: 14,  gold: 22 },
    // Medieval
    swordsman: { era: 1, name: 'Swordsman', icon: '⚔️', cost: 130,  hp: 130,  dmg: 22,  range: 28,  atkSpd: 0.8, speed: 44, color: '#a0a0c0', xp: 30,  gold: 50 },
    archer:    { era: 1, name: 'Archer',    icon: '🏹', cost: 200,  hp: 70,   dmg: 38,  range: 180, atkSpd: 1.3, speed: 38, color: '#b5985a', xp: 38,  gold: 70 },
    // Industrial
    rifleman:  { era: 2, name: 'Rifleman',  icon: '🔫', cost: 380,  hp: 220,  dmg: 75,  range: 220, atkSpd: 0.9, speed: 40, color: '#5d7b3a', xp: 80,  gold: 140 },
    cannoneer: { era: 2, name: 'Cannoneer', icon: '💣', cost: 600,  hp: 320,  dmg: 130, range: 260, atkSpd: 1.8, speed: 32, color: '#4a4030', xp: 130, gold: 230 },
    // Future
    laserTrooper: { era: 3, name: 'Laser Trooper', icon: '🪖', cost: 900,  hp: 450,  dmg: 160, range: 280, atkSpd: 0.7, speed: 42, color: '#6ec4ff', xp: 220, gold: 380 },
    mech:         { era: 3, name: 'Mech',          icon: '🤖', cost: 1500, hp: 900,  dmg: 280, range: 80,  atkSpd: 1.0, speed: 36, color: '#a89cff', xp: 380, gold: 650 },
  };

  // Player can spawn the era's two units; AI can too. The UI lists 6
  // buttons total (2 per era for current + earlier eras up to current).
  function unitsForEra(era) {
    return Object.entries(UNITS).filter(([, u]) => u.era === era).map(([k]) => k);
  }

  // ---- State ----
  let canvas, ctx;
  let rafId = null;
  let lastFrame = 0;
  let running = false, gameOver = false;
  let outcome = null;        // 'win' | 'lose'
  let playerEra = 0;
  let enemyEra = 0;
  let gold = 0, xp = 0;
  let playerBaseHp = 1000, playerBaseMax = 1000;
  let enemyBaseHp  = 1000, enemyBaseMax  = 1000;
  let units = [];            // { side, key, x, hp, hpMax, dmg, range, atkSpd, atkT, speed, color, name, icon, xp, gold, w, h, hit }
  let projectiles = [];      // { side, x, y, vx, dmg, life }
  let nextSpawnId = 1;
  let spawnCooldowns = {};   // unit key -> seconds remaining
  let enemySpawnT = 4.0;
  let goldTrickleT = 0;
  let specialReadyT = 25;    // seconds until "Air Strike" available
  let specialCooldownMax = 25;
  let goldFloaters = [];     // tiny "+$N" floats

  function init() {
    canvas = document.getElementById('aow-canvas');
    if (!canvas) return;
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    ctx = canvas.getContext('2d');
    reset();
    bindControls();
    cancelAnimationFrame(rafId);
    lastFrame = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  function reset() {
    running = true;
    gameOver = false;
    outcome = null;
    playerEra = 0;
    enemyEra = 0;
    gold = 90;
    xp = 0;
    playerBaseHp = playerBaseMax = 1000;
    enemyBaseHp  = enemyBaseMax  = 1000;
    units = [];
    projectiles = [];
    spawnCooldowns = {};
    enemySpawnT = 3.5;
    goldTrickleT = 0;
    specialReadyT = 8;       // first one comes quick
    goldFloaters = [];
    renderHud();
    renderSpawnPanel();
    hideOverlay();
  }

  // ---- Spawning ----
  function spawnUnit(side, key) {
    const def = UNITS[key];
    if (!def) return;
    const u = {
      id: nextSpawnId++,
      side, key,
      name: def.name, icon: def.icon, color: def.color,
      x: side === 'player' ? PLAYER_BASE_X + BASE_W + 10 : ENEMY_BASE_X - 10,
      hp: def.hp, hpMax: def.hp,
      dmg: def.dmg, range: def.range, atkSpd: def.atkSpd, atkT: 0,
      speed: def.speed, xp: def.xp, gold: def.gold,
      w: 18, h: 28,
      hitFlash: 0,
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
    spawnCooldowns[key] = 1.0;
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
    // Base HP also gets a nice bump per age
    const hpBoost = 400;
    playerBaseMax += hpBoost;
    playerBaseHp = Math.min(playerBaseMax, playerBaseHp + hpBoost);
    renderHud();
    renderSpawnPanel();
  }

  function fireSpecial() {
    if (gameOver) return;
    if (specialReadyT > 0) return;
    // Deal heavy damage to all enemy units in the front half of the battlefield.
    const dmg = 200 + playerEra * 200;
    let hit = 0;
    for (const u of units) {
      if (u.side === 'enemy') {
        u.hp -= dmg; u.hitFlash = 0.3; hit++;
      }
    }
    if (hit) addFloater('💥 AIR STRIKE', ENEMY_BASE_X - 60, GROUND_Y - 60, '#ff7733');
    specialReadyT = specialCooldownMax;
    renderHud();
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
      // Number keys 1–8 spawn the corresponding visible unit
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 8) {
        const keys = visibleUnitKeys();
        const key = keys[n - 1];
        if (key) tryPlayerSpawn(key);
      } else if (e.key === ' ') {
        if (gameOver) reset();
        else fireSpecial();
        e.preventDefault();
      } else if (e.key === 'Tab' || e.key === 'q' || e.key === 'Q') {
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
    // Difficulty ramps over time + matches player era as they advance.
    enemySpawnT -= dt;
    if (enemySpawnT > 0) return;
    // Enemy catches up one era at a time once player has surpassed.
    if (enemyEra < playerEra && Math.random() < 0.25) enemyEra++;
    const choices = unitsForEra(enemyEra);
    const key = choices[Math.floor(Math.random() * choices.length)];
    spawnUnit('enemy', key);
    // Slower spawn rate when player is freshly losing, faster as they push.
    const pressureFactor = enemyBaseHp / enemyBaseMax;
    enemySpawnT = 1.6 + Math.random() * 2.0 + pressureFactor * 1.2;
  }

  // ---- Combat loop ----
  function update(dt) {
    if (!running) return;

    // Resource trickle
    goldTrickleT -= dt;
    if (goldTrickleT <= 0) {
      gold += 5 + playerEra * 3;
      goldTrickleT = 1.0;
      renderHud();
    }

    // Spawn cooldowns
    for (const k of Object.keys(spawnCooldowns)) {
      spawnCooldowns[k] = Math.max(0, spawnCooldowns[k] - dt);
    }
    // Special cooldown
    if (specialReadyT > 0) {
      specialReadyT = Math.max(0, specialReadyT - dt);
      renderHud();
    }

    enemyTick(dt);

    // Move & fight units
    for (const u of units) {
      if (u.hp <= 0) continue;
      u.hitFlash = Math.max(0, u.hitFlash - dt);
      const enemies = units.filter(o => o.side !== u.side && o.hp > 0);
      // Closest enemy in the forward direction
      let target = null, bestDist = Infinity;
      for (const e of enemies) {
        const d = Math.abs(e.x - u.x);
        if (d < bestDist) { bestDist = d; target = e; }
      }
      // Also "target" the enemy base if no enemy units between.
      let baseTarget = null;
      if (u.side === 'player') {
        baseTarget = { x: ENEMY_BASE_X, hp: enemyBaseHp };
      } else {
        baseTarget = { x: PLAYER_BASE_X + BASE_W, hp: playerBaseHp };
      }
      // Distance to base
      const baseDx = baseTarget.x - u.x;
      const baseDist = Math.abs(baseDx);
      // Pick whichever is closer.
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

      // Front-line resolution: there might be a friendly directly ahead.
      // If a friendly is in our path and we're behind them, stop.
      const ahead = u.side === 'player'
        ? units.find(o => o.side === u.side && o !== u && o.hp > 0 && o.x > u.x && o.x - u.x < u.w + 4)
        : units.find(o => o.side === u.side && o !== u && o.hp > 0 && o.x < u.x && u.x - o.x < u.w + 4);

      if (dist > u.range) {
        if (!ahead) u.x += dirX * u.speed * dt;
        u.atkT = Math.max(0, u.atkT - dt);
      } else {
        // In range — attack on cooldown
        u.atkT -= dt;
        if (u.atkT <= 0) {
          u.atkT = u.atkSpd;
          if (isBase) {
            if (u.side === 'player') enemyBaseHp -= u.dmg;
            else                     playerBaseHp -= u.dmg;
          } else if (target) {
            // Projectile for ranged, instant for melee
            if (u.range > 60) {
              projectiles.push({
                side: u.side, x: u.x, y: GROUND_Y - u.h * 0.6,
                tx: target.x, ty: GROUND_Y - target.h * 0.6,
                vx: dirX * 320, dmg: u.dmg, life: 1.5, color: u.color,
              });
            } else {
              target.hp -= u.dmg; target.hitFlash = 0.2;
            }
          }
        }
      }
    }

    // Move projectiles + impact
    for (const p of projectiles) {
      p.x += p.vx * dt;
      p.life -= dt;
      // Hit detection: nearest enemy unit overlap, or base
      const targets = units.filter(u => u.side !== p.side && u.hp > 0);
      for (const u of targets) {
        if (Math.abs(u.x - p.x) < (u.w / 2 + 6)) {
          u.hp -= p.dmg; u.hitFlash = 0.2;
          p.life = 0;
          break;
        }
      }
      if (p.life > 0) {
        if (p.side === 'player' && p.x >= ENEMY_BASE_X) {
          enemyBaseHp -= p.dmg; p.life = 0;
        } else if (p.side === 'enemy' && p.x <= PLAYER_BASE_X + BASE_W) {
          playerBaseHp -= p.dmg; p.life = 0;
        }
      }
    }
    projectiles = projectiles.filter(p => p.life > 0);

    // Resolve kills + award gold/xp
    let killGold = 0, killXp = 0;
    let lostXp = 0;
    for (const u of units) {
      if (u.hp <= 0 && !u._dead) {
        u._dead = true;
        if (u.side === 'enemy') { killGold += u.gold; killXp += u.xp; }
        else lostXp += 0;
      }
    }
    if (killGold) gold += killGold;
    if (killXp)   xp += killXp;
    units = units.filter(u => !u._dead);

    // Update gold floaters
    for (const f of goldFloaters) {
      f.t -= dt;
      f.y -= 26 * dt;
    }
    goldFloaters = goldFloaters.filter(f => f.t > 0);

    // End conditions
    if (playerBaseHp <= 0 && !gameOver) {
      gameOver = true; running = false; outcome = 'lose';
      showOverlay(false);
    } else if (enemyBaseHp <= 0 && !gameOver) {
      gameOver = true; running = false; outcome = 'win';
      showOverlay(true);
    }

    renderHud();
  }

  function addFloater(text, x, y, color) {
    goldFloaters.push({ text, x, y, color, t: 1.4 });
  }

  // ---- Drawing ----
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
    // Ground
    ctx.fillStyle = '#1a1a14';
    ctx.fillRect(0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y);
    // Ground line
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(WIDTH, GROUND_Y);
    ctx.stroke();

    // Bases
    drawBase(PLAYER_BASE_X, era.baseColor, era.icon, 'player');
    const eEra = ERAS[enemyEra];
    drawBase(ENEMY_BASE_X, eEra.baseColor, eEra.icon, 'enemy');

    // Base HP bars
    drawBaseHpBar(PLAYER_BASE_X, playerBaseHp, playerBaseMax, '#3FB950');
    drawBaseHpBar(ENEMY_BASE_X, enemyBaseHp, enemyBaseMax, '#F85149');

    // Units
    for (const u of units) drawUnit(u);

    // Projectiles
    for (const p of projectiles) drawProjectile(p);

    // Floaters
    for (const f of goldFloaters) {
      ctx.fillStyle = f.color;
      ctx.font = `700 14px 'JetBrains Mono', monospace`;
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.max(0, f.t / 1.4);
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    }
  }

  function drawBase(x, color, icon, side) {
    // Castle silhouette: body + battlements + flag
    ctx.fillStyle = color;
    ctx.fillRect(x, GROUND_Y - 72, BASE_W, 72);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x, GROUND_Y - 12, BASE_W, 12);
    // Battlements
    ctx.fillStyle = color;
    for (let i = 0; i < 5; i++) {
      const bw = (BASE_W - 10) / 5 - 2;
      ctx.fillRect(x + 5 + i * (bw + 2), GROUND_Y - 84, bw, 12);
    }
    // Door
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x + BASE_W / 2 - 12, GROUND_Y - 36, 24, 36);
    // Era icon over the base
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(icon, x + BASE_W / 2, GROUND_Y - 100);
  }

  function drawBaseHpBar(baseX, hp, max, color) {
    const x = baseX, y = GROUND_Y - 124;
    const w = BASE_W, h = 7;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x, y, w, h);
    const pct = Math.max(0, hp / max);
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, (w - 2) * pct, h - 2);
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(Math.max(0, Math.floor(hp)) + ' / ' + max, x + w / 2, y - 3);
  }

  function drawUnit(u) {
    const y = GROUND_Y - u.h;
    // Body
    ctx.fillStyle = u.hitFlash > 0 ? '#fff' : u.color;
    ctx.fillRect(u.x - u.w / 2, y, u.w, u.h);
    // Head/icon
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(u.icon, u.x, y - 8);
    // Direction marker (thin dark stripe on the front)
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    if (u.side === 'player') ctx.fillRect(u.x + u.w / 2 - 3, y + 2, 3, u.h - 4);
    else                     ctx.fillRect(u.x - u.w / 2,     y + 2, 3, u.h - 4);
    // HP bar
    const barW = u.w + 4;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(u.x - barW / 2, y - 6, barW, 3);
    const pct = Math.max(0, u.hp / u.hpMax);
    ctx.fillStyle = u.side === 'player' ? '#3FB950' : '#F85149';
    ctx.fillRect(u.x - barW / 2 + 0.5, y - 5.5, (barW - 1) * pct, 2);
  }

  function drawProjectile(p) {
    ctx.fillStyle = p.color || '#fcd34d';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- HUD + spawn panel (DOM) ----
  function renderHud() {
    const eraEl = document.getElementById('aow-era');
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
      if (specialReadyT > 0) {
        specEl.textContent = `💥 Air Strike (${Math.ceil(specialReadyT)}s)`;
        specEl.disabled = true;
      } else {
        specEl.textContent = '💥 Air Strike — READY';
        specEl.disabled = false;
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
        `;
        btn.onclick = () => tryPlayerSpawn(key);
        list.appendChild(btn);
        idx++;
      }
    }
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
