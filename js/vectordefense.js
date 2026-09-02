/* ============================================
   VECTOR DEFENSE — tower defense in Vector
   Storm's wireframe idiom. Raiders crawl a
   fixed neon path; you buy turrets on the pads
   beside it. Two turrets, ten waves, ten lives:
   ⚡ Pulse — cheap, fast, short reach.
   ▭ Rail — pricey, slow, hits everything on
   its line clear across the field.
   Scope is deliberately capped (ARC-7): a tight
   ten-wave arcade run, not an idle sprawl.
   ============================================ */

const VectorDefenseGame = (() => {
  const WIDTH = 640, HEIGHT = 480;

  // Fixed S-path as waypoints (enemies lerp segment to segment).
  const PATH = [
    { x: -20, y: 80 }, { x: 520, y: 80 }, { x: 520, y: 220 },
    { x: 120, y: 220 }, { x: 120, y: 360 }, { x: 660, y: 360 },
  ];
  // Build pads flanking the path.
  const PADS = [
    { x: 200, y: 150 }, { x: 360, y: 150 }, { x: 560, y: 150 },
    { x: 440, y: 290 }, { x: 260, y: 290 }, { x: 60, y: 290 },
    { x: 200, y: 430 }, { x: 400, y: 430 }, { x: 560, y: 430 },
  ];
  const TURRETS = {
    pulse: { name: 'Pulse', glyph: '⚡', cost: 50, range: 95, dmg: 12, cd: 0.45, color: '#22d3ee' },
    rail:  { name: 'Rail',  glyph: '▭', cost: 120, range: 9999, dmg: 34, cd: 1.6, color: '#F778BA' },
  };
  const WAVES = 10;

  let canvas, ctx, loop;
  let towers, enemies, shots, sparks;
  let cash, lives, wave, waveT, spawnQueue, spawnT, betweenWaves;
  let running, over, won, best, selectedKind, railBeams;
  let selectedTower = null;   // P4: owned pad selected for upgrade/sell
  const sfx = Utils.sfx;

  // Path bookkeeping: total length + point at distance d.
  const segLens = [];
  let pathLen = 0;
  (() => {
    for (let i = 0; i < PATH.length - 1; i++) {
      const l = Math.hypot(PATH[i + 1].x - PATH[i].x, PATH[i + 1].y - PATH[i].y);
      segLens.push(l); pathLen += l;
    }
  })();
  function pointAt(d) {
    let rem = d;
    for (let i = 0; i < segLens.length; i++) {
      if (rem <= segLens[i]) {
        const t = rem / segLens[i];
        return { x: PATH[i].x + (PATH[i + 1].x - PATH[i].x) * t,
                 y: PATH[i].y + (PATH[i + 1].y - PATH[i].y) * t };
      }
      rem -= segLens[i];
    }
    return PATH[PATH.length - 1];
  }

  function init() {
    canvas = document.getElementById('vd-canvas');
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;
    canvas.style.width = '100%';
    canvas.style.maxWidth = WIDTH + 'px';
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    best = Utils.highScore.load('vector-best');
    reset(false);
    updateInfo();

    document.addEventListener('keydown', Utils.whenViewActive('view-vectordefense', e => {
      if (e.key === ' ') {
        e.preventDefault();
        if (e.repeat) return;
        if (!running || over) start();
        else if (betweenWaves) launchWave();
      }
      if (e.key === '1') selectKind('pulse');
      if (e.key === '2') selectKind('rail');
    }));

    canvas.addEventListener('click', e => {
      if (!running || over) { start(); return; }
      const r = canvas.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width * WIDTH;
      const y = (e.clientY - r.top) / r.height * HEIGHT;
      // Pad hit?
      for (const pad of PADS) {
        if (Math.hypot(x - pad.x, y - pad.y) < 22) { buyAt(pad); return; }
      }
      selectTower(null);
      if (betweenWaves) launchWave();
    });
    const ov = document.getElementById('vd-overlay');
    if (ov) ov.addEventListener('click', () => { if (!running || over) start(); });

    const pulseBtn = document.getElementById('vd-pulse-btn');
    const railBtn = document.getElementById('vd-rail-btn');
    if (pulseBtn) pulseBtn.addEventListener('click', () => selectKind('pulse'));
    if (railBtn) railBtn.addEventListener('click', () => selectKind('rail'));
    const upgBtn = document.getElementById('vd-upg-btn');
    const sellBtn = document.getElementById('vd-sell-btn');
    if (upgBtn) upgBtn.addEventListener('click', upgradeSelected);
    if (sellBtn) sellBtn.addEventListener('click', sellSelected);

    loop = Utils.gameLoop(tick);
    draw();
  }

  function selectKind(k) {
    selectedKind = k;
    const pb = document.getElementById('vd-pulse-btn'), rb = document.getElementById('vd-rail-btn');
    if (pb) pb.classList.toggle('active', k === 'pulse');
    if (rb) rb.classList.toggle('active', k === 'rail');
  }

  function reset(run) {
    towers = [];
    enemies = [];
    shots = [];
    sparks = [];
    railBeams = [];
    cash = 120;
    lives = 10;
    wave = 0;
    spawnQueue = 0;
    spawnT = 0;
    betweenWaves = true;
    over = false; won = false;
    running = !!run;
    selectKind('pulse');
    selectTower(null);
  }

  function start() {
    reset(true);
    sfx('start');
    const ov = document.getElementById('vd-overlay');
    if (ov) ov.style.display = 'none';
    updateInfo();
    loop.start();
  }

  // P4 turret management: tiers 1-3 (+40% damage each, pulse also +12%
  // range), sell refunds 70% of everything spent on the pad.
  const MAX_TIER = 3;
  function tierDmg(t) { return TURRETS[t.kind].dmg * Math.pow(1.4, t.tier - 1); }
  function tierRange(t) {
    const r = TURRETS[t.kind].range;
    return t.kind === 'pulse' ? r * Math.pow(1.12, t.tier - 1) : r;
  }
  function upgradeCost(t) { return Math.round(TURRETS[t.kind].cost * 0.8 * Math.pow(1.8, t.tier - 1)); }
  function sellValue(t) { return Math.round(t.spent * 0.7); }

  function buyAt(pad) {
    const existing = towers.find(t => t.pad === pad);
    if (existing) { selectTower(existing); return; }   // owned pad → manage it
    const def = TURRETS[selectedKind];
    if (cash < def.cost) { blip(180); return; }
    cash -= def.cost;
    towers.push({ pad, kind: selectedKind, cd: 0, tier: 1, spent: def.cost });
    selectTower(null);
    sfx('lock');
    updateInfo();
  }

  function selectTower(t) {
    selectedTower = t;
    const upg = document.getElementById('vd-upg-btn');
    const sell = document.getElementById('vd-sell-btn');
    if (!upg || !sell) return;
    if (!t) { upg.hidden = true; sell.hidden = true; return; }
    upg.hidden = false; sell.hidden = false;
    upg.textContent = t.tier >= MAX_TIER ? '★ Max tier' : `⬆ Upgrade $${upgradeCost(t)}`;
    upg.disabled = t.tier >= MAX_TIER || cash < upgradeCost(t);
    sell.textContent = `♻ Sell +$${sellValue(t)}`;
  }
  function upgradeSelected() {
    const t = selectedTower;
    if (!t || t.tier >= MAX_TIER) return;
    const cost = upgradeCost(t);
    if (cash < cost) { blip(180); return; }
    cash -= cost;
    t.spent += cost;
    t.tier++;
    sfx('bonus');
    selectTower(t);
    updateInfo();
  }
  function sellSelected() {
    const t = selectedTower;
    if (!t) return;
    cash += sellValue(t);
    towers.splice(towers.indexOf(t), 1);
    selectTower(null);
    sfx('lock');
    updateInfo();
  }

  function launchWave() {
    if (!betweenWaves || over) return;
    wave++;
    betweenWaves = false;
    spawnQueue = 5 + wave * 2;
    spawnT = 0;
    sfx('start');
    updateInfo();
  }

  function enemyStats(w) {
    return {
      hp: Math.round(26 * Math.pow(1.32, w - 1)),
      speed: 46 + w * 3.5,
      bounty: 8 + w,
      verts: 3 + (w % 5),
    };
  }

  function blip(freq) { if (typeof SFX !== 'undefined' && SFX.note) SFX.note(freq, 0.06); }

  function tick(dt) {
    if (!running || over) return;
    const secs = dt / 60;   // Utils.gameLoop dt is in 60ths

    // Spawning
    if (!betweenWaves && spawnQueue > 0) {
      spawnT -= secs;
      if (spawnT <= 0) {
        spawnT = Math.max(0.35, 1.0 - wave * 0.05);
        const st = enemyStats(wave);
        enemies.push({ d: 0, hp: st.hp, hpMax: st.hp, speed: st.speed,
          bounty: st.bounty, verts: st.verts, rot: 0, vrot: (Math.random() - 0.5) * 3 });
        spawnQueue--;
      }
    }

    // Enemies crawl
    for (let i = enemies.length - 1; i >= 0; i--) {
      const en = enemies[i];
      en.d += en.speed * secs;
      en.rot += en.vrot * secs;
      if (en.d >= pathLen) {
        enemies.splice(i, 1);
        lives--;
        sfx('die');
        Effects.shakeCanvas(canvas, 6, 220);
        updateInfo();
        if (lives <= 0) { endGame(false); return; }
      }
    }

    // Towers fire
    for (const t of towers) {
      t.cd -= secs;
      if (t.cd > 0) continue;
      const def = TURRETS[t.kind];
      if (t.kind === 'pulse') {
        let target = null, bestD = Infinity;
        for (const en of enemies) {
          const p = pointAt(en.d);
          const dist = Math.hypot(p.x - t.pad.x, p.y - t.pad.y);
          if (dist <= tierRange(t) && pathLen - en.d < bestD) { bestD = pathLen - en.d; target = en; }
        }
        if (target) {
          t.cd = def.cd;
          const p = pointAt(target.d);
          shots.push({ x: t.pad.x, y: t.pad.y, tx: p.x, ty: p.y, target, life: 0.09 });
          hit(target, tierDmg(t), p);
          blip(700);
        }
      } else {
        // Rail: fires along its row — damages every enemy within the beam band.
        let any = false;
        for (const en of enemies) {
          const p = pointAt(en.d);
          if (Math.abs(p.y - t.pad.y) < 26 || Math.abs(p.x - t.pad.x) < 26) { any = true; break; }
        }
        if (any) {
          t.cd = def.cd;
          railBeams.push({ x: t.pad.x, y: t.pad.y, life: 0.14 });
          for (let i = enemies.length - 1; i >= 0; i--) {
            const en = enemies[i];
            const p = pointAt(en.d);
            if (Math.abs(p.y - t.pad.y) < 26 || Math.abs(p.x - t.pad.x) < 26) hit(en, tierDmg(t), p);
          }
          blip(220);
        }
      }
    }

    // Effects decay
    for (let i = shots.length - 1; i >= 0; i--) { shots[i].life -= secs; if (shots[i].life <= 0) shots.splice(i, 1); }
    for (let i = railBeams.length - 1; i >= 0; i--) { railBeams[i].life -= secs; if (railBeams[i].life <= 0) railBeams.splice(i, 1); }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx * secs * 60; s.y += s.vy * secs * 60; s.life -= dt;
      if (s.life <= 0) sparks.splice(i, 1);
    }

    // Wave cleared?
    if (!betweenWaves && spawnQueue === 0 && enemies.length === 0) {
      if (wave >= WAVES) { endGame(true); return; }
      betweenWaves = true;
      cash += 40 + wave * 6;   // clear bonus
      sfx('bonus');
      updateInfo();
    }

    draw();
  }

  function hit(en, dmg, p) {
    en.hp -= dmg;
    if (en.hp <= 0) {
      const idx = enemies.indexOf(en);
      if (idx >= 0) enemies.splice(idx, 1);
      cash += en.bounty;
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2.5;
        sparks.push({ x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 16 + Math.random() * 10 });
      }
      sfx('eat');
      updateInfo();
    }
  }

  function endGame(win) {
    over = true; won = win;
    running = false;
    loop.stop();
    sfx(win ? 'clear' : 'over');
    const cleared = win ? WAVES : wave - (betweenWaves ? 0 : 1);
    best = Utils.highScore.save('vector-best', Math.max(0, cleared), best);
    updateInfo();
    draw();
    Utils.showGameOver('vd-overlay', {
      lines: [win ? '<strong style="color:#3FB950">GRID DEFENDED</strong>' : 'The raiders got through.',
              `Waves cleared: ${Math.max(0, cleared)} / ${WAVES} &nbsp;·&nbsp; Best: ${best}`],
      hint: 'Press SPACE or tap to play again',
    });
  }

  function updateInfo() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('vd-cash', '$' + cash);
    set('vd-lives', lives);
    set('vd-wave', `${wave} / ${WAVES}`);
    set('vd-best', best);
  }

  function draw() {
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // The path — glowing vector road
    ctx.strokeStyle = 'rgba(108, 99, 255, 0.65)';
    ctx.lineWidth = 22;
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.16;
    ctx.beginPath();
    ctx.moveTo(PATH[0].x, PATH[0].y);
    for (const p of PATH.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(139, 131, 255, 0.8)';
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(PATH[0].x, PATH[0].y);
    for (const p of PATH.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Pads
    for (const pad of PADS) {
      const t = towers.find(tt => tt.pad === pad);
      ctx.strokeStyle = t ? TURRETS[t.kind].color : 'rgba(255,255,255,0.25)';
      ctx.lineWidth = t ? 2 : 1;
      ctx.strokeRect(pad.x - 14, pad.y - 14, 28, 28);
      if (t) {
        const def = TURRETS[t.kind];
        ctx.fillStyle = def.color;
        ctx.font = 'bold 15px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(def.glyph, pad.x, pad.y + 5);
        ctx.textAlign = 'left';
        if (t.kind === 'pulse') {
          ctx.globalAlpha = t === selectedTower ? 0.22 : 0.07;
          ctx.beginPath(); ctx.arc(pad.x, pad.y, tierRange(t), 0, Math.PI * 2);
          ctx.strokeStyle = def.color; ctx.stroke();
          ctx.globalAlpha = 1;
        }
        // Tier pips under the pad
        for (let i = 0; i < t.tier - 1; i++) {
          ctx.fillStyle = '#F7C948';
          ctx.fillRect(pad.x - 8 + i * 8, pad.y + 17, 5, 3);
        }
        if (t === selectedTower) {
          ctx.strokeStyle = '#F7C948';
          ctx.lineWidth = 2;
          ctx.strokeRect(pad.x - 17, pad.y - 17, 34, 34);
        }
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('+', pad.x, pad.y + 3);
        ctx.textAlign = 'left';
      }
    }

    // Rail beams
    for (const b of railBeams) {
      ctx.globalAlpha = Math.min(1, b.life / 0.14);
      ctx.strokeStyle = '#F778BA';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, b.y); ctx.lineTo(WIDTH, b.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(b.x, 0); ctx.lineTo(b.x, HEIGHT); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Shots
    ctx.lineWidth = 2;
    for (const s of shots) {
      ctx.globalAlpha = Math.min(1, s.life / 0.09);
      ctx.strokeStyle = '#22d3ee';
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.tx, s.ty); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Enemies — rotating wireframe polygons, HP as brightness
    for (const en of enemies) {
      const p = pointAt(en.d);
      const r = 9 + en.verts;
      const frac = en.hp / en.hpMax;
      ctx.strokeStyle = `hsl(${330 - frac * 120}, 85%, ${45 + frac * 25}%)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= en.verts; i++) {
        const a = en.rot + i / en.verts * Math.PI * 2;
        const px = p.x + Math.cos(a) * r, py = p.y + Math.sin(a) * r;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // Sparks
    for (const s of sparks) {
      ctx.globalAlpha = Math.max(0, s.life / 24);
      ctx.fillStyle = '#F7C948';
      ctx.fillRect(s.x - 1.5, s.y - 1.5, 3, 3);
      ctx.globalAlpha = 1;
    }

    // State text
    ctx.textAlign = 'center';
    if (running && betweenWaves && !over) {
      ctx.fillStyle = '#3FB950';
      ctx.font = '800 15px Inter, sans-serif';
      ctx.fillText(wave === 0 ? 'Build turrets, then press SPACE to start wave 1'
                              : `Wave ${wave} cleared — SPACE for wave ${wave + 1}`, WIDTH / 2, 30);
    }
    if (!running && !over) {
      ctx.fillStyle = 'rgba(13,17,23,0.72)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = '#E6EDF3';
      ctx.font = '20px Inter, sans-serif';
      ctx.fillText('Press SPACE or tap to defend the grid', WIDTH / 2, HEIGHT / 2 - 12);
      ctx.font = '12px Inter, sans-serif';
      ctx.fillStyle = '#7D8590';
      ctx.fillText('Click pads to build · 1 = ⚡ Pulse ($50) · 2 = ▭ Rail ($120) · 10 waves', WIDTH / 2, HEIGHT / 2 + 14);
    }
    ctx.textAlign = 'left';
  }

  function destroy() {
    if (loop) loop.stop();
    running = false; over = false;
    const ov = document.getElementById('vd-overlay'); if (ov) ov.style.display = 'none';
    reset(false);
    // reset() rolls cash/lives/wave back to their pre-run values — repaint the
    // HUD too, or the info bar keeps quoting the run you just walked away from.
    updateInfo();
    draw();
  }

  return { init, start, destroy };
})();
