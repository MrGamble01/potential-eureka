/* ============================================
   VECTOR STORM — an asteroids-style vector shooter.
   Rotating/thrusting ship with momentum and screen
   wrap, bullets, jagged asteroids that split when
   shot, particle explosions, waves, lives with an
   invulnerable respawn. Keyboard + on-screen touch.
   ============================================ */

const AsteroidsGame = (() => {
  const WIDTH = 720, HEIGHT = 520;
  const SHIP_R = 12;
  const TURN = 0.075, THRUST = 0.13, DRAG = 0.992, MAX_SPEED = 7;
  const BULLET_SPEED = 8, BULLET_LIFE = 52, FIRE_COOLDOWN = 10;
  const SIZES = { 3: 42, 2: 26, 1: 14 };       // radius by tier
  const SCORES = { 3: 20, 2: 50, 1: 100 };

  let canvas, ctx;
  let ship, bullets, rocks, particles;
  let score, high, lives, wave, fireTimer, invuln;
  let running, gameOver;
  let nextLifeAt, lifeFlashUntil = 0, thrustSoundAt = 0;
  let ufo, ufoShots, ufoTimer;                 // hunting saucer + its shots
  const keys = { left: false, right: false, thrust: false };

  const loop = Utils.gameLoop(dt => {
    if (running && !gameOver) update(dt);
    draw();
  });

  function init() {
    canvas = document.getElementById('asteroids-canvas');
    if (!canvas) return;
    // Size the backing store to CSS px * devicePixelRatio for crisp HiDPI
    // rendering; game logic keeps using WIDTH/HEIGHT (CSS/logical) coords.
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = WIDTH * dpr; canvas.height = HEIGHT * dpr;
    canvas.style.width = WIDTH + 'px';
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    high = Utils.highScore.load('asteroids-high');
    resetGame(false);

    document.addEventListener('keydown', Utils.whenViewActive('view-asteroids', onKeyDown));
    document.addEventListener('keyup', onKeyUp);
    // On-screen controls (mobile) — wired by index after render
    bindTouchButtons();
    canvas.addEventListener('touchstart', e => { if (!running || gameOver) start(); e.preventDefault(); }, { passive: false });
    updateInfo();
    draw();
  }

  function onKeyDown(e) {
    switch (e.key) {
      case 'ArrowLeft': case 'a': keys.left = true; e.preventDefault(); break;
      case 'ArrowRight': case 'd': keys.right = true; e.preventDefault(); break;
      case 'ArrowUp': case 'w': keys.thrust = true; e.preventDefault(); break;
      case ' ': if (!running || gameOver) start(); else fire(); e.preventDefault(); break;
    }
  }
  function onKeyUp(e) {
    switch (e.key) {
      case 'ArrowLeft': case 'a': keys.left = false; break;
      case 'ArrowRight': case 'd': keys.right = false; break;
      case 'ArrowUp': case 'w': keys.thrust = false; break;
    }
  }

  function bindTouchButtons() {
    const map = { 'ast-left': 'left', 'ast-right': 'right', 'ast-thrust': 'thrust' };
    Object.keys(map).forEach(id => {
      const el = document.getElementById(id);
      if (!el || el.dataset.bound) return;
      el.dataset.bound = '1';
      const set = v => e => { keys[map[id]] = v; e.preventDefault(); };
      el.addEventListener('touchstart', set(true), { passive: false });
      el.addEventListener('pointerdown', set(true));
      ['touchend', 'touchcancel', 'pointerup', 'pointerleave'].forEach(ev => el.addEventListener(ev, set(false)));
    });
    const fireBtn = document.getElementById('ast-fire');
    if (fireBtn && !fireBtn.dataset.bound) {
      fireBtn.dataset.bound = '1';
      const f = e => { if (!running || gameOver) start(); else fire(); e.preventDefault(); };
      fireBtn.addEventListener('touchstart', f, { passive: false });
      fireBtn.addEventListener('pointerdown', f);
    }
  }

  function resetGame(startRun) {
    ship = { x: WIDTH / 2, y: HEIGHT / 2, a: -Math.PI / 2, vx: 0, vy: 0 };
    bullets = []; particles = [];
    score = 0; lives = 3; wave = 1; fireTimer = 0; invuln = 90;
    nextLifeAt = 10000; lifeFlashUntil = 0;
    ufo = null; ufoShots = []; ufoTimer = 1100 + Math.random() * 500;
    spawnWave();
    running = !!startRun; gameOver = false;
    updateInfo();
  }

  function spawnWave() {
    rocks = [];
    const n = 3 + wave;
    for (let i = 0; i < n; i++) {
      // Spawn away from the ship's center so you aren't hit instantly.
      let x, y;
      do { x = Math.random() * WIDTH; y = Math.random() * HEIGHT; }
      while (Math.hypot(x - WIDTH / 2, y - HEIGHT / 2) < 140);
      rocks.push(makeRock(x, y, 3));
    }
  }

  function makeRock(x, y, tier) {
    const r = SIZES[tier];
    // Rocks drift a little faster on later waves (capped so it stays fair).
    const waveBoost = 1 + Math.min(wave - 1, 10) * 0.06;
    const speed = (0.6 + Math.random() * 1.1) * (4 - tier) * 0.6 * waveBoost;
    const ang = Math.random() * Math.PI * 2;
    const verts = 8 + Math.floor(Math.random() * 5);
    const shape = [];
    for (let i = 0; i < verts; i++) shape.push(0.7 + Math.random() * 0.5);
    return {
      x, y, tier, r,
      vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
      rot: (Math.random() - 0.5) * 0.04, a: 0, shape,
      hue: [190, 265, 330][tier - 1] || 200,
    };
  }

  function start() {
    resetGame(true);
    const ov = document.getElementById('asteroids-overlay');
    if (ov) ov.style.display = 'none';
    loop.start();
  }

  function fire() {
    if (fireTimer > 0 || bullets.length > 6) return;
    fireTimer = FIRE_COOLDOWN;
    bullets.push({
      x: ship.x + Math.cos(ship.a) * SHIP_R,
      y: ship.y + Math.sin(ship.a) * SHIP_R,
      vx: Math.cos(ship.a) * BULLET_SPEED + ship.vx,
      vy: Math.sin(ship.a) * BULLET_SPEED + ship.vy,
      life: BULLET_LIFE,
    });
    sfx('move');
  }

  function wrap(o) {
    if (o.x < 0) o.x += WIDTH; else if (o.x > WIDTH) o.x -= WIDTH;
    if (o.y < 0) o.y += HEIGHT; else if (o.y > HEIGHT) o.y -= HEIGHT;
  }

  function update(dt) {
    if (fireTimer > 0) fireTimer -= dt;
    if (invuln > 0) invuln -= dt;

    if (keys.left) ship.a -= TURN * dt;
    if (keys.right) ship.a += TURN * dt;
    if (keys.thrust) {
      ship.vx += Math.cos(ship.a) * THRUST * dt;
      ship.vy += Math.sin(ship.a) * THRUST * dt;
      // Throttled so the whoosh repeats without stacking every frame.
      const tNow = performance.now();
      if (tNow - thrustSoundAt > 120) { thrustSoundAt = tNow; sfx('thrust'); }
      if (Math.random() < 0.5) particles.push({
        x: ship.x - Math.cos(ship.a) * SHIP_R, y: ship.y - Math.sin(ship.a) * SHIP_R,
        vx: -Math.cos(ship.a) * 2 + (Math.random() - 0.5), vy: -Math.sin(ship.a) * 2 + (Math.random() - 0.5),
        life: 12, color: '#F0883E',
      });
    }
    const sp = Math.hypot(ship.vx, ship.vy);
    if (sp > MAX_SPEED) { ship.vx *= MAX_SPEED / sp; ship.vy *= MAX_SPEED / sp; }
    ship.vx *= DRAG; ship.vy *= DRAG;
    ship.x += ship.vx * dt; ship.y += ship.vy * dt; wrap(ship);

    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; wrap(b);
      if (b.life <= 0) { bullets.splice(i, 1); continue; }
      if (ufo && Math.hypot(b.x - ufo.x, b.y - ufo.y) < 17) {
        bullets.splice(i, 1);
        destroyUfo();
        continue;
      }
      for (let j = rocks.length - 1; j >= 0; j--) {
        const r = rocks[j];
        if (Math.hypot(b.x - r.x, b.y - r.y) < r.r + 2.5) { // +bullet radius so grazing spikes still count
          bullets.splice(i, 1);
          destroyRock(j);
          break;
        }
      }
    }

    for (const r of rocks) { r.x += r.vx * dt; r.y += r.vy * dt; r.a += r.rot * dt; wrap(r); }

    // ---- UFO saucer: crosses the field hunting the player ----
    if (!ufo) {
      ufoTimer -= dt;
      if (ufoTimer <= 0) spawnUfo();
    } else {
      ufo.x += ufo.vx * dt;
      ufo.wob += dt * 0.045;
      ufo.y = ufo.baseY + Math.sin(ufo.wob) * 26;
      ufo.fireT -= dt;
      if (ufo.fireT <= 0) {
        ufo.fireT = ufo.fireEvery;
        // Aimed at the ship, with a spread that tightens on later waves.
        const aim = Math.atan2(ship.y - ufo.y, ship.x - ufo.x) + (Math.random() - 0.5) * ufo.spread;
        ufoShots.push({ x: ufo.x, y: ufo.y + 5, vx: Math.cos(aim) * 3.1, vy: Math.sin(aim) * 3.1, life: 200 });
        sfx('rotate');
      }
      if (ufo.x < -46 || ufo.x > WIDTH + 46) { ufo = null; ufoTimer = 1000 + Math.random() * 700; }
    }
    for (let i = ufoShots.length - 1; i >= 0; i--) {
      const s = ufoShots[i];
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (s.life <= 0 || s.x < -10 || s.x > WIDTH + 10 || s.y < -10 || s.y > HEIGHT + 10) {
        ufoShots.splice(i, 1); continue;
      }
      if (invuln <= 0 && Math.hypot(ship.x - s.x, ship.y - s.y) < SHIP_R * 0.8 + 3) {
        ufoShots.splice(i, 1);
        loseLife();
      }
    }
    if (ufo && invuln <= 0 && Math.hypot(ship.x - ufo.x, ship.y - ufo.y) < 16 + SHIP_R * 0.7) loseLife();

    // ship vs rocks
    if (invuln <= 0) {
      for (const r of rocks) {
        if (Math.hypot(ship.x - r.x, ship.y - r.y) < r.r + SHIP_R * 0.7) { loseLife(); break; }
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    if (rocks.length === 0) { wave++; sfx('clear'); invuln = Math.max(invuln, 60); spawnWave(); }
  }

  function destroyRock(j) {
    const r = rocks[j];
    score += SCORES[r.tier];
    high = Utils.highScore.save('asteroids-high', score, high);
    burst(r.x, r.y, r.tier, 'hsl(' + r.hue + ',80%,65%)');
    sfx(r.tier === 1 ? 'bonus' : 'eat');
    Effects.shakeCanvas(canvas, 1.5 + r.tier * 1.5, 90 + r.tier * 50);
    // Extra life every 10,000 points.
    if (score >= nextLifeAt) {
      nextLifeAt += 10000;
      lives++;
      sfx('bonus');
      lifeFlashUntil = performance.now() + 1400;
      burst(ship.x, ship.y, 2, '#3FB950');
    }
    rocks.splice(j, 1);
    if (r.tier > 1) {
      for (let k = 0; k < 2; k++) rocks.push(makeRock(r.x, r.y, r.tier - 1));
    }
    updateInfo();
  }

  function spawnUfo() {
    const fromLeft = Math.random() < 0.5;
    ufo = {
      x: fromLeft ? -36 : WIDTH + 36,
      baseY: 50 + Math.random() * (HEIGHT - 130),
      y: 0, wob: Math.random() * 9,
      vx: (fromLeft ? 1 : -1) * (1.1 + Math.min(wave, 10) * 0.06),
      fireEvery: Math.max(70, 130 - wave * 5),
      fireT: 70,
      spread: Math.max(0.12, 0.65 - wave * 0.05),
    };
    ufo.y = ufo.baseY;
    sfx('bonus');
  }

  function destroyUfo() {
    score += 200 + wave * 25;
    high = Utils.highScore.save('asteroids-high', score, high);
    burst(ufo.x, ufo.y, 3, '#F778BA');
    sfx('clear');
    Effects.shakeCanvas(canvas, 6, 260);
    ufo = null;
    ufoTimer = 1100 + Math.random() * 800;
    updateInfo();
  }

  function burst(x, y, tier, color) {
    const n = 8 + tier * 4;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 16 + Math.random() * 16, color });
    }
  }

  function loseLife() {
    lives--;
    burst(ship.x, ship.y, 3, '#22d3ee');
    sfx('die');
    Effects.shakeCanvas(canvas, 10, 400);
    if (lives <= 0) { endGame(); return; }
    ship.x = WIDTH / 2; ship.y = HEIGHT / 2; ship.vx = ship.vy = 0; ship.a = -Math.PI / 2;
    invuln = 100;
    updateInfo();
  }

  function endGame() {
    running = false; gameOver = true;
    sfx('over');
    high = Utils.highScore.save('asteroids-high', score, high);
    Utils.showGameOver('asteroids-overlay', {
      lines: ['Score: ' + score + ' &nbsp;·&nbsp; Wave: ' + wave],
      hint: 'Press Space or tap to play again',
    });
    updateInfo();
  }

  const sfx = Utils.sfx;

  function updateInfo() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('asteroids-score', score);
    set('asteroids-high', high);
    set('asteroids-wave', wave);
    set('asteroids-lives', '▲'.repeat(Math.max(0, lives)) || '—');
  }

  function draw() {
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // starfield-ish dots
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 40; i++) ctx.fillRect((i * 137) % WIDTH, (i * 89) % HEIGHT, 1, 1);

    // particles
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 20));
      ctx.fillStyle = p.color; ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    }
    ctx.globalAlpha = 1;

    // rocks
    ctx.lineWidth = 2;
    for (const r of rocks) {
      ctx.strokeStyle = 'hsl(' + r.hue + ',75%,62%)';
      ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 8;
      ctx.beginPath();
      for (let i = 0; i < r.shape.length; i++) {
        const ang = r.a + (i / r.shape.length) * Math.PI * 2;
        const rr = r.r * r.shape[i];
        const x = r.x + Math.cos(ang) * rr, y = r.y + Math.sin(ang) * rr;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // bullets
    ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 8;
    for (const b of bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2); ctx.fill(); }
    ctx.shadowBlur = 0;

    // UFO saucer + its shots
    if (ufo) {
      ctx.save();
      ctx.translate(ufo.x, ufo.y);
      ctx.strokeStyle = '#F778BA'; ctx.shadowColor = '#F778BA'; ctx.shadowBlur = 10; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, 16, 6, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -4, 7, Math.PI, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(16, 0); ctx.stroke();
      ctx.restore();
      ctx.shadowBlur = 0;
    }
    ctx.fillStyle = '#F778BA'; ctx.shadowColor = '#F778BA'; ctx.shadowBlur = 8;
    for (const s of ufoShots) { ctx.beginPath(); ctx.arc(s.x, s.y, 2.2, 0, Math.PI * 2); ctx.fill(); }
    ctx.shadowBlur = 0;

    // ship (blink while invulnerable)
    if (running && (invuln <= 0 || Math.floor(invuln / 6) % 2 === 0)) {
      ctx.save();
      ctx.translate(ship.x, ship.y); ctx.rotate(ship.a);
      ctx.strokeStyle = '#22d3ee'; ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 12; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(SHIP_R, 0);
      ctx.lineTo(-SHIP_R * 0.8, -SHIP_R * 0.7);
      ctx.lineTo(-SHIP_R * 0.4, 0);
      ctx.lineTo(-SHIP_R * 0.8, SHIP_R * 0.7);
      ctx.closePath(); ctx.stroke();
      ctx.restore();
      ctx.shadowBlur = 0;
    }

    // Extra-life callout
    if (lifeFlashUntil > performance.now()) {
      ctx.fillStyle = '#3FB950'; ctx.shadowColor = '#3FB950'; ctx.shadowBlur = 10;
      ctx.font = 'bold 18px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText('EXTRA LIFE!', WIDTH / 2, 56);
      ctx.shadowBlur = 0; ctx.textAlign = 'left';
    }

    if (!running && !gameOver) {
      ctx.fillStyle = 'rgba(13,17,23,0.72)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = '#E6EDF3'; ctx.textAlign = 'center';
      ctx.font = 'bold 22px JetBrains Mono, monospace';
      ctx.fillText('VECTOR STORM', WIDTH / 2, HEIGHT / 2 - 14);
      ctx.font = '13px Inter, sans-serif'; ctx.fillStyle = '#7D8590';
      ctx.fillText('Rotate ← → · thrust ↑ · fire Space  (buttons on touch)', WIDTH / 2, HEIGHT / 2 + 12);
      ctx.fillText('Click or tap to start', WIDTH / 2, HEIGHT / 2 + 34);
      ctx.textAlign = 'left';
    }
  }

  function destroy() {
    loop.stop();
    keys.left = keys.right = keys.thrust = false;
    // Shell re-inits a view only once and won't redraw on return — paint the
    // idle start screen now so returning doesn't show a frozen frame.
    running = false; gameOver = false;
    const ov = document.getElementById('asteroids-overlay'); if (ov) ov.style.display = 'none';
    draw();
  }

  return { init, start, destroy };
})();
