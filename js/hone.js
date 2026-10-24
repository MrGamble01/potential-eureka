/* Hone — one stone, one blade.
   Tap, click, or press Space to hone it.
   Catch the stone in the gold. Hone early, or let it fall past, and the hone misses.
   The best run stays in this browser. */

const HoneGame = (() => {
  const W = 480;
  const H = 280;
  const RAIL_X = 240;
  const TOP = 36;
  const BAND = 200;

  let canvas, ctx, loop;
  let y, speed, half, hones, best, paused, over, flash, verdict;

  function init() {
    canvas = document.getElementById('hone-canvas');
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = '100%';
    canvas.style.maxWidth = W + 'px';
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    best = Utils.highScore.load('hone-best');
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      hone();
    });
    document.addEventListener('keydown', Utils.whenViewActive('view-hone', onKey));
    loop = Utils.gameLoop(tick);
    start();
  }

  function start() {
    hones = 0;
    paused = false;
    over = false;
    flash = 0;
    verdict = '';
    y = TOP;
    speed = 78;
    half = 42;
    syncPause();
    const ov = document.getElementById('hone-overlay');
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
    const btn = document.getElementById('hone-pause');
    if (btn) btn.textContent = paused ? 'Resume' : 'Pause';
  }

  function onKey(e) {
    if (e.key === 'p' || e.key === 'P') { e.preventDefault(); togglePause(); return; }
    if (e.key === 'r' || e.key === 'R') { e.preventDefault(); restart(); return; }
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); hone(); }
  }

  function hone() {
    if (over) { start(); return; }
    if (paused) return;
    if (Math.abs(y - BAND) <= half) {
      hones += 1;
      best = Utils.highScore.save('hone-best', hones, best);
      flash = 16;
      y = TOP;
      speed = 96 + hones * 18;
      half = Math.max(16, 42 - hones * 4);
      Utils.sfx('clear');
    } else {
      end(y < BAND ? 'EARLY' : 'LATE');
    }
    updateInfo();
    draw();
  }

  function end(word) {
    over = true;
    verdict = word;
    syncPause();
    Utils.sfx('over');
    const ov = document.getElementById('hone-overlay');
    if (ov) {
      ov.style.display = 'flex';
      ov.innerHTML = '<h2>' + word + '</h2><p>' + hones + ' hone' + (hones === 1 ? '' : 's') + '</p><p>Tap or Space tries again</p>';
      ov.onclick = () => start();
    }
    updateInfo();
    draw();
  }

  function tick(dt) {
    if (!paused && !over) {
      y += speed * dt / 60;
      if (y > BAND + half + 24) end('LATE');
      if (flash > 0) flash -= dt;
    }
    draw();
  }

  function updateInfo() {
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };
    set('hone-score', String(hones));
    set('hone-best', best > 0 ? String(best) : '0');
    set('hone-state', over ? verdict : paused ? 'Paused' : 'Live');
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#141610';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#3e4650';
    ctx.fillRect(RAIL_X - 6, 8, 12, H - 16);
    ctx.fillStyle = flash > 0 ? '#ffe08a' : '#e3b341';
    ctx.fillRect(RAIL_X - 86, BAND - half, 172, half * 2);
    ctx.fillStyle = '#c46a32';
    ctx.fillRect(RAIL_X - 16, y - 8, 32, 16);
    if (flash > 0) {
      ctx.fillStyle = '#ffe08a';
      ctx.font = '700 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('HONE', RAIL_X, 72);
    }
    if (paused || over) {
      ctx.fillStyle = 'rgba(10, 12, 16, 0.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#f6efe4';
      ctx.font = '700 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(over ? verdict : 'PAUSED', W / 2, H / 2);
    }
  }

  function destroy() {
    if (loop) loop.stop();
    paused = false;
    over = false;
    const ov = document.getElementById('hone-overlay');
    if (ov) {
      ov.style.display = 'none';
      ov.onclick = null;
    }
    draw();
  }

  return { init, start, resume, destroy, togglePause, restart };
})();
