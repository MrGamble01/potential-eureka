/* Peg — one ring, one post.
   Tap, click, or press Space to drop the ring.
   Land it on the gold peg. Sail past, or miss the post, and the toss is over.
   The best run stays in this browser. */

const PegGame = (() => {
  const W = 480;
  const H = 280;
  const PEG_X = 240;
  const FLOOR = 214;

  let canvas, ctx, loop;
  let x, y, falling, speed, catchHalf, pegs, best, paused, over, flash;

  function init() {
    canvas = document.getElementById('peg-canvas');
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = '100%';
    canvas.style.maxWidth = W + 'px';
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    best = Utils.highScore.load('peg-best');
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      release();
    });
    document.addEventListener('keydown', Utils.whenViewActive('view-peg', onKey));
    loop = Utils.gameLoop(tick);
    start();
  }

  function start() {
    pegs = 0;
    paused = false;
    over = false;
    flash = 0;
    falling = false;
    x = 42;
    y = 78;
    speed = 72;
    catchHalf = 26;
    syncPause();
    const ov = document.getElementById('peg-overlay');
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
    const btn = document.getElementById('peg-pause');
    if (btn) btn.textContent = paused ? 'Resume' : 'Pause';
  }

  function onKey(e) {
    if (e.key === 'p' || e.key === 'P') { e.preventDefault(); togglePause(); return; }
    if (e.key === 'r' || e.key === 'R') { e.preventDefault(); restart(); return; }
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); release(); }
  }

  function release() {
    if (over) { start(); return; }
    if (paused || falling) return;
    falling = true;
    y = 78;
    updateInfo();
    draw();
  }

  function land() {
    falling = false;
    if (Math.abs(x - PEG_X) <= catchHalf) {
      pegs += 1;
      best = Utils.highScore.save('peg-best', pegs, best);
      flash = 16;
      x = 42;
      y = 78;
      speed = 72 + pegs * 16;
      catchHalf = Math.max(14, 26 - pegs * 2);
      Utils.sfx('clear');
    } else {
      end();
    }
    updateInfo();
  }

  function end() {
    over = true;
    falling = false;
    syncPause();
    Utils.sfx('over');
    const ov = document.getElementById('peg-overlay');
    if (ov) {
      ov.style.display = 'flex';
      ov.innerHTML = '<h2>MISS</h2><p>' + pegs + ' peg' + (pegs === 1 ? '' : 's') + '</p><p>Tap or Space tries again</p>';
      ov.onclick = () => start();
    }
    updateInfo();
    draw();
  }

  function tick(dt) {
    if (!paused && !over) {
      if (falling) {
        y += 7 * dt;
        if (y >= FLOOR) land();
      } else {
        x += speed * dt / 60;
        if (x >= W - 28) end();
      }
      if (flash > 0) flash -= dt;
    }
    draw();
  }

  function updateInfo() {
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };
    set('peg-score', String(pegs));
    set('peg-best', best > 0 ? String(best) : '0');
    set('peg-state', over ? 'Miss' : paused ? 'Paused' : 'Live');
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#12161c';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#3a3428';
    ctx.fillRect(PEG_X - 8, 168, 16, 78);
    ctx.fillStyle = flash > 0 ? '#ffe08a' : '#e3b341';
    ctx.fillRect(PEG_X - catchHalf, 156, catchHalf * 2, 14);
    ctx.beginPath();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#f4efe4';
    ctx.arc(x, Math.min(y, FLOOR), 16, 0, Math.PI * 2);
    ctx.stroke();
    if (flash > 0) {
      ctx.fillStyle = '#ffe08a';
      ctx.font = '700 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('RUNG', PEG_X, 132);
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
    const ov = document.getElementById('peg-overlay');
    if (ov) {
      ov.style.display = 'none';
      ov.onclick = null;
    }
    draw();
  }

  return { init, start, resume, destroy, togglePause, restart };
})();
