/* ============================================
   STARTUP — Grow your ARR. Hit $120M. Exit.
   ============================================ */

const StartupGame = (() => {
  const W = 600;
  const H = 330;
  const TICK_MS = 2000; // 1 real second = 1 game month

  const GOALS = [
    { label: 'Ramen Profitable',   arr: 12000,      funding: 200000,   badge: 'Pre-Seed'  },
    { label: 'Product-Market Fit', arr: 120000,     funding: 1000000,  badge: 'Seed'      },
    { label: 'Series A',           arr: 1200000,    funding: 5000000,  badge: 'Ser-A'     },
    { label: 'Series B',           arr: 12000000,   funding: 20000000, badge: 'Ser-B'     },
    { label: 'Exit / IPO',         arr: 120000000,  funding: 0,        badge: 'EXIT'      },
  ];

  const EVENTS = [
    { text: 'HN front page!',         bad: false, fn: s => { s.customers += Math.max(5, Math.floor(s.customers * 0.3)); } },
    { text: 'Key engineer quit',       bad: true,  fn: s => { s.churnRate = Math.min(0.25, s.churnRate + 0.02); } },
    { text: 'Tweet went viral!',       bad: false, fn: s => { s.customers += Math.max(3, Math.floor(s.customers * 0.2)); } },
    { text: 'Competitor launched',     bad: true,  fn: s => { s.churnRate = Math.min(0.25, s.churnRate + 0.01); } },
    { text: 'Enterprise deal closed!', bad: false, fn: s => { s.arpu = Math.floor(s.arpu * 1.15); } },
    { text: 'Outage — users angry',    bad: true,  fn: s => { s.customers = Math.max(1, Math.floor(s.customers * 0.85)); } },
    { text: 'Integration launched!',   bad: false, fn: s => { s.growthRate = Math.min(0.5, s.growthRate + 0.02); } },
    { text: 'TechCrunch article!',     bad: false, fn: s => { s.customers += Math.max(10, Math.floor(s.customers * 0.4)); } },
  ];

  let canvas, ctx, state, gameLoop;

  function newState() {
    return {
      customers: 3,
      arpu: 100,
      cash: 25000,
      burnRate: 2000,
      month: 1,
      year: 2025,
      churnRate: 0.05,
      growthRate: 0.10,
      goalIndex: 0,
      salesHires: 0,
      gameWon: false,
      gameLost: false,
      started: false,
      flash: '',
      flashBad: false,
      log: [],
    };
  }

  function init() {
    canvas = document.getElementById('startup-canvas');
    if (!canvas) return;
    canvas.width = W;
    canvas.height = H;
    ctx = canvas.getContext('2d');
    state = newState();
    draw();
  }

  function startGame() {
    clearInterval(gameLoop);
    state = newState();
    state.started = true;
    addLog('Company founded. Ship fast, grow faster.');
    gameLoop = setInterval(monthTick, TICK_MS);
    draw();
  }

  function monthTick() {
    if (!state.started || state.gameLost || state.gameWon) return;

    state.month++;
    if (state.month > 12) { state.month = 1; state.year++; }

    const mrr = getMRR();
    state.cash += mrr - state.burnRate;

    // Churn then organic growth (floor with minimum 1 when customers > 0)
    const lost = Math.floor(state.customers * state.churnRate);
    state.customers = Math.max(0, state.customers - lost);
    const grown = state.customers > 0
      ? Math.max(1, Math.floor(state.customers * state.growthRate))
      : 0;
    state.customers += grown;

    // Random event (~12% chance per month)
    state.flash = '';
    if (Math.random() < 0.12) {
      const ev = EVENTS[Math.floor(Math.random() * EVENTS.length)];
      ev.fn(state);
      state.flash = ev.text;
      state.flashBad = ev.bad;
      addLog((ev.bad ? '[-] ' : '[+] ') + ev.text);
    }

    // Milestone check
    const arr = getARR();
    const goal = GOALS[state.goalIndex];
    if (goal && arr >= goal.arr) {
      if (goal.funding > 0) {
        state.cash += goal.funding;
        addLog(`MILESTONE: ${goal.label}! +${fmt(goal.funding)}`);
        state.flash = `${goal.badge}: +${fmt(goal.funding)} raised!`;
        state.flashBad = false;
      }
      state.goalIndex++;
      if (state.goalIndex >= GOALS.length) {
        state.gameWon = true;
        clearInterval(gameLoop);
        addLog('EXIT ACHIEVED. You made it!');
      }
    }

    if (state.cash <= 0 && !state.gameWon) {
      state.gameLost = true;
      clearInterval(gameLoop);
      addLog('Out of cash. Shutting down.');
    }

    draw();
  }

  function getMRR() { return state.customers * state.arpu; }
  function getARR() { return getMRR() * 12; }
  function getRunway() {
    const net = state.burnRate - getMRR();
    if (net <= 0) return Infinity;
    return Math.max(0, Math.floor(state.cash / net));
  }

  function fmt(n) {
    if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
    return `$${Math.floor(n)}`;
  }

  function addLog(msg) {
    const ts = `${state.year}-${String(state.month).padStart(2, '0')}`;
    state.log.unshift(`[${ts}] ${msg}`);
    if (state.log.length > 6) state.log.pop();
  }

  // ── PLAYER ACTIONS ───────────────────────────────────

  function doOutreach() {
    if (!state.started || state.gameLost || state.gameWon) return;
    const n = Math.floor(Math.random() * 3) + 1;
    state.customers += n;
    addLog(`Cold outreach: +${n} customers`);
    draw();
  }

  function doMarketing() {
    if (!state.started || state.gameLost || state.gameWon) return;
    const cost = Math.max(500, Math.floor(state.customers * 30));
    if (state.cash < cost) { addLog(`Need ${fmt(cost)} for marketing`); draw(); return; }
    const n = Math.floor(Math.random() * 10) + 5 + Math.floor(state.customers * 0.1);
    state.cash -= cost;
    state.customers += n;
    addLog(`Marketing (${fmt(cost)}): +${n} customers`);
    draw();
  }

  function doHireSales() {
    if (!state.started || state.gameLost || state.gameWon) return;
    const upfront = 1000;
    const monthly = 4000;
    const minCash = upfront + monthly * 4;
    if (state.cash < minCash) { addLog(`Need ${fmt(minCash)} to hire safely`); draw(); return; }
    state.cash -= upfront;
    state.burnRate += monthly;
    state.growthRate = Math.min(0.5, state.growthRate + 0.05);
    state.salesHires++;
    addLog(`Sales rep #${state.salesHires}: +5% growth/mo, +${fmt(monthly)}/mo burn`);
    draw();
  }

  function doRaisePrices() {
    if (!state.started || state.gameLost || state.gameWon) return;
    const lost = Math.floor(state.customers * 0.07);
    state.customers = Math.max(1, state.customers - lost);
    state.arpu = Math.floor(state.arpu * 1.25);
    addLog(`Prices up 25%: ARPU ${fmt(state.arpu)}/mo (-${lost} customers)`);
    draw();
  }

  // ── DRAWING ──────────────────────────────────────────

  const C = {
    bg:     '#0d1117',
    text:   '#E6EDF3',
    dim:    '#484f58',
    dimmer: '#21262d',
    green:  '#3FB950',
    cyan:   '#58A6FF',
    purple: '#6C63FF',
    pink:   '#F778BA',
    gold:   '#FFC832',
    red:    '#F85149',
    orange: '#FFA657',
  };

  function draw() {
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    if (!state || !state.started) { drawStart(); return; }
    if (state.gameWon || state.gameLost) { drawEnd(); return; }

    const mrr     = getMRR();
    const arr     = getARR();
    const runway  = getRunway();
    const goal    = GOALS[Math.min(state.goalIndex, GOALS.length - 1)];
    const prevArr = state.goalIndex > 0 ? GOALS[state.goalIndex - 1].arr : 0;
    const pct     = goal ? Math.min(1, Math.max(0, (arr - prevArr) / (goal.arr - prevArr))) : 1;

    // Header
    ctx.fillStyle = C.green;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('STARTUP SIMULATOR', 16, 22);
    ctx.fillStyle = C.dim;
    ctx.font = '11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${state.year}-${String(state.month).padStart(2,'0')}  |  ARPU: ${fmt(state.arpu)}/mo  |  Reps: ${state.salesHires}`, W - 16, 22);
    ctx.textAlign = 'left';

    // Metric boxes: row 1 @ y=58, row 2 @ y=108
    const cols = [16, 210, 404];
    const rows = [
      [{ l:'ARR', v: fmt(arr), c: C.gold },          { l:'MRR', v: fmt(mrr), c: C.green },          { l:'CUSTOMERS', v: state.customers.toLocaleString(), c: C.cyan }],
      [{ l:'CASH', v: fmt(state.cash), c: state.cash < 15000 ? C.red : C.text }, { l:'BURN/MO', v: fmt(state.burnRate), c: C.orange }, { l:'RUNWAY', v: runway === Infinity ? 'infinite' : `${runway} mo`, c: runway < 3 ? C.red : runway < 6 ? C.orange : C.text }],
    ];
    rows.forEach((row, ri) => {
      const y = 58 + ri * 50;
      row.forEach((m, ci) => {
        ctx.fillStyle = C.dim;
        ctx.font = '9px monospace';
        ctx.fillText(m.l, cols[ci], y - 14);
        ctx.fillStyle = m.c;
        ctx.font = `bold ${ri === 0 ? 19 : 16}px monospace`;
        ctx.fillText(m.v, cols[ci], y);
      });
    });

    // Divider
    ctx.strokeStyle = C.dimmer;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(16, 124); ctx.lineTo(W - 16, 124); ctx.stroke();

    // Goal progress
    if (goal) {
      ctx.fillStyle = C.dim;
      ctx.font = '9px monospace';
      ctx.fillText(`GOAL: ${goal.label}  —  ${fmt(goal.arr)} ARR`, 16, 141);
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.floor(pct * 100)}%`, W - 16, 141);
      ctx.textAlign = 'left';

      ctx.fillStyle = C.dimmer;
      ctx.fillRect(16, 147, W - 32, 6);
      if (pct > 0) {
        const grad = ctx.createLinearGradient(16, 0, W - 32, 0);
        grad.addColorStop(0, C.purple);
        grad.addColorStop(1, C.gold);
        ctx.fillStyle = grad;
        ctx.shadowColor = C.gold;
        ctx.shadowBlur = pct > 0.85 ? 5 : 0;
        ctx.fillRect(16, 147, Math.max(2, (W - 32) * pct), 6);
        ctx.shadowBlur = 0;
      }
    }

    // Milestone badges
    ctx.font = '9px monospace';
    let bx = 16;
    for (let i = 0; i < GOALS.length - 1; i++) {
      const done = i < state.goalIndex;
      ctx.fillStyle = done ? C.green : C.dim;
      const label = `${done ? '[*]' : '[ ]'} ${GOALS[i].badge}`;
      ctx.fillText(label, bx, 172);
      bx += ctx.measureText(label).width + 14;
    }

    // Flash event
    let logY = 190;
    if (state.flash) {
      ctx.fillStyle = state.flashBad ? C.red : C.gold;
      ctx.font = '11px monospace';
      ctx.fillText(`>> ${state.flash}`, 16, logY);
      logY += 18;
    }

    // Activity log
    state.log.slice(0, 5).forEach((line, i) => {
      ctx.fillStyle = i === 0 ? '#7D8590' : C.dim;
      ctx.font = '10px monospace';
      ctx.fillText(line, 16, logY + i * 16);
    });
  }

  function drawStart() {
    ctx.textAlign = 'center';
    ctx.fillStyle = C.green;
    ctx.font = 'bold 28px monospace';
    ctx.fillText('STARTUP', W / 2, 110);
    ctx.fillStyle = C.text;
    ctx.font = '13px monospace';
    ctx.fillText('Build a company. Grow ARR. Hit $120M and exit.', W / 2, 148);
    ctx.fillStyle = C.dim;
    ctx.font = '11px monospace';
    ctx.fillText('Cold Outreach  /  Marketing  /  Hire Sales  /  Raise Prices', W / 2, 172);
    ctx.fillText('2 real seconds = 1 game month', W / 2, 192);
    ctx.textAlign = 'left';
  }

  function drawEnd() {
    const won = state.gameWon;
    ctx.textAlign = 'center';
    ctx.fillStyle = won ? C.gold : C.red;
    ctx.font = 'bold 26px monospace';
    ctx.fillText(won ? 'EXIT ACHIEVED!' : 'STARTUP FAILED', W / 2, 110);
    ctx.fillStyle = C.text;
    ctx.font = '14px monospace';
    ctx.fillText(`Final ARR: ${fmt(getARR())}`, W / 2, 150);
    ctx.fillText(`${state.customers.toLocaleString()} customers  |  ${state.year}-${String(state.month).padStart(2,'0')}`, W / 2, 174);
    ctx.fillStyle = C.dim;
    ctx.font = '11px monospace';
    ctx.fillText('Click "New Game" to try again', W / 2, 212);
    ctx.textAlign = 'left';
  }

  function destroy() {
    clearInterval(gameLoop);
  }

  return { init, startGame, doOutreach, doMarketing, doHireSales, doRaisePrices, destroy };
})();
