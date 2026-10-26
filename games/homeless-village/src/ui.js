import {
  hudModel, recipeRows, peopleRows, spotActions, spotBlurb, chainView,
  introSeen, markIntro, stormHold, saveState
} from './sim.js';
import { STORM_CONSTANTS } from '../data/npcs.js';

const STEPS = [
  {
    kicker: 'Walk',
    title: 'The ground is the camp.',
    body: 'Tap a spot of dirt to walk there. WASD or the arrow keys do the same. The barrel in the middle is home.'
  },
  {
    kicker: 'Use what is near',
    title: 'Tap a thing, then choose.',
    body: 'Dumpsters, the brush, the corner, and the board each offer one next action when you are close. Press E for whatever is nearest. Nothing covers the camp until you ask it to.'
  },
  {
    kicker: 'Keep it going',
    title: 'Warmth, food, health, hope.',
    body: 'Night, rain, and a dead fire spend warmth. Feed the barrel with wood. Open the camp drawer (C, or the handle at the bottom) to craft. A day here is a little over a minute, and this browser keeps the camp.'
  }
];

function $(id) { return document.getElementById(id); }
function show(el, on) { if (on) el.removeAttribute('hidden'); else el.setAttribute('hidden', ''); }

export function mountUi(scene) {
  const play = $('hv-play');
  const cont = $('hv-continue');
  const how = $('hv-how');
  const sound = $('hv-sound');
  const title = $('hv-title');
  const hud = $('hv-hud');
  const drawer = $('hv-drawer');
  let step = 0;
  let resetArmed = false;
  let tab = 'craft';
  let craftSig = '';
  let peopleSig = '';

  function toast(text) {
    const feed = $('hv-toasts');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    feed.appendChild(el);
    while (feed.children.length > 3) feed.removeChild(feed.firstChild);
    setTimeout(() => el.classList.add('out'), 2800);
    setTimeout(() => el.remove(), 3300);
  }

  function toastAll(lines) {
    (lines || []).slice(-3).forEach((line) => { if (line) toast(line); });
  }

  function soundLabel() {
    const off = scene.audio.muted();
    sound.textContent = off ? 'Sound off' : 'Sound on';
    $('hv-mute').textContent = off ? '×' : '♪';
    $('hv-mute').setAttribute('aria-label', off ? 'Unmute sound' : 'Mute sound');
  }

  function toggleSound() {
    scene.audio.unlock();
    scene.audio.toggle();
    soundLabel();
    scene.audio.blip();
  }

  function blocksWorld() {
    return ['hv-bridge', 'hv-over', 'hv-keys', 'hv-storm'].some((id) => !$(id).hasAttribute('hidden'));
  }

  function modalOpen(id) { return !$(id).hasAttribute('hidden'); }

  function setPaused() {
    scene.paused = modalOpen('hv-intro') || modalOpen('hv-bridge') || modalOpen('hv-keys') || modalOpen('hv-over');
  }

  function renderIntro() {
    const s = STEPS[step];
    $('hv-intro-kicker').textContent = (step + 1) + ' of ' + STEPS.length + ' · ' + s.kicker;
    $('hv-intro-title').textContent = s.title;
    $('hv-intro-body').textContent = s.body;
    $('hv-intro-next').textContent = step === STEPS.length - 1 ? 'Into the camp' : 'Next';
  }

  function openIntro() {
    step = 0;
    renderIntro();
    show($('hv-intro'), true);
    setPaused();
  }

  function closeIntro() {
    show($('hv-intro'), false);
    markIntro();
    setPaused();
  }

  function openDrawer(on) {
    drawer.classList.toggle('open', on);
    $('hv-handle').setAttribute('aria-expanded', on ? 'true' : 'false');
    $('hv-handle').textContent = on ? 'Close' : 'Camp';
    if (on) refresh();
  }

  function toggleDrawer() { openDrawer(!drawer.classList.contains('open')); }

  function showTab(next) {
    tab = next;
    ['craft', 'camp', 'people'].forEach((name) => {
      const on = name === tab;
      $('hv-tab-' + name).setAttribute('aria-selected', on ? 'true' : 'false');
      show($('hv-panel-' + name), on);
    });
    refresh();
  }

  function closeSpot() { show($('hv-context'), false); }

  function openSpot(spot) {
    scene.contextSpot = spot;
    const blurb = spotBlurb(spot.id);
    $('hv-context-title').textContent = blurb[0];
    $('hv-context-body').textContent = blurb[1];
    const box = $('hv-context-actions');
    box.replaceChildren();
    spotActions(scene.state, spot.id).forEach((act) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'act';
      btn.disabled = !act.ok;
      const name = document.createElement('span');
      name.textContent = act.label;
      const detail = document.createElement('small');
      detail.textContent = act.detail;
      btn.append(name, detail);
      btn.addEventListener('click', () => {
        scene.audio.blip();
        if (act.id === 'open-craft') {
          closeSpot();
          showTab('craft');
          openDrawer(true);
          return;
        }
        scene.act(act.id);
        if (act.id !== 'wall') openSpot(spot);
      });
      box.appendChild(btn);
    });
    show($('hv-context'), true);
  }

  function renderCraft() {
    const rows = recipeRows(scene.state);
    const sig = rows.map((r) => r.id + r.ok + r.busy + r.reason).join('|');
    const panel = $('hv-panel-craft');
    if (sig !== craftSig) {
      craftSig = sig;
      panel.replaceChildren();
      let last = '';
      rows.forEach((r) => {
        const cat = r.category === 'structure' ? 'The camp' : 'Tonight';
        if (cat !== last) {
          last = cat;
          const h = document.createElement('p');
          h.className = 'kicker';
          h.textContent = cat;
          panel.appendChild(h);
        }
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'recipe';
        btn.dataset.craft = r.id;
        btn.disabled = !r.ok || r.busy;
        const ico = document.createElement('span');
        ico.textContent = r.icon;
        const name = document.createElement('b');
        name.textContent = r.name;
        const cost = document.createElement('small');
        cost.textContent = r.reason || (r.cost + ' — ' + r.desc);
        const track = document.createElement('span');
        track.className = 'track';
        const bar = document.createElement('i');
        bar.style.width = Math.round(r.p * 100) + '%';
        track.appendChild(bar);
        btn.append(ico, name, cost, track);
        btn.addEventListener('click', () => {
          scene.audio.blip();
          scene.act('craft:' + r.id);
        });
        panel.appendChild(btn);
      });
    } else {
      rows.forEach((r) => {
        const bar = panel.querySelector('[data-craft="' + r.id + '"] .track i');
        if (bar) bar.style.width = Math.round(r.p * 100) + '%';
      });
    }
  }

  function renderPeople() {
    const data = peopleRows(scene.state);
    const sig = JSON.stringify(data);
    if (sig === peopleSig) return;
    peopleSig = sig;
    const panel = $('hv-panel-people');
    panel.replaceChildren();
    const add = (label) => {
      const h = document.createElement('p');
      h.className = 'kicker';
      h.textContent = label;
      panel.appendChild(h);
    };
    add('Hands');
    data.hires.forEach((w) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'person';
      btn.disabled = w.hired || !w.ok;
      const ico = document.createElement('span');
      ico.textContent = w.icon;
      const name = document.createElement('b');
      name.textContent = w.hired ? w.name + ' is here' : w.name + ' · ' + w.cost + ' goodwill';
      const desc = document.createElement('small');
      desc.textContent = w.desc;
      btn.append(ico, name, desc);
      btn.addEventListener('click', () => { scene.audio.blip(); scene.act('hire:' + w.id); });
      panel.appendChild(btn);
    });
    if (data.favor) {
      add('A favor');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'person';
      btn.disabled = !data.favor.ok;
      btn.textContent = data.favor.text;
      btn.addEventListener('click', () => { scene.audio.blip(); scene.act('favor'); });
      panel.appendChild(btn);
    }
    add('On the block');
    data.regulars.forEach((r) => {
      const row = document.createElement('p');
      row.className = 'person';
      row.textContent = r.icon + ' ' + r.name + (r.known ? ' · ' + '●'.repeat(r.hearts || 0) : '');
      const small = document.createElement('small');
      small.textContent = r.desc;
      row.appendChild(small);
      panel.appendChild(row);
    });
    if (data.petitions.length) {
      add('The city');
      data.petitions.forEach((p) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'person';
        btn.disabled = p.won || !p.ok;
        const name = document.createElement('b');
        name.textContent = (p.won ? 'Won · ' : '') + p.name + ' · ' + p.cost;
        const desc = document.createElement('small');
        desc.textContent = p.desc;
        btn.append(name, desc);
        btn.addEventListener('click', () => { scene.audio.blip(); scene.act('petition:' + p.id); });
        panel.appendChild(btn);
      });
    }
  }

  function renderCamp() {
    const h = hudModel(scene.state);
    $('hv-stock').textContent = 'Scraps ' + h.scraps + ' · cans ' + h.cans + ' · wood ' + h.wood + ' · cardboard ' + h.cardboard + ' · goodwill ' + h.goodwill + ' · people ' + h.pop + (h.dog === 2 ? ' · Biscuit' : h.dog === 1 ? ' · a dog at the fence' : '');
    $('hv-rep').textContent = h.rep + (h.forecast ? ' · tomorrow ' + h.forecast : '');
    const log = $('hv-camp-log');
    const lines = (scene.state.log || []).slice().reverse();
    if (log.childElementCount !== lines.length) {
      log.replaceChildren();
      if (!lines.length) {
        const p = document.createElement('p');
        p.textContent = 'The day has not written anything yet.';
        log.appendChild(p);
      }
      lines.forEach((row) => {
        const p = document.createElement('p');
        p.textContent = row.text;
        log.appendChild(p);
      });
    }
  }

  function renderLog() {
    const box = $('hv-log');
    if (box.hasAttribute('hidden')) return;
    const lines = (scene.state.log || []).slice().reverse();
    box.replaceChildren();
    if (!lines.length) {
      const p = document.createElement('p');
      p.textContent = 'Nothing written yet. Scavenge, rest, or wait for dawn.';
      box.appendChild(p);
      return;
    }
    lines.forEach((row) => {
      const p = document.createElement('p');
      p.textContent = row.text;
      box.appendChild(p);
    });
  }

  function refresh() {
    if (!scene.playing) return;
    const h = hudModel(scene.state);
    $('hv-when').textContent = 'Day ' + h.day + ' · ' + h.time + ' · ' + h.weatherIcon + ' ' + h.weatherName;
    $('hv-warmth').textContent = String(h.warmth);
    $('hv-food').textContent = String(h.food);
    $('hv-health').textContent = String(h.health);
    $('hv-hope').textContent = String(h.hope);
    $('hv-warmth-bar').style.width = h.warmth + '%';
    $('hv-food-bar').style.width = h.foodMeter + '%';
    $('hv-health-bar').style.width = h.health + '%';
    $('hv-hope-bar').style.width = h.hope + '%';
    $('hv-goal').textContent = h.goal;
    const chip = $('hv-craft-chip');
    if (h.crafting) {
      chip.textContent = h.crafting.name + ' · ' + Math.round(h.crafting.p * 100) + '%';
      show(chip, true);
    } else show(chip, false);
    const sweep = $('hv-sweep');
    if (h.sweep) {
      $('hv-sweep-text').textContent = 'Sweep in ' + h.sweepLeft + 's. Pack what you can.';
      show(sweep, true);
    } else show(sweep, false);
    if (scene.state.storm) fillStorm();
    if (tab === 'craft') renderCraft();
    if (tab === 'people') renderPeople();
    if (tab === 'camp') renderCamp();
    renderLog();
    craftSig = tab === 'craft' ? craftSig : '';
    peopleSig = tab === 'people' ? peopleSig : '';
  }

  function fillStorm() {
    const storm = scene.state.storm;
    if (!storm) return;
    const phase = STORM_CONSTANTS.PHASES[storm.phase];
    if (!phase) return;
    $('hv-storm-title').textContent = phase.title;
    const need = phase.need ? ('Spend ' + phase.cost + ' ' + phase.need + '. You have ' + Math.floor(scene.state[phase.need] || 0) + '.') : 'Count everyone still under the bridge.';
    const left = Math.max(0, Math.ceil((storm.deadline - Date.now()) / 1000));
    $('hv-storm-body').textContent = need + ' ' + left + 's before Rio does it herself, if she can.';
  }

  function openBridge() {
    const st = chainView();
    const body = $('hv-bridge-body');
    body.replaceChildren();
    const lead = document.createElement('p');
    lead.textContent = st.doneCount + ' of ' + st.total + ' marks, counted across every camp that slept here.';
    body.appendChild(lead);
    st.rows.forEach((row) => {
      const line = document.createElement('div');
      line.className = 'chain ' + (row.tally > 0 ? 'on' : 'off');
      const ico = document.createElement('span');
      ico.textContent = row.icon;
      const text = document.createElement('p');
      const name = document.createElement('b');
      name.textContent = row.name + (row.tally ? ' · ' + row.tally : '');
      const desc = document.createElement('small');
      desc.textContent = row.open ? row.desc : 'Not yet. The wall is still waiting on what comes before.';
      text.append(name, document.createElement('br'), desc);
      line.append(ico, text);
      body.appendChild(line);
    });
    show($('hv-bridge'), true);
    setPaused();
  }

  function onBegan() {
    show(title, false);
    show(hud, true);
    show($('hv-over'), false);
    show($('hv-keys'), false);
    show($('hv-storm'), false);
    closeSpot();
    openDrawer(false);
    craftSig = '';
    peopleSig = '';
    resetArmed = false;
    setPaused();
    refresh();
    if (!introSeen()) openIntro();
    else toast('The barrel is going.');
  }

  play.disabled = false;
  how.disabled = false;
  sound.disabled = false;
  if (sceneHasSave()) show(cont, true);
  soundLabel();

  function sceneHasSave() {
    try { return !!localStorage.getItem('hv_phaser_camp_v1'); } catch (e) { return false; }
  }

  play.addEventListener('click', () => {
    scene.audio.unlock();
    scene.audio.blip();
    if (sceneHasSave() && !play.dataset.arm) {
      play.dataset.arm = '1';
      play.textContent = 'Replace the saved camp';
      return;
    }
    scene.begin('new');
  });
  cont.addEventListener('click', () => {
    scene.audio.unlock();
    scene.audio.blip();
    scene.begin('continue');
  });
  how.addEventListener('click', () => { scene.audio.unlock(); openIntro(); });
  sound.addEventListener('click', toggleSound);
  $('hv-mute').addEventListener('click', toggleSound);
  $('hv-help').addEventListener('click', () => openIntro());
  $('hv-intro-next').addEventListener('click', () => {
    scene.audio.blip();
    if (step >= STEPS.length - 1) closeIntro();
    else { step += 1; renderIntro(); }
  });
  $('hv-intro-skip').addEventListener('click', () => { scene.audio.blip(); closeIntro(); });
  $('hv-goal').addEventListener('click', () => {
    const log = $('hv-log');
    const open = log.hasAttribute('hidden');
    show(log, open);
    $('hv-goal').setAttribute('aria-expanded', open ? 'true' : 'false');
    renderLog();
  });
  $('hv-handle').addEventListener('pointerdown', (e) => {
    $('hv-handle').dataset.y = String(e.clientY);
  });
  $('hv-handle').addEventListener('pointerup', (e) => {
    const dy = e.clientY - Number($('hv-handle').dataset.y || e.clientY);
    if (dy < -24) openDrawer(true);
    else if (dy > 24) openDrawer(false);
    else toggleDrawer();
  });
  $('hv-tab-craft').addEventListener('click', () => showTab('craft'));
  $('hv-tab-camp').addEventListener('click', () => showTab('camp'));
  $('hv-tab-people').addEventListener('click', () => showTab('people'));
  $('hv-context-close').addEventListener('click', closeSpot);
  $('hv-pack').addEventListener('click', () => { scene.audio.blip(); scene.act('pack'); });
  $('hv-save').addEventListener('click', () => {
    scene.audio.blip();
    scene.saveSoon = null;
    window.HV.save();
    $('hv-save-note').textContent = 'Saved in this browser.';
    resetArmed = false;
  });
  $('hv-new').addEventListener('click', () => {
    if (!resetArmed) {
      resetArmed = true;
      $('hv-save-note').textContent = 'Tap again to leave this camp behind.';
      return;
    }
    scene.resetCamp();
  });
  $('hv-bridge-close').addEventListener('click', () => { show($('hv-bridge'), false); setPaused(); });
  $('hv-storm-hold').addEventListener('click', () => {
    scene.audio.blip();
    scene.consume(stormHold(scene.state));
    saveState(scene.state);
  });
  $('hv-storm-close').addEventListener('click', () => show($('hv-storm'), false));
  $('hv-over-again').addEventListener('click', () => scene.resetCamp());
  $('hv-keys-stay').addEventListener('click', () => {
    scene.state.arcDone = true;
    show($('hv-keys'), false);
    setPaused();
    window.HV.save();
    toast('The fire stays. The key can wait.');
  });

  return {
    blocksWorld,
    toast,
    toastAll,
    refresh,
    openSpot,
    closeSpot,
    toggleDrawer,
    toggleSound,
    openBridge,
    openStorm() { show($('hv-storm'), true); fillStorm(); },
    closeStorm() { show($('hv-storm'), false); },
    openOver() { show($('hv-over'), true); setPaused(); },
    openKeys() { show($('hv-keys'), true); setPaused(); },
    onBegan,
    back() {
      if (!$('hv-intro').hasAttribute('hidden')) { closeIntro(); return; }
      if (!$('hv-bridge').hasAttribute('hidden')) { show($('hv-bridge'), false); setPaused(); return; }
      if (!$('hv-storm').hasAttribute('hidden')) { show($('hv-storm'), false); return; }
      if (!$('hv-log').hasAttribute('hidden')) { show($('hv-log'), false); return; }
      if (!$('hv-context').hasAttribute('hidden')) { closeSpot(); return; }
      if (drawer.classList.contains('open')) openDrawer(false);
    }
  };
}
