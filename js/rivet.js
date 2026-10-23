/* Rivet — one hammer, one plate.
   Tap, click, or press Space to drive it.
   Seat the head in the gold. Strike high, or let it fall past, and the rivet misses.
   The best run stays in this browser. */

const RivetGame = (() => {
  const W = 480;
  const H = 280;
  const RAIL_X = 240;
  const TOP = 36;
  const PLATE = 200;

  let canvas, ctx, loop;
  let y, speed, half, rivets, best, paused, over, flash, verdict;

  function init() {
    canvas = document.getElementById('rivet-canvas');
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = '100%';
    canvas.style.maxWidth = W + 'px';
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    best = Utils.highScore.load('rivet-best');
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      drive();
    });
    document.addEventListener('keydown', Utils.whenViewActive('view-rivet', onKey));
    loop = Utils.gameLoop(tick);
    start();
  }

  function start() {
    rivets = 0;
    paused = false;
    over = false;
    flash = 0;
    verdict = '';
    y = TOP;
    speed = 110;
    half = 42;
    syncPause();
    const ov = document.getElementById('rivet-overlay');
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
    const btn = document.getElementById('rivet-pause');
    if (btn) btn.textContent = paused ? 'Resume' : 'Pause';
  }

  function onKey(e) {
    if (e.key === 'p' || e.key === 'P') { e.preventDefault(); togglePause(); return; }
    if (e.key === 'r' || e.key === 'R') { e.preventDefault(); restart(); return; }
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); drive(); }
  }

  function drive() {
    if (over) { start(); return; }
    if (paused) return;
    if (Math.abs(y - PLATE) <= half) {
      rivets += 1;
      best = Utils.highScore.save('rivet-best', rivets, best);
      flash = 16;
      y = TOP;
      speed = 110 + rivets * 22;
      half = Math.max(16, 42 - rivets * 4);
      Utils.sfx('clear');
    } else {
      end(y < PLATE ? 'EARLY' : 'LATE');
    }
    updateInfo();
    draw();
  }

  function end(word) {
    over = true;
    verdict = word;
    syncPause();
    Utils.sfx('over');
    const ov = document.getElementById('rivet-overlay');
    if (ov) {
      ov.style.display = 'flex';
      ov.innerHTML = '<h2>' + word + '</h2><p>' + rivets + ' rivet' + (rivets === 1 ? '' : 's') + '</p><p>Tap or Space tries again</p>';
      ov.onclick = () => start();
    }
    updateInfo();
    draw();
  }

  function tick(dt) {
    if (!paused && !over) {
      y += speed * dt / 60;
      if (y > PLATE + half + 24) end('LATE');
      if (flash > 0) flash -= dt;
    }
    draw();
  }

  function updateInfo() {
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };
    set('rivet-score', String(rivets));
    set('rivet-best', best > 0 ? String(best) : '0');
    set('rivet-state', over ? verdict : paused ? 'Paused' : 'Live');
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#12161c';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#3a3428';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(RAIL_X, 24);
    ctx.lineTo(RAIL_X, 248);
    ctx.stroke();
    ctx.fillStyle = flash > 0 ? '#ffe08a' : '#e3b341';
    ctx.fillRect(RAIL_X - 78, PLATE - half, 156, half * 2);
    ctx.fillStyle = '#8d5a32';
    ctx.fillRect(RAIL_X - 4, y - 28, 8, 22);
    ctx.fillStyle = '#f4efe4';
    ctx.fillRect(RAIL_X - 18, y - 8, 36, 16);
    if (flash > 0) {
      ctx.fillStyle = '#ffe08a';
      ctx.font = '700 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SET', RAIL_X, 72);
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
    const ov = document.getElementById('rivet-overlay');
    if (ov) {
      ov.style.display = 'none';
      ov.onclick = null;
    }
    draw();
  }

  return { init, start, resume, destroy, togglePause, restart };
})();
