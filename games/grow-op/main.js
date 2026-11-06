// Grow Op: San Verde '84 — Main Application & HUD Controller

import { GOODS, STRAINS } from './data/goods.js';
import { BUILDINGS, BUILDING_LIST } from './data/buildings.js';
import { REGIONS, BUILD_SLOTS, LIEUTENANTS, ACTS } from './data/missions.js';
import { ICONS, iconForCategory } from './data/icons.js';
import { RESEARCH } from './data/research.js';
import { CartelSimulation } from './simulation.js';
import { MapScene } from './scene.js';
import { createAudio } from './audio.js';
import { createJuice } from './audio/juice.js';
import { lotDef } from './data/lots.js';
import { buildSeconds } from './systems/lots.js';
import { attachFeel, presentEvent } from './systems/hooks.js';
import { artURL, cardKeyForBuilding, cardKeyForRole, iconKeyForBuilding, iconKeyForRole } from './art-keys.js';
import { coreMode, riskLive } from './data/config.js';

if (coreMode() && typeof document !== 'undefined') document.body.classList.add('go-core');

function supplyChainOnly(view) {
  if (!view || view.coreMode !== false) return true;
  return false;
}

function showHeat(view) {
  if (supplyChainOnly(view)) return false;
  if (typeof view.heat === 'number') return true;
  return !!(view.zones && view.zones.some((zone) => typeof zone.heat === 'number'));
}

const $ = (id) => document.getElementById(id);

function fmtCash(n) {
  const v = Math.floor(Number(n) || 0);
  if (v >= 1000000) return '$' + (v / 1000000).toFixed(2) + 'M';
  if (v >= 10000) return '$' + (v / 1000).toFixed(1) + 'k';
  return '$' + v.toLocaleString();
}

let activeTab = 'slot';
let drawerOpen = true;
let phaserGame = null;
let mapScene = null;
const audio = createAudio();

const TUTORIAL = [
  'The Río Plata plaza is marked. Tap Build, choose the Taxi Fleet, and construct it. That washes dirty cash.',
  'A truck is on the valley road. Follow the crate from the plantation to the pier.',
  'The taxi front just turned dirty bills into clean cash. Clean cash unlocks the next district.',
  'The pier run spiked heat in Río Plata. Bribe the town before the police lock a building.',
  'The valley loop is yours. The rest of the map opens: more country, then Puerto Sol.'
];
const TUTORIAL_LINE = [
  'Build a taxi front',
  'Follow the truck',
  'Clean cash is in',
  'Cool the valley',
  'The map opens'
];

const CORE_TUTORIAL = [
  'The plantation is the first building. Let the crop come up.',
  'The barn cures the harvest. Trucks carry it there.',
  'The warehouse holds the packs between the barn and the road.',
  'Trucks haul the crates. Nothing moves itself.',
  'The pier is the sale. Keep the chain moving until the river pays.'
];
const CORE_TUTORIAL_LINE = [
  'Grow the crop',
  'Process the harvest',
  'Store the packs',
  'Haul it down the road',
  'Sell at the pier'
];

function tutorialCopy() {
  return coreMode()
    ? { lines: CORE_TUTORIAL, titles: CORE_TUTORIAL_LINE }
    : { lines: TUTORIAL, titles: TUTORIAL_LINE };
}

const CHAIN_GUIDE = [
  { id: 'grow', slot: 'slot_rp_farm1', line: 'Tap the farm: it grows leaf', hint: 'Upgrade the farm to grow faster', test: (evt) => evt.type === 'produced' && evt.slotId === 'slot_rp_farm1' },
  { id: 'process', slot: 'slot_rp_barn1', line: 'Watch the lab: it turns leaf into product', hint: 'Upgrade the lab if it is waiting on leaf', test: (evt) => evt.type === 'processed' && evt.slotId === 'slot_rp_barn1' },
  { id: 'store', slot: 'slot_rp_wh1', line: 'Store it in the warehouse', hint: 'The pips on the shed are your trucks', test: (evt) => evt.type === 'truck_delivered' && evt.truck && evt.truck.toSlotId === 'slot_rp_wh1' },
  { id: 'sell', slot: 'slot_rp_pier', line: 'Sell at the pier for cash', hint: 'Street pays dirty. Cafe pays clean', test: (evt) => evt.type === 'exported' && evt.slotId === 'slot_rp_pier' && (evt.earnedDirty || evt.earnedClean) }
];
const CHAIN_NEED = { grow: 1, process: 1, store: 1, sell: 1 };

const TEACH_LAB = 'drying_barn';
const TEACH_LOT = 'slot_rp_south';
const TEACH = [
  { id: 'build', line: 'Tap Build', hint: 'Tap the Build button', aim: 'build' },
  { id: 'pick', line: 'Pick the Lab', hint: 'Tap the Lab icon', aim: 'menu' },
  { id: 'lot', line: 'Tap this lot', hint: 'Tap the glowing lot', aim: 'world', slot: TEACH_LOT },
  { id: 'confirm', line: 'Confirm', hint: 'Tap the green check', aim: 'place-ok', slot: TEACH_LOT }
];

const NEXT_ZONE = 'jungle_alta';
const POST = [
  { id: 'buyer', line: 'Pick Street or Cafe', hint: 'Street pays dirty. Cafe pays clean', slot: 'slot_rp_pier' },
  { id: 'zone', line: 'Unlock the next valley: $1,500', hint: 'Tap the lock', zone: NEXT_ZONE },
  { id: 'crop', line: 'Choose a crop', hint: 'Leaf pays dirty. Coffee pays clean', lot: 'lot_ja_clearing', buildings: ['coffee_estate', 'plantation'], reward: 100 },
  { id: 'depot', line: 'Build a depot', hint: 'It adds trucks', lot: 'lot_ja_wh', building: 'transport_depot', reward: 100 },
  { id: 'taxi', line: 'Open a taxi front', hint: 'Convert the station, or build a taxi', lot: 'lot_ja_gas', building: 'taxi_co', reward: 150 },
  { id: 'plaza', line: 'Choose the plaza', hint: 'A farm grows leaf. A taxi cleans cash', slot: 'slot_rp_town1', buildings: ['plantation', 'taxi_co'], reward: 150 }
];

let guideStep = 0;
let guideHits = 0;
let guideSince = 0;
let guideFlash = null;
let guideHoldUntil = 0;
let lastSale = null;
let teachStep = 0;
let teachDone = false;
let teachTouch = 0;
let teachNudge = false;
let teachPulse = 0;
let pickerSlot = null;
let postStep = 0;
let postDone = false;
let postShown = 0;
const earnSamples = [];

function guideLive() {
  return coreMode() && sim.state.started && sim.state.mode === 'campaign' && guideStep < CHAIN_GUIDE.length;
}

function teachActive() {
  return coreMode() && sim.state.started && sim.state.mode === 'campaign' && !teachDone && teachStep < TEACH.length;
}

function postLive() {
  return coreMode() && sim.state.started && sim.state.mode === 'campaign' && !teachActive() && guideStep >= CHAIN_GUIDE.length && !postDone && postStep < POST.length;
}

function refreshTeach() {
  const south = sim.state.slots[TEACH_LOT];
  if (south && south.buildingId) {
    teachDone = true;
    teachStep = TEACH.length;
  }
}

function teachNow() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function bumpTeach() {
  teachTouch = teachNow();
  teachPulse = teachTouch;
  if (!teachNudge) return;
  teachNudge = false;
  const hint = $('obj-hint');
  if (hint) hint.hidden = true;
  const arrow = document.querySelector('.go-guide');
  if (arrow) arrow.classList.remove('is-nudge');
}

function pulseGuideArrow() {
  const arrow = document.querySelector('.go-guide');
  if (!arrow) return;
  arrow.classList.remove('is-nudge');
  void arrow.offsetWidth;
  arrow.classList.add('is-nudge');
}

function slotDefOf(slotId) {
  return BUILD_SLOTS.find((item) => item.id === slotId) || null;
}

function labFits(slotId) {
  const def = slotDefOf(slotId);
  const building = BUILDINGS[TEACH_LAB];
  const slot = sim.state.slots[slotId];
  if (!def || !building || !slot || slot.buildingId || slot.rivalControlled) return false;
  const reg = sim.state.regions[def.regionId];
  if (!reg || !reg.unlocked) return false;
  if (def.allowedCategories && !def.allowedCategories.includes(building.category)) return false;
  const lot = sim.state.lots && sim.state.lots[slotId];
  if (lot && lot.kind === 'standing' && lot.phase !== 'cleared') return false;
  const scale = lot && lot.kind === 'open' ? 0.85 : 1;
  const dirty = Math.round((building.buildCostDirty || 0) * scale);
  const clean = Math.round((building.buildCostClean || 0) * scale);
  return sim.state.dirtyCash >= dirty && sim.state.cleanCash >= clean;
}

function canBuildOn(slotId) {
  const def = slotDefOf(slotId);
  const slot = sim.state.slots[slotId];
  if (!def || !slot || slot.buildingId || slot.rivalControlled) return false;
  const reg = sim.state.regions[def.regionId];
  if (!reg || !reg.unlocked) return false;
  const lot = sim.state.lots && sim.state.lots[slotId];
  if (lot && (lot.phase === 'building' || lot.phase === 'demolishing')) return false;
  if (lot && lot.kind === 'standing' && lot.phase !== 'cleared') return false;
  return true;
}

function nextHint(view) {
  const south = sim.state.slots.slot_rp_south;
  if (south && !south.buildingId) return { slotId: 'slot_rp_south', button: 'dock-build-btn', line: 'Build another farm: it grows more leaf' };
  const mission = view && view.campaign ? view.campaign.mission : null;
  const hints = {
    c1_grow: { slotId: 'slot_rp_farm1', line: 'Farm grows leaf' },
    c1_process: { slotId: 'slot_rp_barn1', line: 'Lab turns leaf into product' },
    c1_store: { slotId: 'slot_rp_wh1', line: 'Warehouse holds the packs' },
    c1_haul: { slotId: 'slot_rp_wh1', line: 'Trucks haul the packs' },
    c1_sell: { slotId: 'slot_rp_pier', line: 'Sell at the pier for cash' },
    c1_plot: { slotId: 'slot_rp_south', button: 'dock-build-btn', line: 'Build another farm: it grows more leaf' },
    c2_zone: { line: 'Open the next stretch' },
    c2_lot: { line: 'Buy the sawmill' }
  };
  if (mission && hints[mission.id]) return hints[mission.id];
  const slotId = sim.recommendedLotId ? sim.recommendedLotId() : null;
  return { slotId, line: mission ? mission.title : 'The chain is running' };
}

function currentGuide(view) {
  if (!coreMode() || !sim.state.started || sim.state.mode !== 'campaign') return null;
  if (teachActive()) {
    const step = TEACH[teachStep];
    return {
      id: step.id,
      aim: step.aim,
      slotId: step.slot || null,
      button: step.aim === 'build' ? 'dock-build-btn' : null,
      line: step.line,
      hint: teachNudge ? step.hint : '',
      live: true,
      index: teachStep,
      total: TEACH.length
    };
  }
  if (guideHoldUntil && guideStep < CHAIN_GUIDE.length) {
    const step = CHAIN_GUIDE[guideStep];
    return { id: step.id, slotId: step.slot, button: null, line: step.line, live: true, index: guideStep, total: CHAIN_GUIDE.length };
  }
  if (guideLive()) {
    const step = CHAIN_GUIDE[guideStep];
    return { id: step.id, slotId: step.slot, button: null, line: step.line, live: true, index: guideStep, total: CHAIN_GUIDE.length };
  }
  if (postLive()) {
    const step = POST[postStep];
    const line = step.line;
    return {
      id: step.id,
      aim: step.zone ? 'zone' : null,
      slotId: step.slot || null,
      lotId: step.lot || null,
      zoneId: step.zone || null,
      button: null,
      line,
      hint: teachNudge ? step.hint : '',
      live: true,
      index: CHAIN_GUIDE.length + postStep,
      total: CHAIN_GUIDE.length + POST.length
    };
  }
  const hint = nextHint(view || sim.gameplayView());
  return { slotId: hint.slotId || null, button: hint.button || null, line: hint.line, live: false, index: CHAIN_GUIDE.length, total: CHAIN_GUIDE.length };
}

function canAffordBuild() {
  const st = sim.state;
  return buildChoices().some((building) => {
    return BUILD_SLOTS.some((def) => {
      const slot = st.slots[def.id];
      const reg = st.regions[def.regionId];
      if (!slot || !reg || !reg.unlocked || slot.buildingId || slot.rivalControlled) return false;
      if (def.allowedCategories && !def.allowedCategories.includes(building.category)) return false;
      const lot = st.lots && st.lots[def.id];
      const scale = lot && lot.kind === 'open' ? 0.85 : 1;
      return st.dirtyCash >= Math.round((building.buildCostDirty || 0) * scale)
        && st.cleanCash >= Math.round((building.buildCostClean || 0) * scale);
    });
  });
}

function publishGuide(view) {
  const guide = currentGuide(view);
  if (phaserGame) {
    phaserGame.registry.set('guide', guide);
    phaserGame.registry.set('guideTick', guideTick);
    if (guideFlash) phaserGame.registry.set('guideFlash', guideFlash);
  }
  const buildBtn = $('dock-build-btn');
  if (buildBtn) {
    buildBtn.classList.toggle('is-next', !!(guide && guide.aim === 'build'));
    buildBtn.classList.toggle('is-afford', canAffordBuild());
  }
  const ok = $('place-ok');
  if (ok) ok.classList.toggle('is-aim', !!(guide && guide.aim === 'place-ok'));
  const hint = $('obj-hint');
  if (hint) {
    if (guide && guide.hint) {
      hint.hidden = false;
      hint.textContent = guide.hint;
    } else {
      hint.hidden = true;
      hint.textContent = '';
    }
  }
  return guide;
}

function noteGuide(evt) {
  if (evt.type === 'exported' && (evt.earnedDirty || evt.earnedClean)) lastSale = evt;
  if (evt.type === 'built' && evt.slotId === TEACH_LOT && evt.buildingId === TEACH_LAB) {
    teachDone = true;
    teachStep = TEACH.length;
    teachNudge = false;
    const hint = $('obj-hint');
    if (hint) hint.hidden = true;
    const now = teachNow();
    guideFlash = { slot: TEACH_LOT, until: now + 1500 };
    if (phaserGame) phaserGame.registry.set('guideFlash', guideFlash);
  }
  if (!sim.state.started || teachActive()) return;
  if (postLive()) {
    notePost(evt);
    return;
  }
  if (guideHoldUntil) return;
  if (!guideLive()) return;
  const step = CHAIN_GUIDE[guideStep];
  if (!step.test(evt)) return;
  const elapsed = sim.state.elapsedSeconds || 0;
  if (step.id !== 'grow' && elapsed - guideSince < 12) return;
  guideHits += 1;
  if (guideHits < (CHAIN_NEED[step.id] || 1)) return;
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  guideFlash = { slot: step.slot, until: now + 1500 };
  if (phaserGame) phaserGame.registry.set('guideFlash', guideFlash);
  if (step.id === 'sell') {
    guideHoldUntil = now + 1800;
    return;
  }
  guideStep += 1;
  guideHits = 0;
  guideSince = sim.state.elapsedSeconds || 0;
  if (guideLive() && CHAIN_GUIDE[guideStep].id === 'sell' && lastSale && mapScene && mapScene.fx) {
    mapScene.fx({ type: 'exported', slotId: lastSale.slotId, earnedDirty: lastSale.earnedDirty || 0, earnedClean: lastSale.earnedClean || 0 });
  }
}

function grantReward(amount) {
  if (!amount) return;
  sim.state.dirtyCash += amount;
  const juice = mapScene && mapScene.registry ? mapScene.registry.get('juice') : null;
  if (juice && juice.cashPop) juice.cashPop('slot_rp_pier', amount, 'dirty');
  else showBuildToast(`+$${amount}`);
}

function advancePost() {
  const step = POST[postStep];
  if (!step) return;
  if (step.reward) grantReward(step.reward);
  const now = teachNow();
  guideFlash = { slot: step.slot || 'slot_rp_pier', until: now + 1200 };
  if (phaserGame) phaserGame.registry.set('guideFlash', guideFlash);
  postStep += 1;
  postShown = now;
  teachNudge = false;
  teachTouch = now;
  if (postStep >= POST.length) postDone = true;
  renderHud();
}

function notePost(evt) {
  const step = POST[postStep];
  if (!step) return;
  const wanted = step.buildings || (step.building ? [step.building] : null);
  if ((evt.type === 'built' || evt.type === 'build_started') && wanted && wanted.includes(evt.buildingId)) {
    if (step.lot && evt.lotId !== step.lot) return;
    if (!step.lot && step.slot && evt.slotId !== step.slot) return;
    advancePost();
    return;
  }
  if (evt.type === 'zone_unlocked' && step.id === 'zone' && evt.zoneId === step.zone) advancePost();
  if (step.id === 'taxi' && evt.type === 'converted' && evt.lotId === step.lot && evt.role === 'launder') advancePost();
}

function idleGuide(hint) {
  const now = teachNow();
  if (!teachTouch) teachTouch = now;
  if (now - teachTouch < 6000) return;
  if (!teachNudge) {
    teachNudge = true;
    teachPulse = now;
    const el = $('obj-hint');
    if (el && hint) {
      el.hidden = false;
      el.textContent = hint;
    }
    pulseGuideArrow();
    return;
  }
  if (now - teachPulse >= 6000) {
    teachPulse = now;
    pulseGuideArrow();
  }
}

function guideTick() {
  const now = teachNow();
  if (guideHoldUntil && now >= guideHoldUntil) {
    guideHoldUntil = 0;
    if (guideLive() && CHAIN_GUIDE[guideStep].id === 'sell') {
      guideStep += 1;
      guideHits = 0;
      guideSince = sim.state.elapsedSeconds || 0;
      teachTouch = now;
      teachNudge = false;
    }
    renderHud();
  }
  if (guideLive() && !teachActive()) {
    idleGuide(CHAIN_GUIDE[guideStep].hint);
    return;
  }
  if (postLive()) {
    const step = POST[postStep];
    if (!postShown) postShown = now;
    const pier = sim.state.slots.slot_rp_pier;
    if (step.id === 'buyer' && pier && (pier.buyer === 'street' || pier.buyer === 'cafe')) advancePost();
    else if (step.id === 'zone' && sim.state.zones[NEXT_ZONE] && sim.state.zones[NEXT_ZONE].unlocked) advancePost();
    else idleGuide(step.hint);
    return;
  }
  if (!teachActive()) return;
  idleGuide(TEACH[teachStep] && TEACH[teachStep].hint);
}

function earnPerMinute(st) {
  const now = st.elapsedSeconds || 0;
  const value = (st.totalDirtyEarned || 0) + (st.totalCleanEarned || 0);
  const last = earnSamples[earnSamples.length - 1];
  if (!last || now - last.t >= 1 || value !== last.v) earnSamples.push({ t: now, v: value });
  while (earnSamples.length && now - earnSamples[0].t > 60) earnSamples.shift();
  if (earnSamples.length < 2) return 0;
  const span = Math.max(4, earnSamples[earnSamples.length - 1].t - earnSamples[0].t);
  return Math.max(0, ((earnSamples[earnSamples.length - 1].v - earnSamples[0].v) / span) * 60);
}

const ROLE_NAME = {
  launder: 'Front',
  stash: 'Stash house',
  lab: 'Lab',
  distribution: 'Distribution',
  safehouse: 'Safehouse',
  hq: 'HQ',
  produce: 'Production',
  process: 'Processing',
  export: 'Export',
  warehouse: 'Warehouse'
};

const queuedBuild = {};
let ghost = null;
let openLotId = null;
let openZoneId = null;
let sheetNote = '';

const sim = new CartelSimulation((evt) => {
  handleSimEvent(evt);
});

// Check if saved game exists for title modal
const hasSave = sim.hasSavedGame();
if (hasSave) {
  sim.load();
}
refreshTeach();

function handleSimEvent(evt) {
  noteGuide(evt);
  const sceneLive = mapScene && mapScene.sys && mapScene.sys.isActive();
  if (sceneLive) mapScene.fx(evt);
  else presentEvent(audio, null, evt, sim);
  if (
    evt.type === 'built' ||
    evt.type === 'upgraded' ||
    evt.type === 'demolished' ||
    evt.type === 'region_unlocked' ||
    evt.type === 'rival_cleared' ||
    evt.type === 'lieutenant_hired' ||
    evt.type === 'raid_started' ||
    evt.type === 'raid_cleared' ||
    evt.type === 'mission_completed' ||
    evt.type === 'research' ||
    evt.type === 'event' ||
    evt.type === 'event_resolved'
  ) {
    renderDrawerContent();
  }
  renderHud();
}

function selectSlot(slotId, openPanel = true) {
  const slotDef = BUILD_SLOTS.find((s) => s.id === slotId);
  if (!slotDef) return;
  sim.state.selectedSlotId = slotId;
  sim.state.selectedRegionId = slotDef.regionId;
  drawerOpen = false;
  syncDrawerVisibility();
  if (openPanel) openLot(slotId);
  else renderHud();
}

function selectRegion(regionId) {
  if (coreMode()) return;
  sim.state.selectedRegionId = regionId;
  const regState = sim.state.regions[regionId];
  if (regState && !regState.unlocked) {
    activeTab = 'territory';
  } else {
    activeTab = 'slot';
  }
  drawerOpen = true;
  syncDrawerVisibility();
  renderDrawerContent();
  renderHud();
}

function syncDrawerVisibility() {
  const drawer = $('go-drawer');
  if (!drawer) return;
  drawer.classList.toggle('is-collapsed', !drawerOpen);
  for (const tabBtn of document.querySelectorAll('.go-tab-btn')) {
    tabBtn.classList.toggle('is-active', tabBtn.dataset.tab === activeTab);
  }
  for (const dockBtn of document.querySelectorAll('.go-dock-btn[data-tab]')) {
    dockBtn.classList.toggle('is-active', drawerOpen && dockBtn.dataset.tab === activeTab);
  }
}

function renderHud() {
  const st = sim.state;
  const view = sim.gameplayView();
  const camp = view.campaign || {};

  $('dirty-cash-val').textContent = fmtCash(st.dirtyCash);
  $('clean-cash-val').textContent = fmtCash(st.cleanCash);
  const rate = $('earn-rate');
  if (rate) rate.textContent = `+${fmtCash(earnPerMinute(st))}/m`;

  const actDef = camp.actInfo || ACTS[st.act] || ACTS[1];
  $('act-kicker').textContent = actDef.badge;
  $('day-sub').textContent = `Day ${st.day} · Fleet ${st.activeTrucks.length}/${sim.getMaxTrucks()}`;

  // Highest or selected regional heat
  const selReg = st.regions[st.selectedRegionId] || st.regions.rio_plata;
  const unlockedHeats = Object.values(st.regions)
    .filter((r) => r.unlocked)
    .map((r) => Number(r.heat) || 0);
  const maxHeat = unlockedHeats.length ? Math.max(...unlockedHeats) : 0;
  const displayHeat = Math.round(Math.max(Number(selReg?.heat) || 0, maxHeat));
  const heatOn = showHeat(view);
  const heatMeter = $('heat-meter');
  if (heatMeter) heatMeter.hidden = !heatOn;
  if (heatOn) {
    $('heat-val').textContent = `${displayHeat}%`;
    $('heat-bar-fill').style.width = `${Math.min(100, displayHeat)}%`;
    heatMeter.classList.toggle('is-hot', displayHeat >= 70);
  }
  const crewBtn = $('menu-crew');
  if (crewBtn) crewBtn.hidden = supplyChainOnly(view);
  for (const tabBtn of document.querySelectorAll('.go-menu-tab')) {
    if (tabBtn.id === 'menu-crew') continue;
    tabBtn.hidden = supplyChainOnly(view);
  }
  const sideEl = $('side-goal');
  const side = !supplyChainOnly(view) && camp.goals ? camp.goals.side : null;
  if (sideEl) {
    sideEl.hidden = !side;
    sideEl.textContent = side ? side.title : '';
  }

  // Speed & Pause buttons
  const pauseBtn = $('btn-pause');
  if (pauseBtn) {
    pauseBtn.classList.toggle('is-active', st.paused);
    pauseBtn.innerHTML = st.paused ? `${ICONS.play} <span>Resume</span>` : `${ICONS.pause} <span>Pause</span>`;
  }
  const speedBtn = $('btn-speed');
  if (speedBtn) {
    speedBtn.classList.toggle('is-active', st.speed > 1);
    speedBtn.textContent = `${st.speed}×`;
  }

  const tutoring = st.started && !st.tutorialDone && st.mode === 'campaign';
  const mission = camp.mission;
  const prog = camp.progress;
  const raidRegion = Object.values(st.regions).find((r) => r.raidActive);
  const zoneName = (id) => {
    const zone = (view.zones || []).find((item) => item.id === id);
    return zone ? zone.name : id;
  };
  if (camp.status === 'failed') {
    $('obj-title').textContent = camp.failReason || 'Campaign over';
    $('obj-prog-text').textContent = '';
    $('obj-desc').textContent = '';
    $('obj-beat').textContent = '';
    $('obj-meta').textContent = '';
    $('obj-next').hidden = true;
  } else if (!coreMode() && st.lossWarning && !riskLive(st)) {
    $('obj-title').textContent = 'The valley is no longer safe';
    $('obj-prog-text').textContent = '';
    $('obj-desc').textContent = st.lossWarning;
    $('obj-beat').textContent = '';
    $('obj-meta').textContent = '';
    $('obj-next').hidden = true;
  } else if (tutoring && !supplyChainOnly(view)) {
    const copy = tutorialCopy();
    const step = Math.min(copy.lines.length - 1, st.tutorialStep || 0);
    $('obj-title').textContent = copy.titles[step];
    $('obj-prog-text').textContent = '';
    $('obj-desc').textContent = copy.lines[step];
    $('obj-beat').textContent = '';
    $('obj-meta').textContent = '';
    $('obj-next').hidden = false;
    $('obj-next').textContent = step >= copy.lines.length - 1 ? 'Got it' : 'Next';
  } else if (raidRegion && !supplyChainOnly(view)) {
    $('obj-title').textContent = `Raid in ${zoneName(raidRegion.id)}`;
    $('obj-prog-text').textContent = `${Math.ceil(raidRegion.raidTimer)}s`;
    $('obj-desc').textContent = 'Bribe from the expanded line if you need the buildings back.';
    $('obj-beat').textContent = '';
    $('obj-meta').textContent = '';
    $('obj-next').hidden = true;
    $('raid-action-btn').dataset.region = raidRegion.id;
  } else if (supplyChainOnly(view)) {
    const guide = publishGuide(view);
    $('obj-title').textContent = guide ? guide.line : 'The chain is running';
    $('obj-prog-text').textContent = '';
    $('obj-desc').textContent = '';
    $('obj-beat').textContent = '';
    $('obj-meta').textContent = '';
    $('obj-reward').textContent = '';
    $('obj-next').hidden = true;
    if ($('obj-bar-fill')) {
      const pct = guide && guide.live ? (guide.index / guide.total) * 100 : (prog ? prog.pct : 0);
      $('obj-bar-fill').style.width = `${Math.max(0, Math.min(100, pct))}%`;
    }
  } else if (mission) {
    $('obj-title').textContent = mission.title;
    $('obj-prog-text').textContent = '';
    $('obj-desc').textContent = mission.desc || '';
    $('obj-beat').textContent = camp.beat || '';
    $('obj-reward').textContent = mission.rewardClean ? `+${fmtCash(mission.rewardClean)}` : '';
    if ($('obj-bar-fill') && prog) $('obj-bar-fill').style.width = `${prog.pct}%`;
    const who = camp.speaker ? camp.speaker.name : '';
    const dea = !supplyChainOnly(view) && camp.dea ? `Case ${camp.dea.case}` : '';
    const risk = (view.lieutenants || []).filter((lt) => lt.hired && lt.betrayalRisk >= 40)
      .sort((a, b) => b.betrayalRisk - a.betrayalRisk)[0];
    $('obj-meta').textContent = [who, dea, risk ? `${risk.name.split(' ')[0]} ${risk.betrayalRisk}` : ''].filter(Boolean).join(' · ');
    $('obj-next').hidden = true;
  } else {
    $('obj-title').textContent = camp.status === 'complete' ? 'Campaign complete' : 'No open objective';
    $('obj-prog-text').textContent = '';
    $('obj-desc').textContent = '';
    $('obj-beat').textContent = '';
    $('obj-meta').textContent = '';
    $('obj-next').hidden = true;
  }
  const raidBanner = $('raid-banner');
  const raidButton = $('raid-action-btn');
  const showWarning = !coreMode() && st.lossWarning && !riskLive(st);
  if (raidBanner) {
    raidBanner.classList.toggle('is-visible', showWarning);
    if (showWarning) {
      if ($('raid-title')) $('raid-title').textContent = 'THE VALLEY IS NO LONGER SAFE';
      if ($('raid-sub')) $('raid-sub').textContent = st.lossWarning;
      if (raidButton) raidButton.hidden = true;
    } else if (raidButton) {
      raidButton.hidden = false;
    }
  }

  const log = $('log-panel');
  if (log && !log.hidden) {
    log.innerHTML = (st.feed || []).slice(0, 14).map((row) => `<p><strong>${row.time}</strong> ${row.text}</p>`).join('') || '<p>Nothing logged.</p>';
  }
  const route = $('route-line');
  if (route) {
    const moving = (st.activeTrucks || []).slice(0, 1).map((truck) => {
      const good = GOODS[truck.goodId];
      const from = st.slots[truck.fromSlotId];
      const to = st.slots[truck.toSlotId];
      const fromName = from && from.buildingId ? BUILDINGS[from.buildingId].shortName : 'Lot';
      const toName = to && to.buildingId ? BUILDINGS[to.buildingId].shortName : 'Lot';
      return `${truck.qty} ${good ? good.shortName : 'cargo'} · ${fromName} → ${toName}`;
    });
    route.textContent = moving.length ? moving.join('   ') : 'Routes quiet until a truck rolls.';
  }
  renderTutorial();
  renderEvent();
}

function renderTutorial() {
  const bar = $('tutorial-bar');
  if (bar) bar.hidden = true;
}

const eventQueue = [];

function renderEvent() {
  const card = $('event-card');
  if (!card) return;
  const view = sim.gameplayView();
  if (supplyChainOnly(view) || !Object.prototype.hasOwnProperty.call(view, 'card')) {
    card.hidden = true;
    return;
  }
  const ev = view.card;
  card.hidden = !ev || !sim.state.started;
  if (!ev) return;
  const kicker = card.querySelector('.go-event-kicker');
  if (kicker) kicker.textContent = ev.speaker ? ev.speaker.name : 'Dispatch';
  $('event-title').textContent = ev.title;
  $('event-body').textContent = ev.body;
  $('event-actions').innerHTML = (ev.choices || []).map((choice, i) =>
    `<button type="button" class="go-action-btn" data-choice="${i}">${choice.label}</button>`
  ).join('');
}

function formatChainLine(bDef) {
  if (bDef.role === 'producer') {
    const [outId, qty] = Object.entries(bDef.outputs)[0];
    return `Produces ${qty}× ${GOODS[outId]?.shortName || outId} / ${bDef.cycleSeconds}s`;
  }
  if (bDef.role === 'processor') {
    const ins = Object.entries(bDef.inputs)
      .map(([id, q]) => `${q}× ${GOODS[id]?.shortName || id}`)
      .join(' + ');
    const [outId, outQ] = Object.entries(bDef.outputs)[0];
    return `${ins} → ${outQ}× ${GOODS[outId]?.shortName || outId}`;
  }
  if (bDef.role === 'smuggling') {
    return `Exports ${bDef.exportCapPerCycle} crates / ${bDef.cycleSeconds}s (${Math.round(bDef.priceMultiplier * 100)}% value)`;
  }
  if (bDef.role === 'launderer') {
    return `Launders $${bDef.launderPerCycle} Dirty → $${Math.round(bDef.launderPerCycle * bDef.launderRatio)} Clean`;
  }
  if (bDef.role === 'warehouse') {
    return `Stores ${bDef.storageCap} crates · +${bDef.trucksProvided} Fleet Trucks`;
  }
  return `+${bDef.trucksProvided} Fleet Trucks · +25% Road Speed`;
}

function renderDrawerContent() {
  const body = $('drawer-body');
  if (!body) return;

  const st = sim.state;
  const slotId = st.selectedSlotId || 'slot_rp_farm1';
  const slotDef = BUILD_SLOTS.find((s) => s.id === slotId) || BUILD_SLOTS[0];
  const slotState = st.slots[slotDef.id];
  const regDef = REGIONS.find((r) => r.id === slotDef.regionId) || REGIONS[0];
  const regState = st.regions[regDef.id];

  if (activeTab === 'slot') {
    const named = sim.gameplayView().zones.find((zone) => zone.id === slotDef.regionId);
    $('drawer-kicker').textContent = named ? named.name : slotDef.label;
    if (slotState.rivalControlled) {
      $('drawer-title').textContent = `Los Lobos Outpost (${slotDef.label})`;
      body.innerHTML = `
        <div class="go-card">
          <div class="go-card-top">
            <div class="go-card-title-group">
              <div class="go-cat-badge" style="color:var(--go-heat);border-color:var(--go-heat-border);background:var(--go-heat-bg)">${ICONS.rival}</div>
              <div>
                <h3 class="go-card-name">Los Lobos Fortified Compound</h3>
                <span class="go-card-role">Rival Syndicate Territory</span>
              </div>
            </div>
          </div>
          <p class="go-card-desc">Los Lobos sicarios control ${slotDef.label}, blocking construction and radiating border heat into your valley routes.</p>
          <div class="go-cost-tags">
            <span class="go-cost-tag go-cost-tag--dirty">$900 Dirty Cash</span>
            <span class="go-cost-tag go-cost-tag--clean">$350 Clean Cash</span>
          </div>
          <div class="go-btn-row">
            <button type="button" class="go-action-btn go-action-btn--dirty" data-action="clear-rival" data-slot="${slotDef.id}">
              ${ICONS.shield} Assault & Seize Lot
            </button>
          </div>
        </div>
      `;
      return;
    }

    if (slotState.buildingId) {
      const bDef = BUILDINGS[slotState.buildingId];
      $('drawer-title').textContent = `${bDef.name} (Tier ${slotState.level})`;
      const upgrade = sim.upgradeQuote(slotDef.id);
      const upgradeCost = upgrade ? (upgrade.dirty || upgrade.clean) : 0;
      const upgradePurse = upgrade && upgrade.dirty ? 'Dirty' : 'Clean';

      const inList = Object.entries(slotState.inputBuffer)
        .filter(([, q]) => q > 0)
        .map(([id, q]) => `${q}× ${GOODS[id]?.shortName || id}`)
        .join(', ') || 'Empty';
      const outList = Object.entries(slotState.outputBuffer)
        .filter(([, q]) => q > 0)
        .map(([id, q]) => `${q}× ${GOODS[id]?.shortName || id}`)
        .join(', ') || 'Empty';

      body.innerHTML = `
        <div class="go-card">
          <div class="go-card-top">
            <div class="go-card-title-group">
              <div class="go-cat-badge">${iconForCategory(bDef.category)}</div>
              <div>
                <h3 class="go-card-name">${bDef.name}</h3>
                <span class="go-card-role">Tier ${slotState.level}/3 · ${slotDef.label}</span>
              </div>
            </div>
          </div>
          <p class="go-card-desc">${bDef.desc}</p>
          <div class="go-chain-pill">
            <span>Throughput</span>
            <strong>${formatChainLine(bDef)}</strong>
          </div>
          <div class="go-chain-pill">
            <span>Input Stock: <strong>${inList}</strong></span>
            <span>Output Stock: <strong>${outList}</strong></span>
          </div>
          <div class="go-btn-row">
            ${
              upgrade
                ? `<button type="button" class="go-action-btn" data-action="upgrade-slot" data-slot="${slotDef.id}" ${
                    st.dirtyCash < (upgrade.dirty || 0) || st.cleanCash < (upgrade.clean || 0) ? 'disabled' : ''
                  }>
                    ${ICONS.upgrade} Upgrade Tier ${slotState.level + 1} ($${upgradeCost} ${upgradePurse})
                  </button>`
                : `<button type="button" class="go-action-btn" disabled>Max Tier Reached</button>`
            }
            <button type="button" class="go-action-btn go-action-btn--danger" data-action="demolish-slot" data-slot="${slotDef.id}" title="Deconstruct Facility">
              ${ICONS.demolish}
            </button>
          </div>
        </div>
        ${coreMode() ? '' : `<div class="go-card">
          <div class="go-card-top">
            <div>
              <h3 class="go-card-name">Regional Security & Heat (${regDef.name})</h3>
              <span class="go-card-role">Heat: ${Math.floor(regState.heat)}% · Town Loyalty: ${Math.floor(regState.loyalty)}%</span>
            </div>
          </div>
          <p class="go-card-desc">Donate clean or street funds to ${regDef.townName} civic projects to lower regional DEA heat and prevent raids.</p>
          <div class="go-btn-row">
            <button type="button" class="go-action-btn" data-action="bribe-region" data-region="${regDef.id}">
              ${ICONS.shield} Cool Regional Heat ($160 Clean / $200 Dirty)
            </button>
          </div>
        </div>`}
      `;
      return;
    }

    // Empty slot -> Contextual Build Menu filtered to allowed categories
    $('drawer-title').textContent = `Build at ${slotDef.label}`;
    if (!regState.unlocked) {
      body.innerHTML = `
        <div class="go-card">
          <h3 class="go-card-name">${regDef.name} Locked</h3>
          <p class="go-card-desc">${regDef.desc}</p>
          <div class="go-cost-tags">
            <span class="go-cost-tag go-cost-tag--clean">$${regDef.unlockCostClean} Clean Cash</span>
          </div>
          <div class="go-btn-row">
            <button type="button" class="go-action-btn" data-action="unlock-region" data-region="${regDef.id}">
              Expand into ${regDef.name}
            </button>
          </div>
        </div>
      `;
      return;
    }

    const candidates = BUILDING_LIST.filter((b) => slotDef.allowedCategories.includes(b.category));
    body.innerHTML = candidates
      .map((b) => {
        const lockedAct = st.act < b.act;
        const canAfford = st.dirtyCash >= b.buildCostDirty && st.cleanCash >= b.buildCostClean && !lockedAct;
        return `
          <div class="go-card">
            <div class="go-card-top">
              <div class="go-card-title-group">
                <div class="go-cat-badge">${iconForCategory(b.category)}</div>
                <div>
                  <h3 class="go-card-name">${b.name}</h3>
                  <span class="go-card-role">${b.category} · Act ${b.act}</span>
                </div>
              </div>
            </div>
            <p class="go-card-desc">${b.desc}</p>
            <div class="go-chain-pill">
              <span>Spec</span>
              <strong>${formatChainLine(b)}</strong>
            </div>
            <div class="go-cost-tags">
              ${b.buildCostDirty > 0 ? `<span class="go-cost-tag go-cost-tag--dirty">$${b.buildCostDirty} Dirty</span>` : ''}
              ${b.buildCostClean > 0 ? `<span class="go-cost-tag go-cost-tag--clean">$${b.buildCostClean} Clean</span>` : ''}
            </div>
            <div class="go-btn-row">
              <button type="button" class="go-action-btn go-action-btn--dirty" data-action="build-facility" data-slot="${slotDef.id}" data-building="${b.id}" ${
                !canAfford ? 'disabled' : ''
              }>
                ${ICONS.plus} ${lockedAct ? `Unlocks in Act ${b.act}` : `Construct ${b.shortName}`}
              </button>
            </div>
          </div>
        `;
      })
      .join('');
    return;
  }

  if (activeTab === 'lieutenants') {
    $('drawer-kicker').textContent = 'Syndicate Command';
    $('drawer-title').textContent = 'Lieutenants & Advisors';
    body.innerHTML = LIEUTENANTS.map((lt) => {
      const ls = st.lieutenants[lt.id];
      const hired = ls && ls.hired;
      const unlockedRegions = REGIONS.filter((r) => st.regions[r.id]?.unlocked);

      return `
        <div class="go-card">
          <div class="go-card-top">
            <div class="go-card-title-group">
              <div class="go-cat-badge" style="background:${lt.avatarBg};color:${lt.avatarAccent};border-color:${lt.avatarAccent}">
                ${ICONS.lieutenant}
              </div>
              <div>
                <h3 class="go-card-name">${lt.name}</h3>
                <span class="go-card-role">${lt.role} · Power ${lt.power}</span>
              </div>
            </div>
          </div>
          <div class="go-chain-pill">
            <span>${lt.perkName}</span>
            <strong>${hired ? `Loyalty ${ls.loyalty}%` : `$${lt.hireCostClean} Clean`}</strong>
          </div>
          <p class="go-card-desc">${lt.perkDesc}</p>
          ${
            hired
              ? `<div class="go-btn-row">
                  ${unlockedRegions
                    .map(
                      (r) => `
                      <button type="button" class="go-action-btn ${ls.regionId === r.id ? 'go-action-btn--dirty' : ''}" data-action="assign-lt" data-lt="${lt.id}" data-region="${r.id}">
                        ${ls.regionId === r.id ? 'Stationed: ' : 'Send to '}${r.name.split(' ')[0]}
                      </button>
                    `
                    )
                    .join('')}
                </div>`
              : `<div class="go-btn-row">
                  <button type="button" class="go-action-btn" data-action="hire-lt" data-lt="${lt.id}" ${
                    st.cleanCash < lt.hireCostClean ? 'disabled' : ''
                  }>
                    ${ICONS.plus} Recruit (${fmtCash(lt.hireCostClean)} Clean Cash)
                  </button>
                </div>`
          }
        </div>
      `;
    }).join('');
    return;
  }

  if (activeTab === 'territory') {
    $('drawer-kicker').textContent = 'Land';
    $('drawer-title').textContent = 'Zones';
    const land = sim.gameplayView();
    const regionsHtml = (land.zones || []).map((zone) => {
      const price = zone.unlock && zone.unlock.clean ? zone.unlock.clean : 0;
      const heat = !supplyChainOnly(land) && typeof zone.heat === 'number' ? `<span>Heat: <strong>${zone.heat}%</strong></span>` : '';
      return `
        <div class="go-card">
          <div class="go-card-top">
            <div class="go-card-title-group">
              <div class="go-cat-badge">${ICONS.mapPin}</div>
              <div>
                <h3 class="go-card-name">${zone.name}</h3>
                <span class="go-card-role">${zone.unlocked ? 'Open' : 'Locked'}</span>
              </div>
            </div>
          </div>
          <p class="go-card-desc">${zone.desc || ''}</p>
          <div class="go-chain-pill">
            <span>Status: <strong>${zone.unlocked ? 'Open' : 'Locked'}</strong></span>
            ${heat}
          </div>
          <div class="go-btn-row">
            <button type="button" class="go-action-btn" data-action="focus-zone" data-zone="${zone.id}">Show ${zone.name}</button>
            ${zone.unlocked || (zone.blockers && zone.blockers.length) ? '' : `<button type="button" class="go-action-btn" data-action="unlock-zone" data-zone="${zone.id}" ${st.cleanCash < price ? 'disabled' : ''}>Unlock $${price}</button>`}
          </div>
        </div>
      `;
    }).join('');

    const strainsHtml = STRAINS.map((s) => {
      const owned = st.unlockedStrains.includes(s.id);
      const active = st.activeStrain === s.id;
      return `
        <div class="go-card">
          <div class="go-card-top">
            <div class="go-card-title-group">
              <div class="go-cat-badge">${ICONS.production}</div>
              <div>
                <h3 class="go-card-name">${s.name}</h3>
                <span class="go-card-role">${s.speedMult}× Speed · ${s.valueMult}× Value · ${s.heatMult}× Heat</span>
              </div>
            </div>
          </div>
          <p class="go-card-desc">${s.desc}</p>
          <div class="go-btn-row">
            <button type="button" class="go-action-btn ${active ? 'go-action-btn--dirty' : ''}" data-action="select-strain" data-strain="${s.id}">
              ${active ? 'Active Plantation Cultivar' : owned ? 'Switch Cultivar' : `Research Cultivar ($${s.unlockCostClean} Clean)`}
            </button>
          </div>
        </div>
      `;
    }).join('');

    body.innerHTML = regionsHtml + strainsHtml;
    return;
  }

  if (activeTab === 'research') {
    $('drawer-kicker').textContent = 'Lab';
    $('drawer-title').textContent = 'Research';
    body.innerHTML = RESEARCH.map((node) => {
      const owned = !!st.research[node.id];
      const locked = node.requires && !st.research[node.requires];
      const prev = RESEARCH.find((item) => item.id === node.requires);
      return `
        <div class="go-card">
          <div class="go-card-top">
            <div>
              <h3 class="go-card-name">${node.name}</h3>
              <span class="go-card-role">${owned ? 'On the books' : locked ? 'Needs ' + (prev ? prev.name : 'prior work') : '$' + node.cost + ' clean'}</span>
            </div>
          </div>
          <p class="go-card-desc">${node.desc}</p>
          <div class="go-btn-row">
            <button type="button" class="go-action-btn" data-action="buy-research" data-research="${node.id}" ${owned || locked || st.cleanCash < node.cost ? 'disabled' : ''}>
              ${owned ? 'Installed' : 'Research'}
            </button>
          </div>
        </div>`;
    }).join('');
  }
}

function closeSheets() {
  openLotId = null;
  openZoneId = null;
  const lot = $('lot-card');
  const zone = $('zone-card');
  if (lot) lot.hidden = true;
  if (zone) zone.hidden = true;
  if (phaserGame) phaserGame.registry.set('openLotId', null);
  setGhost(null);
}

function purseWord(zone) {
  if (coreMode()) return 'dirty';
  return zone && zone.kind === 'city' ? 'clean' : 'dirty';
}

const PURSE = {
  dirty: '<svg class="go-purse go-purse--dirty" viewBox="0 0 20 20" aria-label="dirty cash"><rect x="2" y="5" width="16" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="10" cy="10" r="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  clean: '<svg class="go-purse go-purse--clean" viewBox="0 0 20 20" aria-label="clean cash"><path d="M3 8l7-5 7 5v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7 18v-6h6v6" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>'
};

function purse(kind) {
  return PURSE[kind] || PURSE.dirty;
}

function costBits(dirty, clean) {
  const bits = [];
  if (dirty) bits.push(`<span class="go-price">${fmtCash(dirty)}${purse('dirty')}</span>`);
  if (clean) bits.push(`<span class="go-price">${fmtCash(clean)}${purse('clean')}</span>`);
  if (!bits.length) bits.push('no cash');
  return bits.join('');
}

function bonusLine(bonus) {
  if (!bonus || typeof bonus !== 'object') return '';
  const bits = [];
  if (bonus.growMult && bonus.growMult !== 1) bits.push(`growth ${Math.round((bonus.growMult - 1) * 100)}%`);
  if (bonus.heatMult && bonus.heatMult !== 1) bits.push(`heat ${Math.round((bonus.heatMult - 1) * 100)}%`);
  if (bonus.storage) bits.push(`+${bonus.storage} stash`);
  if (bonus.level) bits.push(`level ${bonus.level}`);
  if (bonus.boatCapacity) bits.push(`+${bonus.boatCapacity} boat room`);
  if (bonus.planeCapacity) bits.push(`+${bonus.planeCapacity} plane room`);
  if (bonus.boatRisk) bits.push('quieter boats');
  if (bonus.planeRisk) bits.push('quieter flights');
  return bits.join(' · ');
}

function buildQuote(lot, buildingId) {
  const def = lotDef(lot.id);
  const building = BUILDINGS[buildingId];
  if (!def || !building) return null;
  const seconds = buildSeconds(def, buildingId, false);
  const scale = lot.kind === 'open' ? 0.85 : 1;
  return {
    name: building.shortName,
    dirty: Math.round((building.buildCostDirty || 0) * scale),
    clean: Math.round((building.buildCostClean || 0) * scale),
    seconds
  };
}

function showReveal() {
  const banner = $('reveal-banner');
  if (banner) banner.hidden = true;
}

function setControl(on) {
  if (phaserGame) phaserGame.registry.set('showControl', !!on);
  const btn = $('btn-control');
  if (!btn) return;
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  btn.classList.toggle('is-active', !!on);
}

function openLot(lotId) {
  const data = sim.gameplayView();
  const lot = data.lots.find((item) => item.id === lotId);
  if (!lot) return;
  if (lot.slotId) {
    const slotDef = BUILD_SLOTS.find((item) => item.id === lot.slotId);
    sim.state.selectedSlotId = lot.slotId;
    if (slotDef) sim.state.selectedRegionId = slotDef.regionId;
  }
  const zone = data.zones.find((item) => item.id === lot.zoneId);
  if (!zone || !zone.unlocked) {
    openZone(lot.zoneId);
    return;
  }
  const mix = $('mix-panel');
  if (mix) {
    mix.hidden = true;
    $('btn-mute').setAttribute('aria-expanded', 'false');
  }
  openZoneId = null;
  if ($('zone-card')) $('zone-card').hidden = true;
  openLotId = lotId;
  sheetNote = '';
  drawerOpen = false;
  syncDrawerVisibility();
  if (phaserGame) phaserGame.registry.set('openLotId', lotId);
  renderLot();
}

function openZone(zoneId) {
  const mix = $('mix-panel');
  if (mix) {
    mix.hidden = true;
    $('btn-mute').setAttribute('aria-expanded', 'false');
  }
  openLotId = null;
  if ($('lot-card')) $('lot-card').hidden = true;
  if (phaserGame) phaserGame.registry.set('openLotId', null);
  openZoneId = zoneId;
  sheetNote = '';
  drawerOpen = false;
  syncDrawerVisibility();
  renderZone();
  if (mapScene) mapScene.frameZone(zoneId, false);
}

function renderLot() {
  const card = $('lot-card');
  if (!card || !openLotId) {
    if (card) card.hidden = true;
    return;
  }
  const data = sim.gameplayView();
  const lot = data.lots.find((item) => item.id === openLotId);
  if (!lot) {
    closeSheets();
    return;
  }
  const zone = data.zones.find((item) => item.id === lot.zoneId);
  const def = lotDef(lot.id);
  card.hidden = false;
  const cardBox = card.querySelector('.go-sheet-card');
  const compact = lot.phase === 'building' || lot.phase === 'demolishing' || (lot.phase === 'operating' && lot.buildingId && !lot.actions.includes('buildNew') && !lot.actions.includes('buyAndConvert'));
  if (cardBox) {
    cardBox.classList.toggle('is-ops', !!compact);
    cardBox.classList.remove('is-need');
  }
  $('lot-kicker').textContent = zone ? zone.name : '';
  $('lot-title').textContent = lot.propertyLabel || lot.label;
  const pay = purseWord(zone);
  const bonus = bonusLine(lot.bonus);
  const bits = [];
  if (!supplyChainOnly(data) && zone && typeof zone.heat === 'number') bits.push(`Heat ${zone.heat}`);
  if (!supplyChainOnly(data) && zone && typeof zone.control === 'number') bits.push(`Control ${zone.control}%`);
  if (lot.phase === 'operating' && lot.role) bits.unshift(ROLE_NAME[lot.role] || lot.role);
  if (bonus) bits.push(bonus);
  $('lot-meta').textContent = bits.join(' · ');
  const gate = $('lot-gate');
  const canTalk = !supplyChainOnly(data) && (lot.actions.includes('negotiate') || lot.actions.includes('intimidate'));
  gate.hidden = !canTalk;
  gate.innerHTML = canTalk ? `<p>The owner has not agreed to sell.</p><div class="go-gate-row">
      ${lot.actions.includes('negotiate') ? '<button type="button" data-deal="negotiate">Negotiate</button>' : ''}
      ${lot.actions.includes('intimidate') ? '<button type="button" data-deal="intimidate">Intimidate</button>' : ''}
    </div>` : '';
  const paths = $('lot-paths');
  if (lot.kind === 'open' && lot.phase !== 'building' && lot.phase !== 'operating') {
    paths.className = 'go-lot-paths is-single';
    paths.innerHTML = plotColumn(lot);
  } else if (lot.phase === 'demolishing' || lot.phase === 'building' || (lot.phase === 'operating' && lot.buildingId && !lot.actions.includes('buildNew') && !lot.actions.includes('buyAndConvert'))) {
    paths.className = 'go-lot-paths is-single';
    paths.innerHTML = opsPanel(lot);
    const built = lot.buildingId ? BUILDINGS[lot.buildingId] : null;
    const talk = built ? buildingTalk(built) : null;
    $('lot-title').textContent = talk ? talk.name : (lot.propertyLabel || lot.label);
    $('lot-meta').textContent = '';
    const fix = starveFix(lot);
    $('lot-kicker').textContent = fix ? fix.line : (talk ? talk.line : '');
    if (cardBox) cardBox.classList.toggle('is-need', !!fix);
  } else {
    paths.className = 'go-lot-paths';
    const canBuy = lot.actions.includes('buyAndConvert');
    const canLot = lot.actions.includes('buyLot') || lot.actions.includes('startDemolish') || lot.actions.includes('buildNew');
    paths.innerHTML = convertColumn(lot, pay, canBuy) + rebuildColumn(lot, def, canLot, pay);
  }
  $('lot-note').textContent = sheetNote;
}

function goodSwatch(goodId) {
  const good = GOODS[goodId];
  if (!good) return '';
  return `<i class="go-good" title="${good.shortName}" style="background:${good.badgeBg};box-shadow:inset 0 0 0 1.5px ${good.badgeInk}"></i>`;
}

const BUILD_TALK = {
  plantation: ['Farm', 'Grows leaf', 'Farm is growing leaf'],
  coffee_estate: ['Coffee farm', 'Grows coffee. Pays clean', 'Coffee farm is growing coffee'],
  highland_farm: ['Highland farm', 'Grows leaf', 'Highland farm is growing leaf'],
  drying_barn: ['Lab', 'Turns leaf into product', 'Lab is making product'],
  packaging_mill: ['Packer', 'Hides product in coffee', 'Packer is hiding product'],
  chem_lab: ['Chem lab', 'Turns leaf into product', 'Chem lab is making product'],
  warehouse: ['Warehouse', 'Stores product', 'Warehouse is storing product'],
  transport_depot: ['Depot', 'Adds trucks', 'Depot is sending trucks'],
  river_pier: ['Pier', 'Sells product for cash', 'Pier is selling for cash'],
  aerodrome: ['Airstrip', 'Sells product for cash', 'Airstrip is selling for cash'],
  taxi_co: ['Taxi front', 'Turns dirty cash clean', 'Taxi front is cleaning cash'],
  salsa_club: ['Club', 'Turns dirty cash clean', 'Club is cleaning cash'],
  banco_regional: ['Bank', 'Turns dirty cash clean', 'Bank is cleaning cash']
};

function buildingTalk(building) {
  const row = building && BUILD_TALK[building.id];
  if (row) return { name: row[0], line: row[1], done: row[2] };
  return { name: building ? building.shortName : 'Building', line: 'Does its job', done: 'Building is working' };
}

function quoteBuild(building, slotId) {
  const homes = [];
  const consider = (def) => {
    if (!def) return;
    const slot = sim.state.slots[def.id];
    const reg = sim.state.regions[def.regionId];
    if (!slot || !reg || !reg.unlocked || slot.buildingId || slot.rivalControlled) return;
    if (def.allowedCategories && !def.allowedCategories.includes(building.category)) return;
    homes.push(def);
  };
  if (slotId) consider(slotDefOf(slotId));
  else BUILD_SLOTS.forEach(consider);
  let dirty = building.buildCostDirty || 0;
  let clean = building.buildCostClean || 0;
  homes.forEach((def) => {
    const lot = sim.state.lots && sim.state.lots[def.id];
    const scale = lot && lot.kind === 'open' ? 0.85 : 1;
    const nextDirty = Math.round((building.buildCostDirty || 0) * scale);
    const nextClean = Math.round((building.buildCostClean || 0) * scale);
    if (nextDirty + nextClean < dirty + clean) {
      dirty = nextDirty;
      clean = nextClean;
    }
  });
  return { dirty, clean };
}

function recipeRow(building) {
  const ins = Object.entries(building.inputs || {});
  const outs = Object.entries(building.outputs || {});
  const left = [];
  const right = [];
  ins.forEach(([id, qty]) => left.push(`${goodSwatch(id)}<b>${qty}</b>`));
  outs.forEach(([id, qty]) => right.push(`${goodSwatch(id)}<b>${qty}</b>`));
  if (!left.length && !right.length && building.role === 'launderer') {
    left.push(purse('dirty'));
    right.push(purse('clean'));
  } else if (!left.length && !right.length && building.role === 'smuggling') {
    left.push(goodSwatch('cured_pack'));
    right.push(purse('dirty'));
  } else if (!left.length && !right.length && building.role === 'warehouse') {
    left.push(goodSwatch('cured_pack'));
  } else if (!left.length && !right.length && building.trucksProvided) {
    left.push(`<b>+${building.trucksProvided}</b>`);
  }
  const bits = left.slice();
  if (left.length && right.length) bits.push('<span class="go-ops-arrow" aria-hidden="true"></span>');
  right.forEach((bit) => bits.push(bit));
  if (!bits.length) return '';
  return `<span class="go-build-flow">${bits.join('')}</span>`;
}

function buildCard(building, opts) {
  const talk = buildingTalk(building);
  const icon = artURL(iconKeyForBuilding(building.id));
  const price = quoteBuild(building, opts.slotId);
  const attr = opts.attr || 'place';
  return `<button type="button" class="go-build-card${opts.cls || ''}" data-${attr}="${building.id}" aria-label="${talk.name}. ${talk.line}" ${opts.off ? 'disabled' : ''}>${icon ? `<img alt="" src="${icon}">` : ''}<b>${talk.name}</b><em>${talk.line}</em><small>${costBits(price.dirty, price.clean)}</small>${recipeRow(building)}</button>`;
}

const seenBuild = new Set();
let toastTimer = 0;

function showBuildToast(text) {
  const el = $('build-toast');
  if (!el || !text) return;
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
}

function onBuildingReady(buildingId) {
  if (!buildingId || seenBuild.has(buildingId)) return;
  const building = BUILDINGS[buildingId];
  if (!building) return;
  seenBuild.add(buildingId);
  showBuildToast(buildingTalk(building).done);
}

function starveFix(lot) {
  const slotId = lot.slotId || lot.id;
  const slot = sim.state.slots[slotId];
  const building = slot && slot.buildingId ? BUILDINGS[slot.buildingId] : null;
  if (!slot || !building || building.role !== 'processor' || (slot.constructLeft || 0) > 0) return null;
  const missing = Object.keys(building.inputs || {}).find((id) => (slot.inputBuffer[id] || 0) < building.inputs[id] && (slot.progress || 0) < 0.05);
  if (missing === 'raw_herb' && sim.upgradeQuote('slot_rp_farm1')) {
    return { line: 'Needs leaf. Upgrade the farm', deal: 'fix-upgrade', slot: 'slot_rp_farm1' };
  }
  return null;
}

function opsPanel(lot) {
  const slotId = lot.slotId || lot.id;
  const slot = sim.state.slots[slotId];
  const buildingId = (slot && slot.buildingId) || lot.buildingId || queuedBuild[lot.id];
  const building = buildingId ? BUILDINGS[buildingId] : null;
  const icon = building ? artURL(iconKeyForBuilding(building.id)) : '';
  const bits = [];
  if (lot.phase === 'building' || lot.phase === 'demolishing') {
    const left = lot.phase === 'demolishing' ? lot.demolishLeft : lot.constructLeft;
    const total = lot.phase === 'demolishing' ? Math.max(left, 8) : 60;
    const pct = Math.max(4, Math.min(100, Math.round((1 - left / total) * 100)));
    bits.push(`<i class="go-mini-ring" style="--p:${pct}"></i>`);
  } else if (building) {
    const ins = Object.entries(building.inputs || {});
    const outs = Object.entries(building.outputs || {});
    const level = slot ? slot.level || 1 : 1;
    const pace = 1 + (level - 1) * 0.4;
    const rate = [];
    ins.forEach(([id, qty]) => rate.push(`${goodSwatch(id)}<b>${qty}</b>`));
    if (ins.length && outs.length) rate.push('<span class="go-ops-arrow" aria-hidden="true"></span>');
    outs.forEach(([id, qty]) => rate.push(`${goodSwatch(id)}<b>${qty}</b>`));
    if (!ins.length && !outs.length && building.role === 'launderer') rate.push(`<b>$${Math.round(building.launderPerCycle * pace)}</b>`);
    else if (!ins.length && !outs.length && building.trucksProvided) rate.push(`<b>+${building.trucksProvided + level - 1}</b>`);
    else if (!ins.length && !outs.length && building.exportCapPerCycle) rate.push(`<b>${building.exportCapPerCycle * level}</b>`);
    if (building.cycleSeconds) rate.push(`<em>${Math.max(1, Math.round(building.cycleSeconds / pace))}s</em>`);
    bits.push(`<div class="go-ops-rate">${rate.join('')}</div>`);
    const stock = [];
    if (slot) {
      for (const [id, qty] of Object.entries(slot.outputBuffer || {})) if (qty > 0) stock.push(`${goodSwatch(id)}<b>${qty}</b>`);
      for (const [id, qty] of Object.entries(slot.inputBuffer || {})) if (qty > 0) stock.push(`${goodSwatch(id)}<b>${qty}</b>`);
    }
    bits.push(`<div class="go-ops-stock">${stock.join('')}</div>`);
    const fix = starveFix(lot);
    if (fix && fix.deal === 'fix-farm') {
      const afford = sim.state.dirtyCash >= fix.cost && sim.state.cleanCash >= (fix.clean || 0);
      bits.push(`<button type="button" class="go-ops-fix" data-deal="fix-farm" data-slot="${fix.slot}" ${afford ? '' : 'disabled'} aria-label="Build another farm">Farm <small>${fmtCash(fix.cost)}${purse('dirty')}</small></button>`);
    } else if (fix && fix.deal === 'fix-upgrade') {
      const quote = sim.upgradeQuote(fix.slot);
      const afford = quote && sim.state.dirtyCash >= (quote.dirty || 0) && sim.state.cleanCash >= (quote.clean || 0);
      const price = quote && quote.dirty ? `${fmtCash(quote.dirty)}${purse('dirty')}` : quote ? `${fmtCash(quote.clean)}${purse('clean')}` : '';
      bits.push(`<button type="button" class="go-ops-fix" data-deal="fix-upgrade" data-slot="${fix.slot}" ${afford ? '' : 'disabled'} aria-label="Upgrade the farm"><svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M10 15V5M6 9l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><small>+40% ${price}</small></button>`);
    }
    if (slot && building.role === 'smuggling') {
      const buyer = slot.buyer === 'cafe' ? 'cafe' : slot.buyer === 'street' ? 'street' : '';
      bits.push(`<div class="go-buyer"><button type="button" data-deal="buyer" data-buyer="street" class="${buyer === 'street' ? 'is-on' : ''}" aria-label="Street, more dirty cash"><b>Street</b> <small>$ more dirty</small></button><button type="button" data-deal="buyer" data-buyer="cafe" class="${buyer === 'cafe' ? 'is-on' : ''}" aria-label="Cafe, more clean cash"><b>Cafe</b> <small>$ more clean</small></button></div>`);
    }
    if (slot) {
      const quote = sim.upgradeQuote(slotId);
      if (quote) {
        const afford = sim.state.dirtyCash >= (quote.dirty || 0) && sim.state.cleanCash >= (quote.clean || 0);
        const price = quote.dirty ? `${fmtCash(quote.dirty)}${purse('dirty')}` : `${fmtCash(quote.clean)}${purse('clean')}`;
        const effect = building.trucksProvided ? '+1 truck' : '+40% speed';
        bits.push(`<button type="button" class="go-ops-up" data-deal="upgrade" ${afford ? '' : 'disabled'} aria-label="Upgrade, ${effect}"><svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M10 15V5M6 9l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><small>${effect} ${price}</small></button>`);
      }
    }
  }
  return `<section class="go-ops">${icon ? `<img alt="" width="64" height="64" src="${icon}">` : ''}${bits.join('')}</section>`;
}

let placingId = null;

function buildChoices() {
  const st = sim.state;
  const empty = BUILD_SLOTS.filter((def) => {
    const slot = st.slots[def.id];
    const reg = st.regions[def.regionId];
    return slot && reg && reg.unlocked && !slot.buildingId && !slot.rivalControlled;
  });
  return BUILDING_LIST.filter((building) => {
    if (st.mode !== 'sandbox' && st.act < building.act) return false;
    return empty.some((def) => !def.allowedCategories || def.allowedCategories.includes(building.category));
  });
}

function renderBuildStrip() {
  const strip = $('build-strip');
  if (!strip || strip.hidden) return;
  const mission = (sim.gameplayView().campaign || {}).mission;
  const rec = mission && mission.buildingId;
  const lock = teachActive();
  const aiming = lock && TEACH[teachStep].id === 'pick';
  const goal = postLive() ? POST[postStep] : null;
  const aimed = goal ? (goal.buildings || (goal.building ? [goal.building] : [])) : [];
  const choices = buildChoices().slice();
  if (lock) {
    const rank = { plantation: 0, drying_barn: 1, warehouse: 2 };
    choices.sort((a, b) => (rank[a.id] ?? 9) - (rank[b.id] ?? 9));
  } else if (aimed.length) {
    choices.sort((a, b) => (aimed.includes(a.id) ? -1 : aimed.includes(b.id) ? 1 : 0));
  }
  strip.innerHTML = choices.map((building) => {
    const on = placingId === building.id ? ' is-on' : '';
    const mark = !lock && rec === building.id ? ' is-rec' : '';
    const aim = (aiming && building.id === TEACH_LAB) || aimed.includes(building.id) ? ' is-aim' : '';
    return buildCard(building, { cls: `${on}${mark}${aim}`, off: lock && building.id !== TEACH_LAB });
  }).join('');
  const aimBtn = strip.querySelector('.is-aim');
  if (aimBtn && window.innerWidth >= 820) {
    strip.scrollLeft = Math.max(0, aimBtn.offsetLeft - (strip.clientWidth - aimBtn.offsetWidth) / 2);
  }
}

function closeLotPicker() {
  pickerSlot = null;
  const picker = $('lot-picker');
  if (!picker) return;
  picker.hidden = true;
  picker.innerHTML = '';
}

function openLotPicker(slotId) {
  const def = slotDefOf(slotId);
  if (!def) return;
  pickerSlot = slotId;
  closeSheets();
  const strip = $('build-strip');
  if (strip) strip.hidden = true;
  const picker = $('lot-picker');
  if (!picker) return;
  const lock = teachActive();
  const goal = postLive() ? POST[postStep] : null;
  const aimed = goal && goal.slot === slotId ? (goal.buildings || []) : [];
  let choices = buildChoices().filter((building) => !def.allowedCategories || def.allowedCategories.includes(building.category));
  if (lock) {
    const lab = BUILDINGS[TEACH_LAB];
    choices = lab ? [lab] : [];
  } else if (aimed.length) {
    choices = choices.slice().sort((a, b) => (aimed.includes(a.id) ? -1 : aimed.includes(b.id) ? 1 : 0));
  }
  picker.innerHTML = choices.map((building) => {
    const isLab = building.id === TEACH_LAB;
    const allow = lock ? isLab && labFits(slotId) : true;
    const aim = (lock && isLab && allow) || aimed.includes(building.id) ? ' is-aim' : '';
    return buildCard(building, { attr: 'pick', slotId, cls: aim, off: !allow });
  }).join('');
  picker.hidden = false;
}

function onEmptyLot(slotId) {
  bumpTeach();
  if (!canBuildOn(slotId)) {
    selectSlot(slotId, true);
    return;
  }
  openLotPicker(slotId);
  if (!teachActive()) {
    renderHud();
    return;
  }
  const step = TEACH[teachStep];
  if (step.id === 'confirm') return;
  teachNudge = false;
  if (labFits(slotId)) teachStep = 1;
  else if (step.id === 'build' || step.id === 'pick') teachStep = 2;
  renderHud();
}

function onLotTapped(slotId) {
  bumpTeach();
  closeLotPicker();
  if (!teachActive() || placingId !== TEACH_LAB) return;
  const step = TEACH[teachStep];
  if (step.id !== 'lot' && step.id !== 'confirm') return;
  if (slotId === TEACH_LOT && labFits(slotId)) {
    teachStep = 3;
    teachNudge = false;
    const strip = $('build-strip');
    if (strip) strip.hidden = true;
    renderHud();
  }
}

function beginPlace(buildingId, lockSlot) {
  placingId = buildingId;
  setGhost(null);
  closeSheets();
  const picker = $('lot-picker');
  if (picker) {
    picker.hidden = true;
    picker.innerHTML = '';
  }
  pickerSlot = null;
  if (phaserGame) {
    phaserGame.registry.set('placing', { buildingId });
    phaserGame.registry.set('snapLock', lockSlot || null);
  }
  const strip = $('build-strip');
  if (strip) strip.hidden = !!lockSlot;
  if (!lockSlot && strip) {
    strip.hidden = false;
    renderBuildStrip();
  }
}

function stopPlace() {
  placingId = null;
  if (phaserGame) {
    phaserGame.registry.set('placing', null);
    phaserGame.registry.set('placeSnap', null);
    phaserGame.registry.set('snapLock', null);
  }
  const hud = $('place-hud');
  if (hud) {
    hud.hidden = true;
    hud.classList.remove('is-thumb');
  }
  renderBuildStrip();
}

function confirmPlace() {
  const snap = phaserGame && phaserGame.registry.get('placeSnap');
  if (!snap || !snap.ok) return;
  if (teachActive()) {
    const step = TEACH[teachStep];
    if (!step || step.id !== 'confirm') return;
    if (snap.id !== TEACH_LOT || snap.buildingId !== TEACH_LAB) return;
  }
  const result = sim.buildOnSlot(snap.id, snap.buildingId);
  if (!result.ok) return;
  stopPlace();
  closeLotPicker();
  const strip = $('build-strip');
  if (strip) strip.hidden = true;
  if (mapScene) mapScene.focusOnSlot(snap.id, true);
  renderHud();
}

function setGhost(next) {
  ghost = next;
  if (phaserGame) phaserGame.registry.set('ghost', next);
}

function thumb(kind) {
  const card = cardKeyForRole(kind) || cardKeyForBuilding(kind);
  const icon = iconKeyForRole(kind);
  return artPair(card, icon);
}

function tileName(name) {
  const short = {
    'Stash house': 'Stash',
    Distribution: 'Routes',
    Safehouse: 'Safe',
    'Regional Bank': 'Bank',
    'Truck Depot': 'Depot',
    'Salsa Club': 'Club',
    'Packer Mill': 'Mill'
  };
  return short[name] || name;
}

function artPair(cardKey, iconKey) {
  const card = artURL(cardKey);
  const icon = artURL(iconKey);
  return `<span class="go-tile-art">${card ? `<img class="go-card-img" alt="" width="176" height="120" src="${card}">` : ''}${icon ? `<img class="go-icon-img" alt="" width="64" height="64" src="${icon}">` : ''}</span>`;
}

function effectOf(building) {
  if (!building) return '';
  if (building.role === 'launderer') return `Washes $${building.launderPerCycle}`;
  if (building.trucksProvided) return `+${building.trucksProvided} trucks`;
  if (building.role === 'warehouse') return `Stores ${building.storageCap}`;
  if (building.heatRate < 0) return 'Cools heat';
  if (building.id === 'coffee_estate') return 'Pays clean';
  if (building.id === 'plantation') return 'Pays dirty';
  if (building.role === 'producer') return 'Grows crop';
  if (building.role === 'processor') return 'Processes';
  if (building.role === 'smuggling') return 'Exports';
  return '';
}

function tileButton(opts) {
  const on = ghost && ghost.lotId === opts.lotId && ghost.key === opts.key;
  const pictures = opts.building
    ? artPair(cardKeyForBuilding(opts.building), iconKeyForBuilding(opts.building))
    : artPair(cardKeyForRole(opts.role || opts.thumb), iconKeyForRole(opts.role || opts.thumb));
  const label = tileName(opts.name);
  const tip = [opts.name, opts.effect].filter(Boolean).join('. ');
  return `<button type="button" class="go-tile${on ? ' is-on' : ''}${opts.rec ? ' is-rec' : ''}" title="${tip}" data-deal="pick" data-path="${opts.path}" data-key="${opts.key}" data-role="${opts.role || ''}" data-building="${opts.building || ''}" ${opts.enabled ? '' : 'disabled'}>${pictures}<b>${label}</b><small>${opts.cost}</small></button>`;
}

function previewRow(nowKind, nextKind, nowName, nextName) {
  if (!ghost || ghost.lotId !== openLotId) return '';
  return `<div class="go-preview"><span>${thumb(nowKind)}<small>Now</small><b>${nowName}</b></span><span>${thumb(nextKind)}<small>After</small><b>${nextName}</b></span></div><button type="button" class="go-cta-btn" data-deal="confirm">Confirm</button>`;
}

function purseCash(pay) {
  return pay === 'clean' ? sim.state.cleanCash : sim.state.dirtyCash;
}

function affordNote(amount, pay, okNote) {
  const gap = Math.max(0, Math.ceil((amount || 0) - purseCash(pay)));
  return { gap, note: gap ? `Need ${fmtCash(gap)}` : okNote };
}

function convertColumn(lot, pay, enabled) {
  const roles = Object.entries(lot.fits || {}).filter(([, fit]) => fit && fit.allowed);
  const rec = roles.find(([, fit]) => fit.fit === 'boost') || roles[0];
  const afford = affordNote(lot.buyPrice || 0, pay, 'Cheaper, faster');
  const can = enabled && !afford.gap;
  const buttons = roles.map(([role, fit]) => tileButton({
    lotId: lot.id,
    path: 'convert',
    key: 'convert:' + role,
    role,
    thumb: lot.propertyType || 'lot',
    name: ROLE_NAME[role] || role,
    cost: `${fmtCash(lot.buyPrice)}${purse(pay)}`,
    effect: fit.fit === 'boost' ? 'Strong fit' : fit.fit === 'limit' ? 'Tight fit' : 'Fits',
    enabled: can,
    rec: rec && rec[0] === role
  })).join('');
  const picked = ghost && ghost.path === 'convert' && ghost.lotId === lot.id;
  const after = picked ? (ROLE_NAME[ghost.role] || ghost.role) : '';
  const best = roles.find(([, fit]) => fit.fit === 'boost') || roles[0];
  const one = coreMode() && best
    ? tileButton({
      lotId: lot.id,
      path: 'convert',
      key: 'convert:' + best[0],
      role: best[0],
      thumb: lot.propertyType || 'lot',
      name: ROLE_NAME[best[0]] || best[0],
      cost: `${fmtCash(lot.buyPrice)}${purse(pay)}`,
      effect: 'Cheaper, faster',
      enabled: can,
      rec: true
    })
    : buttons;
  return `<section class="go-path${afford.gap ? ' is-short' : ''}" data-path="convert"><h3>Buy &amp; convert</h3><p class="go-path-note">${afford.note}</p><div class="go-tile-row">${one}</div>${picked ? previewRow(lot.propertyType || 'lot', lot.propertyType || 'lot', lot.propertyLabel || lot.label, after) : ''}</section>`;
}

function offerBuilding(zone, buildingId) {
  const building = BUILDINGS[buildingId];
  if (!building || !zone) return false;
  if (zone.kind === 'city') {
    if (building.category === 'production') return false;
    if (buildingId === 'river_pier' || buildingId === 'drying_barn') return false;
    if (buildingId === 'aerodrome') return zone.id === 'ps_airport';
    return building.category === 'laundering' || building.category === 'logistics' || buildingId === 'chem_lab';
  }
  if (buildingId === 'salsa_club' || buildingId === 'banco_regional') return false;
  if (buildingId === 'aerodrome') return zone.id === 'mesa_strip';
  return true;
}

function listedBuilds(lot) {
  const zone = sim.gameplayView().zones.find((item) => item.id === lot.zoneId);
  return (lot.builds || []).filter((id) => offerBuilding(zone, id));
}

function rebuildColumn(lot, def, enabled, pay) {
  const seconds = def ? def.demolishSeconds : 0;
  const afford = affordNote((lot.lotPrice || 0) + (lot.demolishCost || 0), pay, '');
  const can = enabled && !afford.gap;
  const ids = listedBuilds(lot);
  const rec = ids.includes('taxi_co') ? 'taxi_co' : ids[0];
  const buttons = ids.map((id) => {
    const quote = buildQuote(lot, id);
    if (!quote) return '';
    const building = BUILDINGS[id];
    return tileButton({
      lotId: lot.id,
      path: 'rebuild',
      key: 'rebuild:' + id,
      building: id,
      thumb: id,
      name: quote.name,
      cost: `${costBits(quote.dirty, quote.clean)} · ${quote.seconds}s`,
      effect: effectOf(building),
      enabled: can,
      rec: id === rec
    });
  }).join('');
  const picked = ghost && ghost.path === 'rebuild' && ghost.lotId === lot.id && ghost.buildingId;
  const nextName = picked && BUILDINGS[ghost.buildingId] ? BUILDINGS[ghost.buildingId].shortName : '';
  const note = lot.actions.includes('buildNew') ? 'Lot is clear.' : `Demolish ${seconds}s, then build.`;
  const line = afford.gap ? `${note} Need ${fmtCash(afford.gap)}` : `${note} ${fmtCash(lot.lotPrice)}${purse(pay)}`;
  return `<section class="go-path${afford.gap ? ' is-short' : ''}" data-path="rebuild"><h3>Tear down &amp; build new</h3><p class="go-path-note">${line}</p><div class="go-tile-row">${buttons}</div>${picked ? previewRow(lot.propertyType || 'lot', ghost.buildingId, lot.propertyLabel || 'Now', nextName) : ''}</section>`;
}

function plotColumn(lot) {
  const goal = postLive() ? POST[postStep] : null;
  const aimed = goal && goal.lot === lot.id ? (goal.buildings || (goal.building ? [goal.building] : [])) : [];
  let ids = listedBuilds(lot);
  if (aimed.length) ids = ids.slice().sort((a, b) => (aimed.includes(a) ? -1 : aimed.includes(b) ? 1 : 0));
  const buttons = ids.map((id) => {
    const quote = buildQuote(lot, id);
    if (!quote) return '';
    return tileButton({
      lotId: lot.id,
      path: 'build',
      key: 'build:' + id,
      building: id,
      thumb: id,
      name: quote.name,
      cost: `${costBits(quote.dirty, quote.clean)} · ${quote.seconds}s`,
      effect: effectOf(BUILDINGS[id]),
      enabled: true,
      rec: aimed.length ? aimed.includes(id) : id === ids[0]
    });
  }).join('');
  const picked = ghost && ghost.path === 'build' && ghost.lotId === lot.id;
  const nextName = picked && BUILDINGS[ghost.buildingId] ? BUILDINGS[ghost.buildingId].shortName : '';
  return `<section class="go-path" data-path="build"><h3>Build</h3><div class="go-tile-row">${buttons}</div>${picked ? previewRow('lot', ghost.buildingId, 'Open ground', nextName) : ''}</section>`;
}

function renderZone() {
  const card = $('zone-card');
  if (!card || !openZoneId) {
    if (card) card.hidden = true;
    return;
  }
  const data = sim.gameplayView();
  const zone = data.zones.find((item) => item.id === openZoneId);
  if (!zone) {
    closeSheets();
    return;
  }
  card.hidden = false;
  if (coreMode() && !zone.unlocked) {
    const price = (zone.unlock && zone.unlock.clean) || 0;
    const ready = !(zone.blockers || []).length;
    $('zone-kicker').textContent = '';
    $('zone-title').textContent = zone.name;
    $('zone-body').innerHTML = `<p class="go-zone-price">${fmtCash(price)}</p><button type="button" class="go-cta-btn" data-deal="unlock" ${ready ? '' : 'disabled'}>Confirm</button>`;
    $('zone-note').textContent = ready ? '' : 'Need more cash.';
    return;
  }
  $('zone-kicker').textContent = zone.city || (zone.kind === 'rural' ? 'Countryside' : 'Zone');
  $('zone-title').textContent = zone.name;
  const lots = data.lots.filter((lot) => lot.zoneId === zone.id && !lot.slotId);
  const list = lots.map((lot) => `<li>${lot.propertyLabel || lot.label}</li>`).join('');
  const blockers = (zone.blockers || []).map((line) => `<li>${line}</li>`).join('');
  const unlock = zone.unlock || {};
  const heatBit = typeof zone.heat === 'number' ? `Heat ${zone.heat} · ` : '';
  const payWord = coreMode() ? 'dirty' : 'clean';
  $('zone-body').innerHTML = `<p>${zone.desc}</p><p class="go-sheet-meta">${heatBit}Control ${zone.control}%${zone.unlocked ? ' · Open' : ''}</p>${blockers ? `<ul class="go-blockers">${blockers}</ul>` : ''}<ul class="go-zone-lots">${list}</ul>${zone.unlocked ? '' : `<button type="button" class="go-cta-btn" data-deal="unlock" ${blockers ? 'disabled' : ''}>Unlock for ${fmtCash(unlock.clean || 0)} ${payWord}</button>`}`;
  $('zone-note').textContent = sheetNote;
}

function runRebuild(lotId, buildingId) {
  let lot = sim.gameplayView().lots.find((item) => item.id === lotId);
  if (!lot) return 'Unknown lot.';
  if (lot.actions.includes('buyLot')) {
    const bought = sim.buyLot(lotId);
    if (!bought.ok) return bought.reason || 'Cannot buy the lot.';
    lot = sim.gameplayView().lots.find((item) => item.id === lotId);
  }
  if (lot && lot.actions.includes('startDemolish')) {
    const demo = sim.startDemolish(lotId);
    if (!demo.ok) return demo.reason || 'Cannot demolish.';
    queuedBuild[lotId] = buildingId;
    return '';
  }
  if (lot && (lot.phase === 'cleared' || lot.actions.includes('buildNew'))) {
    const built = sim.buildNew(lotId, buildingId);
    if (!built.ok) return built.reason || 'Cannot build.';
    delete queuedBuild[lotId];
  }
  return '';
}

function onDeal(action, el) {
  sheetNote = '';
  if (action === 'pick') {
    setGhost({
      lotId: openLotId,
      path: el.dataset.path,
      key: el.dataset.key,
      role: el.dataset.role || null,
      buildingId: el.dataset.building || null
    });
  } else if (action === 'confirm' && ghost && ghost.lotId === openLotId) {
    if (ghost.path === 'convert') {
      const result = sim.buyAndConvert(openLotId, ghost.role);
      if (!result.ok) sheetNote = result.reason || 'Cannot buy.';
      else setGhost(null);
    } else if (ghost.path === 'rebuild') {
      sheetNote = runRebuild(openLotId, ghost.buildingId);
      if (!sheetNote) setGhost(null);
    } else if (ghost.path === 'build') {
      const result = sim.buildOnPlot(openLotId, ghost.buildingId);
      if (!result.ok) sheetNote = result.reason || 'Cannot build.';
      else setGhost(null);
    }
  } else if (action === 'unlock') {
    const result = sim.unlockZone(openZoneId);
    if (!result.ok) sheetNote = result.reason || 'Cannot unlock.';
  } else if (action === 'negotiate') {
    const result = sim.negotiate(openLotId);
    if (!result.ok) sheetNote = result.reason || 'No deal.';
  } else if (action === 'intimidate') {
    const result = sim.intimidate(openLotId, 0);
    if (!result.ok) sheetNote = result.reason || 'They stayed.';
  } else if (action === 'upgrade') {
    const lot = sim.gameplayView().lots.find((item) => item.id === openLotId);
    const result = sim.upgradeSlot(lot && lot.slotId ? lot.slotId : openLotId);
    if (!result.ok) sheetNote = result.reason || '';
  } else if (action === 'fix-farm') {
    const result = sim.buildOnSlot(el.dataset.slot, 'plantation');
    if (!result.ok) sheetNote = result.reason || 'Cannot build.';
  } else if (action === 'fix-upgrade') {
    const result = sim.upgradeSlot(el.dataset.slot);
    if (!result.ok) sheetNote = result.reason || '';
  } else if (action === 'buyer') {
    const lot = sim.gameplayView().lots.find((item) => item.id === openLotId);
    const slotId = lot && lot.slotId ? lot.slotId : openLotId;
    const slot = sim.state.slots[slotId];
    if (slot && (el.dataset.buyer === 'street' || el.dataset.buyer === 'cafe')) slot.buyer = el.dataset.buyer;
  } else if (action === 'build-plot') {
    const result = sim.buildOnPlot(openLotId, el.dataset.building);
    if (!result.ok) sheetNote = result.reason || 'Cannot build.';
  }
  renderHud();
  renderDrawerContent();
  if (openLotId) renderLot();
  if (openZoneId) renderZone();
}

function onLotReady(lotId) {
  const buildingId = queuedBuild[lotId];
  if (!buildingId) return;
  const lot = sim.gameplayView().lots.find((item) => item.id === lotId);
  if (!lot || lot.phase !== 'cleared') return;
  delete queuedBuild[lotId];
  const result = sim.buildNew(lotId, buildingId);
  sheetNote = result.ok ? '' : (result.reason || 'The lot is clear.');
  if (openLotId === lotId) renderLot();
  renderHud();
}

function begin(mode) {
  audio.start();
  if (mode === 'sandbox') sim.startSandbox();
  else if (!sim.state.started) {
    sim.state.started = true;
    sim.save();
  }
  if (mode === 'campaign') {
    teachTouch = teachNow();
    teachPulse = teachTouch;
    teachNudge = false;
    refreshTeach();
  }
  $('title-modal').hidden = true;
  if (mode === 'campaign' && !sim.state.tutorialDone) {
    sim.state.selectedSlotId = 'slot_rp_town1';
    sim.state.selectedRegionId = 'rio_plata';
    drawerOpen = false;
  }
  if (mapScene) mapScene.frameValley(true);
  renderHud();
  renderDrawerContent();
}

function wireEvents() {
  $('btn-start-operation').addEventListener('click', () => begin('campaign'));
  $('btn-sandbox').addEventListener('click', () => begin('sandbox'));

  function advanceTutorial() {
    const step = (sim.state.tutorialStep || 0) + 1;
    if (step >= tutorialCopy().lines.length) sim.state.tutorialDone = true;
    else sim.state.tutorialStep = step;
    sim.save();
    renderHud();
  }
  $('tutorial-next').addEventListener('click', advanceTutorial);
  const objNext = $('obj-next');
  if (objNext) objNext.addEventListener('click', advanceTutorial);
  const objToggle = $('obj-toggle');
  if (objToggle) {
    objToggle.addEventListener('click', () => {
      const more = $('obj-more');
      const open = more.hidden;
      more.hidden = !open;
      objToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
  const logBtn = $('btn-log');
  if (logBtn) {
    logBtn.addEventListener('click', () => {
      const panel = $('log-panel');
      panel.hidden = !panel.hidden;
      logBtn.setAttribute('aria-expanded', panel.hidden ? 'false' : 'true');
      renderHud();
    });
  }
  $('event-actions').addEventListener('click', (e) => {
    const choice = e.target.closest('[data-choice]');
    if (!choice) return;
    sim.resolveEvent(Number(choice.dataset.choice));
    renderHud();
    renderDrawerContent();
  });
  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    audio.click();
  });
  function syncMuteLabel() {
    $('btn-mute').textContent = audio.mix.muted ? 'Muted' : 'Sound';
    $('btn-mute').setAttribute('aria-pressed', audio.mix.muted ? 'true' : 'false');
    $('mix-muted').checked = audio.mix.muted;
  }
  $('mix-master').value = String(Math.round(audio.mix.master * 100));
  $('mix-music').value = String(Math.round(audio.mix.music * 100));
  $('mix-sfx').value = String(Math.round(audio.mix.sfx * 100));
  syncMuteLabel();
  $('btn-mute').addEventListener('click', () => {
    const panel = $('mix-panel');
    panel.hidden = !panel.hidden;
    $('btn-mute').setAttribute('aria-expanded', panel.hidden ? 'false' : 'true');
  });
  document.addEventListener('click', (e) => {
    const panel = $('mix-panel');
    if (panel.hidden || e.target.closest('#go-mix')) return;
    panel.hidden = true;
    $('btn-mute').setAttribute('aria-expanded', 'false');
  });
  $('mix-muted').addEventListener('change', () => {
    audio.setMuted($('mix-muted').checked);
    syncMuteLabel();
  });
  $('mix-master').addEventListener('input', () => audio.setMaster(Number($('mix-master').value) / 100));
  $('mix-music').addEventListener('input', () => audio.setMusic(Number($('mix-music').value) / 100));
  $('mix-sfx').addEventListener('input', () => audio.setSfx(Number($('mix-sfx').value) / 100));

  const resetBtn = $('btn-new-operation');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      sim.resetNewGame();
      teachStep = 0;
      teachDone = false;
      teachNudge = false;
      teachTouch = teachNow();
      teachPulse = teachTouch;
      guideStep = 0;
      guideHits = 0;
      guideSince = 0;
      guideHoldUntil = 0;
      guideFlash = null;
      postStep = 0;
      postDone = false;
      postShown = 0;
      seenBuild.clear();
      const toast = $('build-toast');
      if (toast) toast.hidden = true;
      closeLotPicker();
      stopPlace();
      const strip = $('build-strip');
      if (strip) strip.hidden = true;
      $('title-modal').hidden = true;
      if (mapScene) mapScene.frameValley(true);
      renderHud();
      renderDrawerContent();
    });
  }

  // Top bar actions
  $('btn-pause').addEventListener('click', () => {
    sim.state.paused = !sim.state.paused;
    sim.save();
    renderHud();
  });

  $('btn-speed').addEventListener('click', () => {
    sim.state.speed = sim.state.speed === 1 ? 2 : sim.state.speed === 2 ? 4 : 1;
    sim.save();
    renderHud();
  });

  $('btn-briefing').addEventListener('click', () => {
    $('title-modal').hidden = false;
  });
  const menuBtn = $('btn-menu');
  if (menuBtn) {
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const panel = $('menu-panel');
      panel.hidden = !panel.hidden;
      menuBtn.setAttribute('aria-expanded', panel.hidden ? 'false' : 'true');
    });
  }
  document.addEventListener('click', (e) => {
    const panel = $('menu-panel');
    if (!panel || panel.hidden || e.target.closest('#menu-panel') || e.target.closest('#btn-menu')) return;
    panel.hidden = true;
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
  });
  for (const tabBtn of document.querySelectorAll('.go-menu-tab')) {
    tabBtn.addEventListener('click', () => {
      if (coreMode()) return;
      activeTab = tabBtn.dataset.tab;
      drawerOpen = true;
      const panel = $('menu-panel');
      if (panel) panel.hidden = true;
      syncDrawerVisibility();
      renderDrawerContent();
    });
  }

  $('btn-control').addEventListener('click', () => {
    const on = $('btn-control').getAttribute('aria-pressed') !== 'true';
    setControl(on);
  });
  $('lot-card').addEventListener('click', (e) => {
    if (e.target === $('lot-card') || e.target.closest('[data-close]')) {
      closeSheets();
      return;
    }
    const btn = e.target.closest('[data-deal]');
    if (!btn || btn.disabled) return;
    onDeal(btn.dataset.deal, btn);
  });
  $('zone-card').addEventListener('click', (e) => {
    if (e.target === $('zone-card') || e.target.closest('[data-close]')) {
      closeSheets();
      return;
    }
    const btn = e.target.closest('[data-deal]');
    if (!btn || btn.disabled) return;
    onDeal(btn.dataset.deal, btn);
  });
  document.addEventListener('pointerdown', () => bumpTeach(), true);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const strip = $('build-strip');
    const picker = $('lot-picker');
    if (placingId || (strip && !strip.hidden) || (picker && !picker.hidden)) {
      stopPlace();
      closeLotPicker();
      if (strip) strip.hidden = true;
      if (teachActive() && (TEACH[teachStep].id === 'lot' || TEACH[teachStep].id === 'confirm')) {
        teachStep = 1;
        teachNudge = false;
        strip.hidden = false;
        renderBuildStrip();
        renderHud();
      }
      return;
    }
    closeSheets();
  });

  // Raid banner action
  $('raid-action-btn').addEventListener('click', (e) => {
    const regionId = e.currentTarget.dataset.region || 'rio_plata';
    sim.bribeRegionAuthorities(regionId);
    renderHud();
    renderDrawerContent();
  });

  // Drawer close & tabs
  $('drawer-close').addEventListener('click', () => {
    drawerOpen = false;
    syncDrawerVisibility();
  });

  for (const tabBtn of document.querySelectorAll('.go-tab-btn')) {
    tabBtn.addEventListener('click', () => {
      if (coreMode()) return;
      activeTab = tabBtn.dataset.tab;
      drawerOpen = true;
      syncDrawerVisibility();
      renderDrawerContent();
    });
  }

  // Bottom dock buttons
  const buildBtn = $('dock-build-btn');
  if (buildBtn) {
    buildBtn.addEventListener('click', () => {
      const strip = $('build-strip');
      if (!strip) return;
      if (teachActive()) {
        closeLotPicker();
        const step = TEACH[teachStep];
        if (step.id === 'lot' || step.id === 'confirm') return;
        if (step.id === 'build') {
          teachStep = 1;
          teachNudge = false;
        }
        closeSheets();
        drawerOpen = false;
        syncDrawerVisibility();
        stopPlace();
        strip.hidden = false;
        renderBuildStrip();
        renderHud();
        return;
      }
      if (!strip.hidden) {
        strip.hidden = true;
        stopPlace();
        closeLotPicker();
        return;
      }
      closeSheets();
      closeLotPicker();
      drawerOpen = false;
      syncDrawerVisibility();
      strip.hidden = false;
      renderBuildStrip();
    });
  }
  const buildStrip = $('build-strip');
  if (buildStrip) {
    buildStrip.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-place]');
      if (!btn || btn.disabled) return;
      const id = btn.dataset.place;
      if (teachActive() && id !== TEACH_LAB) return;
      beginPlace(id);
      if (teachActive() && TEACH[teachStep].id === 'pick' && id === TEACH_LAB) {
        teachStep = 2;
        teachNudge = false;
        buildStrip.hidden = true;
        renderHud();
      }
    });
  }
  const lotPicker = $('lot-picker');
  if (lotPicker) {
    lotPicker.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-pick]');
      if (!btn || btn.disabled) return;
      const buildingId = btn.dataset.pick;
      const slotId = pickerSlot;
      const jump = teachActive() && buildingId === TEACH_LAB && slotId === TEACH_LOT && labFits(slotId);
      beginPlace(buildingId, slotId);
      if (jump) {
        teachStep = 3;
        teachNudge = false;
      }
      renderHud();
    });
  }
  const placeOk = $('place-ok');
  const placeNo = $('place-no');
  if (placeOk) placeOk.addEventListener('click', () => confirmPlace());
  if (placeNo) {
    placeNo.addEventListener('click', () => {
      stopPlace();
      closeLotPicker();
      const strip = $('build-strip');
      if (teachActive() && (TEACH[teachStep].id === 'lot' || TEACH[teachStep].id === 'confirm')) {
        teachStep = 1;
        teachNudge = false;
        if (strip) strip.hidden = false;
        renderBuildStrip();
        renderHud();
        return;
      }
      if (strip) strip.hidden = false;
      renderBuildStrip();
    });
  }
  for (const dockBtn of document.querySelectorAll('.go-dock-btn')) {
    dockBtn.addEventListener('click', () => {
      if (dockBtn.id === 'dock-build-btn') return;
      const tab = dockBtn.dataset.tab;
      if (tab) {
        if (drawerOpen && activeTab === tab) {
          drawerOpen = false;
        } else {
          activeTab = tab;
          drawerOpen = true;
          if (tab === 'slot') {
            // Select first empty unlocked slot if current slot has a building
            const cur = sim.state.slots[sim.state.selectedSlotId];
            if (cur && cur.buildingId) {
              const emptySlot = Object.values(sim.state.slots).find(
                (s) => !s.buildingId && !s.rivalControlled && sim.state.regions[s.regionId]?.unlocked
              );
              if (emptySlot) sim.state.selectedSlotId = emptySlot.slotId;
            }
          }
        }
        syncDrawerVisibility();
        renderDrawerContent();
      }
    });
  }

  // Delegated drawer actions
  $('drawer-body').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn || btn.disabled) return;
    const action = btn.dataset.action;

    if (action === 'build-facility') {
      sim.buildOnSlot(btn.dataset.slot, btn.dataset.building);
    } else if (action === 'upgrade-slot') {
      sim.upgradeSlot(btn.dataset.slot);
    } else if (action === 'demolish-slot') {
      sim.demolishSlot(btn.dataset.slot);
    } else if (action === 'unlock-region') {
      const res = sim.unlockRegion(btn.dataset.region);
      if (res.ok && mapScene) mapScene.focusOnRegion(btn.dataset.region);
    } else if (action === 'focus-region') {
      if (mapScene) mapScene.focusOnRegion(btn.dataset.region);
    } else if (action === 'focus-zone') {
      if (mapScene) mapScene.frameZone(btn.dataset.zone, false);
    } else if (action === 'unlock-zone') {
      const res = sim.unlockZone(btn.dataset.zone);
      if (!res.ok) sheetNote = res.reason || 'Cannot unlock.';
      if (res.ok && mapScene) mapScene.frameZone(btn.dataset.zone, false);
    } else if (action === 'clear-rival') {
      sim.clearRivalSlot(btn.dataset.slot);
    } else if (action === 'bribe-region') {
      sim.bribeRegionAuthorities(btn.dataset.region);
    } else if (action === 'hire-lt') {
      sim.hireLieutenant(btn.dataset.lt);
    } else if (action === 'assign-lt') {
      sim.assignLieutenant(btn.dataset.lt, btn.dataset.region);
    } else if (action === 'select-strain') {
      sim.selectStrain(btn.dataset.strain);
    } else if (action === 'buy-research') {
      sim.buyResearch(btn.dataset.research);
    }
    renderDrawerContent();
    renderHud();
  });
}

function bootPhaser() {
  const mount = $('phaser-mount');
  const config = {
    type: window.Phaser.CANVAS,
    parent: mount,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#24211b',
    scale: {
      mode: window.Phaser.Scale.RESIZE,
      autoCenter: window.Phaser.Scale.CENTER_BOTH
    },
    scene: [MapScene]
  };

  phaserGame = new window.Phaser.Game(config);
  phaserGame.registry.set('onJuice', (evt) => {
    const juice = mapScene && mapScene.registry ? mapScene.registry.get('juice') : null;
    presentEvent(audio, juice, evt, sim);
  });
  phaserGame.registry.set('sim', sim);
  phaserGame.registry.set('onSlotSelected', (slotId) => {
    selectSlot(slotId, true);
  });
  phaserGame.registry.set('onRegionSelected', (regionId) => {
    selectRegion(regionId);
  });
  phaserGame.registry.set('onLotSelected', (lotId) => openLot(lotId));
  phaserGame.registry.set('onEmptyLot', (slotId) => onEmptyLot(slotId));
  phaserGame.registry.set('onLotTapped', (slotId) => onLotTapped(slotId));
  phaserGame.registry.set('onBuildingReady', (buildingId) => onBuildingReady(buildingId));
  phaserGame.registry.set('onZoneSelected', (zoneId) => openZone(zoneId));
  phaserGame.registry.set('onMapRevealed', () => showReveal());
  phaserGame.registry.set('onLotReady', (lotId) => onLotReady(lotId));
  phaserGame.registry.set('onLotTick', () => { if (openLotId) renderLot(); });
  phaserGame.registry.set('showControl', false);
  phaserGame.registry.set('holdMapReveal', false);
  phaserGame.registry.set('bindScene', (scene) => {
    mapScene = scene;
    if (!scene.registry.get('juice')) scene.registry.set('juice', createJuice(scene));
    attachFeel(
      sim,
      audio,
      () => scene.registry.get('juice'),
      () => {
        const mid = scene.cameras && scene.cameras.main && scene.cameras.main.midPoint;
        return {
          x: mid ? mid.x : 480,
          y: mid ? mid.y : 640,
          night: !!(scene.isNight && scene.isNight())
        };
      }
    );
  });

  phaserGame.events.on('ready', () => {
    mapScene = phaserGame.scene.getScene('MapScene');
  });
}

// Expose deterministic testing & inspection API on window.__growOp
window.__growOp = {
  sim,
  scene: () => mapScene,
  // Plain snapshot for the scene/HUD agent. Methods live on sim.
  gameplay: () => sim.gameplayView(),
  selectSlot: (id) => selectSlot(id, true),
  openBuildMenuOnEmptySlot: () => {
    const emptySlot = Object.values(sim.state.slots).find(
      (s) => !s.buildingId && !s.rivalControlled && sim.state.regions[s.regionId]?.unlocked
    );
    if (emptySlot) {
      selectSlot(emptySlot.slotId, true);
      if (mapScene) mapScene.focusOnSlot(emptySlot.slotId, true);
    }
  },
  triggerRaidMoment: (regionId = 'rio_plata') => {
    sim.state.regions[regionId].heat = 98;
    sim.triggerRegionalRaid(regionId);
    renderHud();
    renderDrawerContent();
  },
  clearRaidMoment: (regionId = 'rio_plata') => {
    sim.bribeRegionAuthorities(regionId);
    renderHud();
    renderDrawerContent();
  },
  focusSmuggle: () => { if (mapScene) mapScene.focusOnSlot('slot_rp_pier', true); },
  frameOverview: () => { if (mapScene) mapScene.frameOverview(); },
  frameValley: () => { if (mapScene) mapScene.frameValley(true); },
  camera: () => {
    if (!mapScene) return null;
    const cam = mapScene.cameras.main;
    return { x: cam.scrollX, y: cam.scrollY, zoom: cam.zoom };
  },
  frameClose: () => { if (mapScene) mapScene.frameClose(true); },
  openPanel: (tab) => {
    activeTab = tab;
    drawerOpen = true;
    syncDrawerVisibility();
    renderDrawerContent();
  },
  openLot: (id) => openLot(id),
  guide: () => currentGuide(),
  startPlace: (buildingId) => beginPlace(buildingId || 'plantation'),
  stopPlace: () => {
    stopPlace();
    const strip = $('build-strip');
    if (strip) strip.hidden = true;
  },
  openZone: (id) => openZone(id),
  frameLot: (id) => { if (mapScene) mapScene.frameLot(id, true); },
  frameZone: (id) => { if (mapScene) mapScene.frameZone(id, true); },
  frameAt: (x, y, zoom) => {
    if (!mapScene) return false;
    mapScene.userPanned = true;
    mapScene.holdMapReveal = true;
    mapScene.didReveal = true;
    mapScene.chartAlpha = 0;
    mapScene.applyBounds();
    const cam = mapScene.cameras.main;
    cam.setZoom(zoom);
    cam.centerOn(x, y);
    return true;
  },
  revealMap: () => {
    if (phaserGame) phaserGame.registry.set('holdMapReveal', false);
    if (!mapScene) return;
    mapScene.holdMapReveal = false;
    sim.state.mapOpen = true;
    mapScene.didReveal = true;
    mapScene.revealMap();
  },
  setControl: (on) => setControl(on),
  dismissChrome: () => {
    sim.state.tutorialDone = true;
    if (mapScene) mapScene.holdMapReveal = true;
    if (phaserGame) phaserGame.registry.set('holdMapReveal', true);
    if (sim.state.event) sim.resolveEvent(Math.min(1, (sim.state.event.choices.length || 1) - 1));
    drawerOpen = false;
    closeSheets();
    syncDrawerVisibility();
    renderHud();
  },
  fastForward: (seconds = 60) => {
    const wasStarted = sim.state.started;
    sim.state.started = true;
    const steps = Math.ceil(seconds * 4);
    for (let i = 0; i < steps; i++) sim.step(0.25);
    sim.state.started = wasStarted;
    renderHud();
    renderDrawerContent();
  }
};

// Initialize UI & Phaser
if (hasSave) {
  $('btn-start-operation').textContent = 'Continue Operation';
  $('btn-new-operation').hidden = false;
}

drawerOpen = false;

wireEvents();
syncDrawerVisibility();
renderHud();
renderDrawerContent();
bootPhaser();
