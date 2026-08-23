/* ============================================
   STACKER — the arcade-cabinet timing tower.
   A block slides back and forth; drop it on the
   stack. Whatever hangs over the edge is sliced
   off, the remainder becomes your next platform,
   and the slide speeds up as the tower climbs.
   Land a PERFECT (within a couple of pixels) and
   the block snaps flush with a bonus. Run ends
   when the whole block misses.
   ============================================ */

const StackerGame = (() => {
  const WIDTH = 420, HEIGHT = 560;
  const BLOCK_H = 26;             // one floor
  const BASE_W = 180;             // starting platform width
  const PERFECT_TOL = 5;          // px snap window
  const CAMERA_ROWS = 12;         // floors visible before the view slides

  let canvas, ctx, loop;
  let stack, current, floors, best, running, over, perfectStreak;
  let cameraY, flashT, particles;
  const sfx = Utils.sfx;

  const hue = i => (200 + i * 14) % 360;

  function init() {
    canvas = document.getElementById('stacker-canvas');
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;
    canvas.style.width = '100%';
    canvas.style.maxWidth = WIDTH + 'px';
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    best = Utils.highScore.load('stacker-best');
    reset(false);
    updateInfo();

    document.addEventListener('keydown', Utils.whenViewActive('view-stacker', e => {
      if (e.key === ' ' || e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        if (e.repeat) return;
        if (!running || over) start();
        else drop();
      }
    }));
    canvas.addEventListener('pointerdown', () => { (!running || over) ? start() : drop(); });
    const ov = document.getElementById('stacker-overlay');
    if (ov) ov.addEventListener('click', () => { if (!running || over) start(); });

    loop = Utils.gameLoop(tick);
    draw();
  }

  function reset(run) {
    stack = [{ x: (WIDTH - BASE_W) / 2, w: BASE_W }];
    floors = 0;
    perfectStreak = 0;
    cameraY = 0;
    flashT = 0;
    particles = [];
    over = false;
    running = !!run;
    spawnBlock();
  }

  function speedFor(floor) { return Math.min(7.5, 2.2 + floor * 0.18); }

  function spawnBlock() {
    const top = stack[stack.length - 1];
    const fromLeft = stack.length % 2 === 1;
    current = {
      w: top.w,
      x: fromLeft ? -top.w : WIDTH,
      dir: fromLeft ? 1 : -1,
      speed: speedFor(floors),
    };
  }

  function start() {
    reset(true);
    sfx('start');
    const ov = document.getElementById('stacker-overlay');
    if (ov) ov.style.display = 'none';
    updateInfo();
    loop.start();
  }

  function drop() {
    if (!running || over || !current) return;
    const top = stack[stack.length - 1];
    const left = Math.max(current.x, top.x);
    const right = Math.min(current.x + current.w, top.x + top.w);
    let width = right - left;

    if (width <= 0) { endGame(); return; }

    let x = left;
    const offset = Math.abs(current.x - top.x);
    if (offset <= PERFECT_TOL) {
      // PERFECT: snap flush, keep the full width, small reward pulse.
      x = top.x; width = top.w;
      perfectStreak++;
      flashT = 0.35;
      if (typeof SFX !== 'undefined' && SFX.note) SFX.note(660 + Math.min(6, perfectStreak) * 80, 0.12);
      burst(x + width / 2, HEIGHT - (stack.length + 1) * BLOCK_H + cameraY, '#F7C948', 18);
    } else {
      perfectStreak = 0;
      // Slice: the overhang tumbles away as debris.
      const cutW = current.w - width;
      const cutX = current.x < top.x ? current.x : top.x + top.w;
      debris(cutX, cutW, stack.length);
      sfx('lock');
    }

    stack.push({ x, w: width });
    floors++;
    updateInfo();

    // Camera follows once the tower outgrows the view.
    const towerTop = (stack.length + 1) * BLOCK_H;
    if (towerTop > CAMERA_ROWS * BLOCK_H) cameraY = towerTop - CAMERA_ROWS * BLOCK_H;

    if (width < 6) { endGame(); return; }  // sliver towers end with dignity
    spawnBlock();
  }

  function debris(x, w, row) {
    particles.push({
      kind: 'slab', x, w, y: HEIGHT - (row + 1) * BLOCK_H + cameraY,
      vy: -1.2, vx: x < WIDTH / 2 ? -1.6 : 1.6, rot: 0,
      vrot: (Math.random() - 0.5) * 0.12, life: 40, hue: hue(row),
    });
  }
  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3;
      particles.push({ kind: 'dot', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: 22 + Math.random() * 14, color });
    }
  }

  function endGame() {
    over = true;
    running = false;
    loop.stop();
    sfx('over');
    Effects.shakeCanvas(canvas, 8, 300);
    best = Utils.highScore.save('stacker-best', floors, best);
    updateInfo();
    draw();
    Utils.showGameOver('stacker-overlay', {
      lines: [`Height: ${floors} floor${floors === 1 ? '' : 's'} &nbsp;·&nbsp; Best: ${best}`],
      hint: 'Press SPACE or tap to build again',
    });
  }

  function tick(dt) {
    if (!running || over) return;
    if (current) {
      current.x += current.dir * current.speed * dt;
      // Bounce at the walls (with the block fully off-screen as margin
      // so the entry swing reads naturally).
      if (current.dir > 0 && current.x > WIDTH - current.w * 0.15) current.dir = -1;
      if (current.dir < 0 && current.x < -current.w * 0.85) current.dir = 1;
    }
    if (flashT > 0) flashT -= dt / 60;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt;
      p.vy = (p.vy || 0) + 0.15 * dt;
      if (p.kind === 'slab') p.rot += p.vrot * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    draw();
  }

  function drawBlock(x, y, w, i, alpha) {
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = `hsl(${hue(i)}, 65%, 55%)`;
    ctx.fillRect(x, y, w, BLOCK_H - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x, y, w, 5);
    ctx.globalAlpha = 1;
  }

  function draw() {
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    if (flashT > 0) {
      ctx.fillStyle = `rgba(247, 201, 72, ${flashT * 0.35})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    // The tower
    for (let i = 0; i < stack.length; i++) {
      const y = HEIGHT - (i + 1) * BLOCK_H + cameraY;
      if (y > HEIGHT || y < -BLOCK_H) continue;
      drawBlock(stack[i].x, y, stack[i].w, i);
    }
    // The slider
    if (current && running && !over) {
      const y = HEIGHT - (stack.length + 1) * BLOCK_H + cameraY;
      drawBlock(current.x, y, current.w, stack.length);
    }

    // Debris + sparks
    for (const p of particles) {
      if (p.kind === 'slab') {
        ctx.save();
        ctx.translate(p.x + p.w / 2, p.y + BLOCK_H / 2);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, p.life / 40);
        ctx.fillStyle = `hsl(${p.hue}, 55%, 42%)`;
        ctx.fillRect(-p.w / 2, -BLOCK_H / 2, p.w, BLOCK_H - 2);
        ctx.restore();
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = Math.max(0, p.life / 30);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
        ctx.globalAlpha = 1;
      }
    }

    if (perfectStreak >= 2) {
      ctx.fillStyle = '#F7C948';
      ctx.font = '800 15px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`PERFECT ×${perfectStreak}`, WIDTH / 2, 34);
      ctx.textAlign = 'left';
    }

    if (!running && !over) {
      ctx.fillStyle = 'rgba(13,17,23,0.72)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = '#E6EDF3';
      ctx.font = '20px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Press SPACE or tap to stack', WIDTH / 2, HEIGHT / 2 - 12);
      ctx.font = '12px Inter, sans-serif';
      ctx.fillStyle = '#7D8590';
      ctx.fillText('Drop the slider on the tower — overhangs get sliced off', WIDTH / 2, HEIGHT / 2 + 14);
      ctx.textAlign = 'left';
    }
  }

  function updateInfo() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('stacker-height', floors);
    set('stacker-best', best);
    set('stacker-width', current ? Math.round(stack[stack.length - 1].w) : BASE_W);
  }

  function destroy() {
    if (loop) loop.stop();
    running = false; over = false;
    const ov = document.getElementById('stacker-overlay'); if (ov) ov.style.display = 'none';
    reset(false);
    draw();
  }

  return { init, start, destroy };
})();
