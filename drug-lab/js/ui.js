import {
  state, G, UPG, ROOM_DEFS,
  fmtCash, currentAct, ACT_LABELS, upgLv, upgCost, salePrice,
  heatGainPerSale,
} from './config.js';
import {
  scene, ownedRoomSet, roomMeshes, roomCenter, buildRoom, onRoomUnlocked,
  growPlots, trimStation, stashNode, chemStation, buildChemStation,
  dealers, trimmerNPCs, lookoutNPCs,
  buildTrimmerNPC, buildLookoutNPC,
  setLabel, removeLabel,
} from './scene.js';
import { saveGame } from './save.js';

// ── Activity feed ──
const feedList    = document.getElementById('feed-list');
const feedEntries = [];
export function addFeed(txt) {
  feedEntries.unshift(txt);
  if (feedEntries.length > 8) feedEntries.pop();
  feedList.innerHTML = feedEntries.map((t,i) =>
    `<div class="feed-entry${i===0?' fresh':''}">${t}</div>`).join('');
}

// ── Toast ──
export function showToast(msg, type='') {
  const t = document.createElement('div');
  t.className = `toast${type?' '+type:''}`;
  t.textContent = msg;
  document.getElementById('toast-container').appendChild(t);
  setTimeout(() => t.remove(), 3100);
}

// ── Cash / heat pops ──
export function cashPop(screenX, screenY, amount) {
  const el = document.createElement('div');
  el.className = 'cash-pop';
  el.textContent = '+$'+fmtCash(amount);
  el.style.left = screenX+'px'; el.style.top = screenY+'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1400);
}
export function heatPop(screenX, screenY) {
  const el = document.createElement('div');
  el.className = 'cash-pop heat-pop';
  el.textContent = '🚔 +heat';
  el.style.left = screenX+'px'; el.style.top = screenY+'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1400);
}

// ── Status bar ──
let statusMsg   = 'Tending the plants...';
let statusTimer = 0;
export function setStatus(msg, duration=4) {
  statusMsg = msg; statusTimer = duration;
  document.getElementById('status-bar').textContent = msg;
}
export function tickStatus(dt) {
  if (statusTimer > 0) {
    statusTimer -= dt;
    if (statusTimer <= 0)
      document.getElementById('status-bar').textContent = statusMsg;
  }
}

// ── Cash ──
export function addCash(n) {
  state.cash += n; state.totalEarned += n;
  refreshHud();
}

// ── Heat ──
export function addHeat(amount) {
  state.heat = Math.max(0, Math.min(100, state.heat + amount));
  if (state.heat >= 100) triggerBust();
  refreshHud();
}

// ── Bust ──
export function triggerBust() {
  state.heat = 100;
  document.getElementById('bust-sub').textContent =
    "The DEA kicked in the door. Everything's seized.\n10 to 15, no deal.";
  document.getElementById('bust-stats').innerHTML = `
    <div class="row"><span>Total Earned</span><strong>$${fmtCash(state.totalEarned)}</strong></div>
    <div class="row"><span>Units Sold</span><strong>${state.totalSold}</strong></div>
    <div class="row"><span>Batches Cooked</span><strong>${state.batches}</strong></div>
    <div class="row"><span>Time Running</span><strong>${Math.floor((Date.now()-state.sessionStart)/60000)}m</strong></div>
  `;
  document.getElementById('bust-modal').classList.add('open');
  addFeed('💀 BUSTED — Game Over');
}

// ── Raid ──
export function triggerRaid() {
  if (G.raidActive) return;
  G.raidActive = true; G.raidTimer = 15;
  document.getElementById('raid-overlay').classList.add('active');
  document.getElementById('status-bar').textContent = '🚔 DEA RAID — STAY LOW';
  document.getElementById('status-bar').classList.add('event-active');
  const lost = Math.floor(G.stashCount * 0.3);
  G.stashCount = Math.max(0, G.stashCount - lost);
  setLabel('stash', `📦 Stash [${G.stashCount}]`, stashNode.x, 2.6, stashNode.z);
  showToast(`🚔 RAID! Lost ${lost} bags. Lie low for 15s.`, 'bust');
  addFeed('🚔 DEA RAID — product seized');
  addHeat(-40);
}

// ── Events ──
const EVENTS = [
  {
    id:'close_call', icon:'🚔', title:'Unmarked Car Outside',
    body:"A dark sedan has been parked outside for 20 minutes. Lookout says it might be nothing. Might not.",
    choices:[
      {text:'Shut everything down. Wait it out.',
       effect:()=>{ addHeat(-15); return 'Went dark for an hour. Heat reduced.'; }, type:'safe'},
      {text:'Keep cooking. Probably nothing.',
       effect:()=>{ addHeat(20); return 'Car left. But someone definitely saw something.'; }, type:'risky'},
    ]
  },
  {
    id:'snitch', icon:'🐀', title:"Someone's Talking",
    body:"Word on the street — a buyer got pinched and is singing to stay out of jail. Your name might be coming up.",
    choices:[
      {text:'Pay for legal advice. Stay calm.', cost:300,
       effect:()=>{
         if(state.cash<300){showToast("Can't afford it!",'bust');return null;}
         state.cash-=300; addHeat(-25); return "Lawyer says you're not a target. Heat reduced.";
       }, type:'safe'},
      {text:'Move the stash. Burn the evidence.',
       effect:()=>{
         const lost=Math.floor(G.stashCount*0.3);
         G.stashCount=Math.max(0,G.stashCount-lost);
         setLabel('stash',`📦 Stash [${G.stashCount}]`,stashNode.x,2.6,stashNode.z);
         addHeat(-10); return `Burned ${lost} bags. Heat slightly reduced.`;
       }, type:'risky'},
    ]
  },
  {
    id:'big_order', icon:'💰', title:'Big Order Incoming',
    body:"A distributor wants a bulk buy. Way more than your usual street deals. Could be a setup. Could be the come-up you needed.",
    choices:[
      {text:'Take the deal. Move everything.',
       effect:()=>{
         const bags=Math.min(G.stashCount,8);
         if(bags===0){showToast('Nothing in stash!','');return null;}
         const price=salePrice(!!chemStation)*bags*2.5;
         addCash(price); G.stashCount-=bags; addHeat(30);
         setLabel('stash',`📦 Stash [${G.stashCount}]`,stashNode.x,2.6,stashNode.z);
         return `Moved ${bags} units. +$${fmtCash(price)}. Major heat increase.`;
       }, type:'risky'},
      {text:'Pass. Too sketchy.',
       effect:()=>'Passed on the deal. Heat unchanged.', type:'safe'},
    ]
  },
  {
    id:'new_connect', icon:'🤝', title:'New Connection',
    body:"Someone from out of town wants to talk business. They've got a network you don't. Could open new doors.",
    choices:[
      {text:"Meet them. See what they're about.",
       effect:()=>{
         const bonus=Math.floor(150+Math.random()*300);
         addCash(bonus); addHeat(10);
         return `New connect. +$${bonus} advance. Watch your back.`;
       }, type:'risky'},
      {text:'Stay local. Keep it small.',
       effect:()=>'Kept it quiet. Consistent is safe.', type:'safe'},
    ]
  },
  {
    id:'power_outage', icon:'💡', title:'Power Bill Unpaid',
    body:"The grow lights pulled too much juice. The utility company is asking questions about your power usage.",
    choices:[
      {text:'Pay off the meter reader. Make it go away.', cost:200,
       effect:()=>{
         if(state.cash<200){showToast('No cash!','bust');return null;}
         state.cash-=200; addHeat(-10); return 'Situation handled. Costs you $200.';
       }, type:'safe'},
      {text:'Ignore it. Just pay the bill.',
       effect:()=>{ addHeat(15); return 'Paid the bill but now on a list somewhere.'; }, type:'risky'},
    ]
  },
];

export function triggerEvent() {
  if (G.activeEvent || G.raidActive) return;
  const ev = EVENTS[Math.floor(Math.random()*EVENTS.length)];
  G.activeEvent = ev;
  document.getElementById('ev-icon').textContent  = ev.icon;
  document.getElementById('ev-title').textContent = ev.title;
  document.getElementById('ev-body').textContent  = ev.body;
  const choicesEl = document.getElementById('ev-choices');
  choicesEl.innerHTML = '';
  for (const choice of ev.choices) {
    const btn = document.createElement('button');
    btn.className = `ev-choice${choice.type==='risky'?' risky':''}`;
    btn.innerHTML = choice.text + (choice.cost ? ` (-$${choice.cost})` : '');
    btn.onclick = () => {
      const result = choice.effect();
      document.getElementById('event-modal').classList.remove('open');
      G.activeEvent = null;
      G.eventCooldown = 50 + Math.random()*40;
      if (result) { showToast(result, choice.type==='risky'?'event':'good'); addFeed(result); }
      refreshHud();
    };
    choicesEl.appendChild(btn);
  }
  document.getElementById('event-modal').classList.add('open');
  addFeed(`⚠️ ${ev.title}`);
}

// ── HUD ──
export function refreshHud() {
  document.getElementById('cash-val').textContent = '$'+fmtCash(state.cash);
  document.getElementById('heat-fill').style.width = state.heat+'%';
  document.getElementById('heat-val').textContent  = Math.floor(state.heat);
  document.getElementById('act-badge').textContent = ACT_LABELS[currentAct()];

  document.getElementById('trimmer-count').textContent = state.trimmers+'/3';
  document.getElementById('lookout-count').textContent = state.lookouts+'/2';
  document.getElementById('runner-count').textContent  = (state.runners||0)+'/3';
  document.getElementById('cook-count').textContent    = (state.cooks||0)+'/3';

  const trimCost = 150*(1+state.trimmers);
  const lookCost = 300*(1+state.lookouts);
  document.getElementById('trimmer-cost').textContent = '$'+fmtCash(trimCost);
  document.getElementById('lookout-cost').textContent = '$'+fmtCash(lookCost);
  document.getElementById('hire-trimmer-btn').disabled = state.cash<trimCost || state.trimmers>=3;
  document.getElementById('hire-lookout-btn').disabled = state.cash<lookCost || state.lookouts>=2;

  const rCost = 400*(1+(state.runners||0));
  document.getElementById('runner-cost').textContent = '$'+fmtCash(rCost);
  document.getElementById('hire-runner-btn').disabled = state.cash<rCost || (state.runners||0)>=3;

  const cCost = 800*(1+(state.cooks||0));
  document.getElementById('cook-cost').textContent = '$'+fmtCash(cCost);
  document.getElementById('hire-cook-btn').disabled = state.cash<cCost || (state.cooks||0)>=3;

  const act = currentAct();
  document.getElementById('runner-row').style.display = act>=2 ? '' : 'none';
  document.getElementById('cook-row').style.display   = chemStation ? '' : 'none';

  if (stashNode)   setLabel('stash', `📦 Stash [${G.stashCount}]`, stashNode.x, 2.6, stashNode.z);
  if (trimStation) setLabel('trim',
    G.trimQueue>0 ? `✂️ Trimming... (${G.trimQueue} waiting)` :
    G.trimBags>0  ? `✂️ Ready [${G.trimBags} bags]` : '✂️ Trim Station',
    trimStation.x, 1.6, trimStation.z);
}

// ── Expand panel ──
export function renderExpandPanel() {
  const el = document.getElementById('expand-list');
  el.innerHTML = '';
  for (const def of ROOM_DEFS) {
    if (def.id==='garage') continue;
    if (ownedRoomSet.has(def.id)) {
      const d = document.createElement('div');
      d.style.cssText = 'font-size:10px;color:#335533;padding:2px 0;';
      d.textContent = '✓ '+def.label;
      el.appendChild(d); continue;
    }
    const btn  = document.createElement('button');
    const need = def.cost - state.cash;
    btn.className = 'act-btn'+(state.cash<def.cost?' locked':'');
    btn.disabled  = state.cash < def.cost;
    btn.innerHTML = `${def.label}<span class="cost">${state.cash>=def.cost?'$'+fmtCash(def.cost):'Need $'+fmtCash(need)}</span>`;
    btn.onclick   = () => buyRoom(def.id);
    el.appendChild(btn);
  }
  if (el.children.length===0)
    el.innerHTML = '<div style="font-size:10px;color:#22dd55;padding:4px 0">Full empire unlocked.</div>';
}

export function buyRoom(id) {
  const def = ROOM_DEFS.find(r => r.id===id);
  if (!def || ownedRoomSet.has(id) || state.cash<def.cost) return;
  state.cash -= def.cost;
  ownedRoomSet.add(id); state.ownedRooms.push(id);
  const hadChem = !!chemStation;
  buildRoom(def);
  onRoomUnlocked(id);
  if (id==='lab' && !hadChem && chemStation)
    showToast('⚗️ Chemistry Station built! Time to cook.', 'info');
  refreshHud(); renderExpandPanel();
  showToast(`${def.label} unlocked!`, 'good');
  addFeed(`🏗️ ${def.label} opened`);
  saveGame();
}

// ── Upgrades panel ──
export function renderUpgradesPanel() {
  const el = document.getElementById('upgrades-panel');
  el.innerHTML = '<div class="panel-title">🔧 Upgrades</div>';
  let lastCat = '';
  for (const u of UPG) {
    const lv = upgLv(u.id);
    if (lv >= u.maxLv && u.id==='chemistry') continue;
    if (u.cat==='The Next Level' && currentAct()<2) continue;
    if (u.cat !== lastCat) {
      const cat = document.createElement('div');
      cat.className = 'upg-cat'; cat.textContent = u.cat;
      el.appendChild(cat); lastCat = u.cat;
    }
    const cost  = upgCost(u);
    const maxed = lv >= u.maxLv;
    const btn   = document.createElement('button');
    btn.className = 'upg-btn';
    btn.disabled  = maxed || state.cash<cost;
    const lvEl = maxed ? `<span class="lvl maxed">MAX</span>` : `<span class="lvl">Lv${lv}</span>`;
    btn.innerHTML = `${u.icon} ${u.name} ${lvEl}${!maxed?`<span class="cost">$${fmtCash(cost)} · ${u.desc}</span>`:''}`;
    if (!maxed) btn.onclick = () => buyUpgrade(u.id);
    el.appendChild(btn);
  }
}

export function buyUpgrade(id) {
  const u = UPG.find(x => x.id===id);
  if (!u) return;
  const cost = upgCost(u);
  if (state.cash<cost || upgLv(id)>=u.maxLv) return;
  state.cash -= cost;
  state.upgrades[id] = (state.upgrades[id]||0)+1;
  if (id==='chemistry' && !chemStation) {
    const labDef = ROOM_DEFS.find(r => r.id==='lab');
    if (ownedRoomSet.has('lab')) {
      const {cx,cz} = roomCenter(labDef);
      buildChemStation(cx, cz);
    } else {
      buildChemStation(-6, -5);
    }
    showToast("⚗️ Chemistry Station built! Now you're cooking.", 'good');
    addFeed('⚗️ Chemistry unlocked');
  }
  showToast(`${u.icon} ${u.name} upgraded!`, 'good');
  addFeed(`🔧 ${u.name} Lv${state.upgrades[id]}`);
  saveGame(); refreshHud(); renderUpgradesPanel();
}

// ── Update heat display (called from gameloop each tick) ──
export function updateHeatDisplay() {
  document.getElementById('heat-fill').style.width = state.heat+'%';
  document.getElementById('heat-val').textContent  = Math.floor(state.heat);
}

// ── Update labels per-frame ──
export function updateLabels(growPlots, dealers, trimStation, G) {
  for (let i=0; i<growPlots.length; i++) {
    const p = growPlots[i];
    if (p.ready) setLabel('plot_'+i, '🌿 READY!', p.x, 1.8+Math.sin(performance.now()/1000*3)*0.05, p.z, 'ready');
  }
  for (let i=0; i<dealers.length; i++) {
    const d = dealers[i];
    if (d.state==='waiting')
      setLabel('deal_'+i, '💰 Buyer', d.group.position.x, 2.2, d.group.position.z, 'prompt');
  }
  if (trimStation) {
    const msg = G.trimQueue>0 ? `✂️ Trimming... [${G.trimQueue}]` :
                G.trimBags>0  ? `✂️ ${G.trimBags} bags ready`     : '✂️ Trim Station';
    setLabel('trim', msg, trimStation.x, 1.6, trimStation.z);
  }
}

// ── Hire buttons ──
export function initUIHandlers() {
  document.getElementById('hire-trimmer-btn').onclick = () => {
    const cost = 150*(1+state.trimmers);
    if (state.cash<cost || state.trimmers>=3) return;
    state.cash -= cost; state.trimmers++;
    const g = buildTrimmerNPC();
    g.position.set(trimStation.x+(Math.random()-0.5)*1.5, 0, trimStation.z+(Math.random()-0.5)*1.5);
    scene.add(g);
    trimmerNPCs.push({group:g, state:'idle', timer:0});
    showToast('✂️ Trimmer hired.', 'good');
    addFeed('👤 Trimmer joined crew');
    refreshHud(); saveGame();
  };

  document.getElementById('hire-lookout-btn').onclick = () => {
    const cost = 300*(1+state.lookouts);
    if (state.cash<cost || state.lookouts>=2) return;
    state.cash -= cost; state.lookouts++;
    const g = buildLookoutNPC();
    g.position.set(6+(Math.random()-0.5)*3, 0, 7+(Math.random()-0.5)*3);
    scene.add(g);
    lookoutNPCs.push({group:g, patrolAngle:Math.random()*Math.PI*2, patrolRadius:4+Math.random()*2});
    showToast('👁️ Lookout on duty.', 'good');
    addFeed('👤 Lookout on patrol');
    refreshHud(); saveGame();
  };

  document.getElementById('hire-runner-btn').onclick = () => {
    const cost = 400*(1+(state.runners||0));
    if (state.cash<cost || (state.runners||0)>=3) return;
    state.cash -= cost; state.runners = (state.runners||0)+1;
    showToast('🏃 Runner hired.', 'good');
    addFeed('👤 Runner hired');
    refreshHud(); saveGame();
  };

  document.getElementById('hire-cook-btn').onclick = () => {
    const cost = 800*(1+(state.cooks||0));
    if (state.cash<cost || (state.cooks||0)>=3) return;
    state.cash -= cost; state.cooks = (state.cooks||0)+1;
    showToast('🧪 Cook hired.', 'good');
    addFeed('👤 Cook on deck');
    refreshHud(); saveGame();
  };
}
