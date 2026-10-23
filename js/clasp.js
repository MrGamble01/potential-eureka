/* Clasp — one needle, one gold sector.
   Tap, click, or press Space to close it.
   Shut it while the needle is in the gold. Let it travel past, or shut early, and the clasp misses.
   The best run stays in this browser. */

const ClaspGame = (() => {
  const W = 480;
  const H = 280;
  const PIVOT_X = 240;
  const PIVOT_Y = 210;
  const RADIUS = 118;
  const START = 0.42;
  const END = Math.PI - 0.36;

  let canvas, ctx, loop;
  let angle, speed, half, clasps, best, paused, over, flash;

  function init() {
    canvas = document.getElementById('clasp-canvas');
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = '100%';
    canvas.style.maxWidth = W + 'px';
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    best = Utils.highScore.load('clasp-best');
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      shut();
    });
    document.addEventListener('keydown', Utils.whenViewActive('view-clasp', onKey));
    loop = Utils.gameLoop(tick);
    start();
  }

  function start() {
    clasps = 0;
    paused = false;
    over = false;
    flash = 0;
    angle = START;
    speed = 0.95;
    half = 0.30;
    syncPause();
    const ov = document.getElementById('clasp-overlay');
    if (ov) {
      ov.style.display = 'none';
      ov.onclick = null;
    }
    updateInfo();
    if (loop) loop.start();
    Utils.sfx('start');
    draw();
  }

  function resume() {
    if (loop) loop.start();
    draw();
  }

  function togglePause() {
    if (over) return;
    paused = !paused;
    syncPause();
    updateInfo();
    draw();
  }

  function restart() { start(); }

  function syncPause() {
    const btn = document.getElementById('clasp-pause');
    if (btn) btn.textContent = paused ? 'Resume' : 'Pause';
  }

  function onKey(e) {
    if (e.key === 'p' || e.key === 'P') { e.preventDefault(); togglePause(); return; }
    if (e.key === 'r' || e.key === 'R') { e.preventDefault(); restart(); return; }
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); shut(); }
  }

  function shut() {
    if (over) { start(); return; }
    if (paused) return;
    const gold = Math.PI / 2;
    if (Math.abs(angle - gold) <= half) {
      clasps += 1;
      best = Utils.highScore.save('clasp-best', clasps, best);
      flash = 16;
      angle = START;
      speed = 0.95 + clasps * 0.18;
      half = Math.max(0.12, 0.30 - clasps * 0.03);
      Utils.sfx('clear');
    } else {
      end();
    }
    updateInfo();
    draw();
  }

  function end() {
    over = true;
    syncPause();
    Utils.sfx('over');
    const ov = document.getElementById('clasp-overlay');
    if (ov) {
      ov.style.display = 'flex';
      ov.innerHTML = '<h2>MISS</h2><p>' + clasps + ' clasp' + (clasps === 1 ? '' : 's') + '</p><p>Tap or Space tries again</p>';
      ov.onclick = () => start();
    }
    updateInfo();
    draw();
  }

  function tick(dt) {
    if (!paused && !over) {
      angle += speed * dt / 60;
      if (angle >= END) end();
      if (flash > 0) flash -= dt;
    }
    draw();
  }

  function updateInfo() {
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };
    set('clasp-score', String(clasps));
    set('clasp-best', best > 0 ? String(best) : '0');
    set('clasp-state', over ? 'Miss' : paused ? 'Paused' : 'Live');
  }

  function tip() {
    return {
      x: PIVOT_X + Math.cos(angle) * RADIUS,
      y: PIVOT_Y - Math.sin(angle) * RADIUS,
    };
  }

  function strokeArc(from, to, color, width) {
    ctx.beginPath();
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.arc(PIVOT_X, PIVOT_Y, RADIUS, -to, -from);
    ctx.stroke();
  }

  function draw() {
    if (!ctx) return;
    const gold = Math.PI / 2;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#12161c';
    ctx.fillRect(0, 0, W, H);
    strokeArc(0.2, END, '#3a3428', 10);
    strokeArc(gold - half, gold + half, flash > 0 ? '#ffe08a' : '#e3b341', 16);
    const p = tip();
    ctx.beginPath();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#f4efe4';
    ctx.moveTo(PIVOT_X, PIVOT_Y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.fillStyle = '#f4efe4';
    ctx.beginPath();
    ctx.arc(PIVOT_X, PIVOT_Y, 5, 0, Math.PI * 2);
    ctx.fill();
    if (flash > 0) {
      ctx.fillStyle = '#ffe08a';
      ctx.font = '700 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SET', PIVOT_X, 78);
    }
    if (paused || over) {
      ctx.fillStyle = 'rgba(10, 12, 16, 0.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#f6efe4';
      ctx.font = '700 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(over ? 'MISS' : 'PAUSED', W / 2, H / 2);
    }
  }

  function destroy() {
    if (loop) loop.stop();
    paused = false;
    over = false;
    const ov = document.getElementById('clasp-overlay');
    if (ov) {
      ov.style.display = 'none';
      ov.onclick = null;
    }
    draw();
  }

  return { init, start, resume, destroy, togglePause, restart };
})();
