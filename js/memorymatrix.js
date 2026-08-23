/* ============================================
   MEMORY MATRIX — Simon on a 3×3 light grid.
   Watch the pattern, play it back. One more
   step every round, a little faster each time;
   one wrong pad ends the run.
   ============================================ */

const MemoryMatrixGame = (() => {
  const SIZE = 3;
  const CELL = 150;
  const GAP = 12;
  const PAD = 18;
  const WIDTH = PAD * 2 + SIZE * CELL + (SIZE - 1) * GAP;   // 510
  const HEIGHT = WIDTH;

  // Each pad owns a colour and a pentatonic pitch — the melody IS the
  // memory aid, exactly like the toy.
  const PADS = [
    { color: '#F778BA', freq: 262 }, { color: '#F7C948', freq: 294 }, { color: '#3FB950', freq: 330 },
    { color: '#22d3ee', freq: 392 }, { color: '#6C63FF', freq: 440 }, { color: '#F0883E', freq: 523 },
    { color: '#a78bfa', freq: 587 }, { color: '#58A6FF', freq: 659 }, { color: '#e06060', freq: 784 },
  ];

  let canvas, ctx;
  let seq, inputIdx, round, best;
  let phase;               // 'idle' | 'showing' | 'input' | 'over'
  let litPad = -1;         // pad currently flashed (-1 none)
  let runToken = 0;        // invalidates stale playback timers (the ARC-5 lesson)
  let timeouts = [];
  const sfx = Utils.sfx;

  function init() {
    canvas = document.getElementById('mm-canvas');
    if (!canvas) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = WIDTH * dpr;
    canvas.height = HEIGHT * dpr;
    canvas.style.width = WIDTH + 'px';
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    best = Utils.highScore.load('matrix-best');
    phase = 'idle';
    seq = [];
    round = 0;
    updateInfo();
    draw();

    document.addEventListener('keydown', Utils.whenViewActive('view-memorymatrix', handleKey));

    const overlayEl = document.getElementById('mm-overlay');
    if (overlayEl) overlayEl.addEventListener('click', () => { if (phase === 'over') start(); });

    canvas.addEventListener('click', e => {
      if (phase === 'idle' || phase === 'over') { start(); return; }
      const r = canvas.getBoundingClientRect();
      const pad = padAt(e.clientX - r.left, e.clientY - r.top);
      if (pad >= 0) pressPad(pad);
    });
  }

  function padAt(x, y) {
    for (let i = 0; i < 9; i++) {
      const c = cellRect(i);
      if (x >= c.x && x <= c.x + CELL && y >= c.y && y <= c.y + CELL) return i;
    }
    return -1;
  }

  function cellRect(i) {
    const col = i % SIZE, row = Math.floor(i / SIZE);
    return { x: PAD + col * (CELL + GAP), y: PAD + row * (CELL + GAP) };
  }

  function clearTimers() {
    for (const t of timeouts) clearTimeout(t);
    timeouts = [];
  }
  function later(fn, ms) {
    const my = runToken;
    timeouts.push(setTimeout(() => { if (my === runToken) fn(); }, ms));
  }

  function start() {
    runToken++;
    clearTimers();
    seq = [];
    round = 0;
    phase = 'idle';
    sfx('start');
    const overlay = document.getElementById('mm-overlay');
    if (overlay) overlay.style.display = 'none';
    nextRound();
  }

  function nextRound() {
    round++;
    seq.push(Math.floor(Math.random() * 9));
    inputIdx = 0;
    updateInfo();
    playback();
  }

  // Flash the sequence. Playback tightens as rounds climb so late rounds
  // test memory at speed, not patience.
  function playback() {
    phase = 'showing';
    const on = Math.max(160, 420 - round * 18);
    const gap = Math.max(70, 150 - round * 5);
    let t = 450;
    seq.forEach((pad, i) => {
      later(() => { litPad = pad; SFX.note(PADS[pad].freq, on / 1000 + 0.05); draw(); }, t);
      later(() => { litPad = -1; draw(); }, t + on);
      t += on + gap;
    });
    later(() => { phase = 'input'; draw(); }, t + 60);
    draw();
  }

  function pressPad(pad) {
    if (phase !== 'input') return;
    litPad = pad;
    draw();
    later(() => { litPad = -1; draw(); }, 170);

    if (pad === seq[inputIdx]) {
      SFX.note(PADS[pad].freq, 0.18);
      inputIdx++;
      if (inputIdx >= seq.length) {
        phase = 'showing';           // lock input during the inter-round beat
        later(() => nextRound(), 650);
      }
    } else {
      endGame(pad);
    }
  }

  function handleKey(e) {
    if ((phase === 'idle' || phase === 'over') &&
        [' ', 'Enter', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(e.key)) {
      e.preventDefault(); start(); return;
    }
    // Pads map to 1-9 in reading order: 1-2-3 across the top row.
    if (phase === 'input' && /^[1-9]$/.test(e.key)) {
      e.preventDefault();
      pressPad(+e.key - 1);
    }
  }

  function endGame(wrongPad) {
    phase = 'over';
    runToken++;             // kill any queued flashes
    clearTimers();
    litPad = -1;
    sfx('over');
    Effects.shakeCanvas(canvas, 8, 300);
    const completed = round - 1;
    best = Utils.highScore.save('matrix-best', completed, best);
    updateInfo();
    draw(wrongPad);
    Utils.showGameOver('mm-overlay', {
      lines: [`Rounds: ${completed} &nbsp;·&nbsp; Best: ${best}`,
              `The pattern was ${seq.length} steps`],
      hint: 'Press SPACE or tap to try again',
    });
  }

  function updateInfo() {
    const roundEl = document.getElementById('mm-round');
    const bestEl = document.getElementById('mm-best');
    const lenEl = document.getElementById('mm-len');
    if (roundEl) roundEl.textContent = Math.max(1, round);
    if (bestEl) bestEl.textContent = best;
    if (lenEl) lenEl.textContent = seq ? seq.length : 0;
  }

  function draw(wrongPad) {
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    for (let i = 0; i < 9; i++) {
      const c = cellRect(i);
      const lit = i === litPad;
      const wrong = wrongPad === i;
      ctx.fillStyle = wrong ? '#F85149' : PADS[i].color;
      ctx.globalAlpha = lit || wrong ? 1 : 0.22;
      if (lit || wrong) { ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 26; }
      const r = 14;
      ctx.beginPath();
      ctx.moveTo(c.x + r, c.y);
      ctx.arcTo(c.x + CELL, c.y, c.x + CELL, c.y + CELL, r);
      ctx.arcTo(c.x + CELL, c.y + CELL, c.x, c.y + CELL, r);
      ctx.arcTo(c.x, c.y + CELL, c.x, c.y, r);
      ctx.arcTo(c.x, c.y, c.x + CELL, c.y, r);
      ctx.fill();
      ctx.shadowBlur = 0;
      // Key hint in the corner of each pad
      ctx.globalAlpha = lit ? 0.9 : 0.35;
      ctx.fillStyle = '#0d1117';
      ctx.font = 'bold 13px Inter, sans-serif';
      ctx.fillText(String(i + 1), c.x + 10, c.y + 22);
    }
    ctx.globalAlpha = 1;

    if (phase === 'showing') {
      ctx.fillStyle = '#7D8590';
      ctx.font = '13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('WATCH…', WIDTH / 2, HEIGHT - 4);
      ctx.textAlign = 'left';
    } else if (phase === 'input') {
      ctx.fillStyle = '#3FB950';
      ctx.font = '13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('YOUR TURN', WIDTH / 2, HEIGHT - 4);
      ctx.textAlign = 'left';
    }

    if (phase === 'idle') {
      ctx.fillStyle = 'rgba(13, 17, 23, 0.7)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = '#E6EDF3';
      ctx.font = '20px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Press any key or tap to start', WIDTH / 2, HEIGHT / 2);
      ctx.font = '12px Inter, sans-serif';
      ctx.fillStyle = '#7D8590';
      ctx.fillText('Watch the pattern, repeat it — keys 1-9 or tap the pads', WIDTH / 2, HEIGHT / 2 + 24);
      ctx.textAlign = 'left';
    }
  }

  function destroy() {
    runToken++;
    clearTimers();
    phase = 'idle';
    seq = [];
    round = 0;
    litPad = -1;
    const ov = document.getElementById('mm-overlay'); if (ov) ov.style.display = 'none';
    draw();
  }

  return { init, start, destroy };
})();
