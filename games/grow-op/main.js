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

function handleSimEvent(evt) {
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
      const nextUpgradeCost = bDef.upgradeCostClean[slotState.level - 1];

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
              slotState.level < 3
                ? `<button type="button" class="go-action-btn" data-action="upgrade-slot" data-slot="${slotDef.id}" ${
                    st.cleanCash < nextUpgradeCost ? 'disabled' : ''
                  }>
                    ${ICONS.upgrade} Upgrade Tier ${slotState.level + 1} ($${nextUpgradeCost} Clean)
                  </button>`
                : `<button type="button" class="go-action-btn" disabled>Max Tier Reached (Lv 3)</button>`
            }
            <button type="button" class="go-action-btn go-action-btn--danger" data-action="demolish-slot" data-slot="${slotDef.id}" title="Deconstruct Facility">
              ${ICONS.demolish}
            </button>
          </div>
        </div>

        <div class="go-card">
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
        </div>
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
  if (cardBox) cardBox.classList.toggle('is-ops', !!compact);
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
    $('lot-title').textContent = lot.buildingId && BUILDINGS[lot.buildingId] ? BUILDINGS[lot.buildingId].shortName : (lot.propertyLabel || lot.label);
    $('lot-meta').textContent = '';
    $('lot-kicker').textContent = '';
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
    const rate = [];
    ins.forEach(([id, qty]) => rate.push(`${goodSwatch(id)}<b>${qty}</b>`));
    if (ins.length && outs.length) rate.push('<span class="go-ops-arrow" aria-hidden="true"></span>');
    outs.forEach(([id, qty]) => rate.push(`${goodSwatch(id)}<b>${qty}</b>`));
    if (!ins.length && !outs.length && building.role === 'launderer') rate.push(`<b>$${building.launderPerCycle}</b>`);
    else if (!ins.length && !outs.length && building.trucksProvided) rate.push(`<b>+${building.trucksProvided}</b>`);
    else if (!ins.length && !outs.length && building.exportCapPerCycle) rate.push(`<b>${building.exportCapPerCycle}</b>`);
    if (building.cycleSeconds) rate.push(`<em>${building.cycleSeconds}s</em>`);
    bits.push(`<div class="go-ops-rate">${rate.join('')}</div>`);
    const stock = [];
    if (slot) {
      for (const [id, qty] of Object.entries(slot.outputBuffer || {})) if (qty > 0) stock.push(`${goodSwatch(id)}<b>${qty}</b>`);
      for (const [id, qty] of Object.entries(slot.inputBuffer || {})) if (qty > 0) stock.push(`${goodSwatch(id)}<b>${qty}</b>`);
    }
    bits.push(`<div class="go-ops-stock">${stock.join('')}</div>`);
    if (slot && building.upgradeCostClean) {
      const maxed = slot.level >= 3;
      const cost = building.upgradeCostClean[slot.level - 1];
      if (!maxed && cost) {
        const afford = sim.state.cleanCash >= cost;
        bits.push(`<button type="button" class="go-ops-up" data-deal="upgrade" ${afford ? '' : 'disabled'} aria-label="Upgrade"><svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><path d="M10 15V5M6 9l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><small>${fmtCash(cost)}${purse('clean')}</small></button>`);
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
  strip.innerHTML = buildChoices().map((building) => {
    const icon = artURL(iconKeyForBuilding(building.id));
    const on = placingId === building.id ? ' is-on' : '';
    const mark = rec === building.id ? ' is-rec' : '';
    return `<button type="button" class="go-build-ico${on}${mark}" data-place="${building.id}" aria-label="${building.shortName}">${icon ? `<img alt="" src="${icon}">` : ''}</button>`;
  }).join('');
}

function beginPlace(buildingId) {
  placingId = buildingId;
  setGhost(null);
  closeSheets();
  const strip = $('build-strip');
  if (strip) strip.hidden = false;
  if (phaserGame) phaserGame.registry.set('placing', { buildingId });
  renderBuildStrip();
}

function stopPlace() {
  placingId = null;
  if (phaserGame) {
    phaserGame.registry.set('placing', null);
    phaserGame.registry.set('placeSnap', null);
  }
  const hud = $('place-hud');
  if (hud) hud.hidden = true;
  renderBuildStrip();
}

function confirmPlace() {
  const snap = phaserGame && phaserGame.registry.get('placeSnap');
  if (!snap || !snap.ok) return;
  const result = sim.buildOnSlot(snap.id, snap.buildingId);
  if (!result.ok) return;
  stopPlace();
  const strip = $('build-strip');
  if (strip) strip.hidden = true;
  if (mapScene) mapScene.focusOnSlot(snap.id, true);
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
  return `<div class="go-preview"><span>${thumb(nowKind)}<small>Now</small><b>${nowName}</b></span><span>${thumb(nextKind)}<small>After</small><b>${nextName}</b></span></div><button type="button" class="go-cta-btn" data-deal="confirm">Place it</button>`;
}

function convertColumn(lot, pay, enabled) {
  const roles = Object.entries(lot.fits || {}).filter(([, fit]) => fit && fit.allowed);
  const rec = roles.find(([, fit]) => fit.fit === 'boost') || roles[0];
  const buttons = roles.map(([role, fit]) => tileButton({
    lotId: lot.id,
    path: 'convert',
    key: 'convert:' + role,
    role,
    thumb: lot.propertyType || 'lot',
    name: ROLE_NAME[role] || role,
    cost: `${fmtCash(lot.buyPrice)}${purse(pay)}`,
    effect: fit.fit === 'boost' ? 'Strong fit' : fit.fit === 'limit' ? 'Tight fit' : 'Fits',
    enabled,
    rec: rec && rec[0] === role
  })).join('');
  const picked = ghost && ghost.path === 'convert' && ghost.lotId === lot.id;
  const after = picked ? (ROLE_NAME[ghost.role] || ghost.role) : '';
  return `<section class="go-path" data-path="convert"><h3>Buy &amp; convert</h3><div class="go-tile-row">${buttons}</div>${picked ? previewRow(lot.propertyType || 'lot', lot.propertyType || 'lot', lot.propertyLabel || lot.label, after) : ''}</section>`;
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
      enabled,
      rec: id === rec
    });
  }).join('');
  const picked = ghost && ghost.path === 'rebuild' && ghost.lotId === lot.id && ghost.buildingId;
  const nextName = picked && BUILDINGS[ghost.buildingId] ? BUILDINGS[ghost.buildingId].shortName : '';
  const note = lot.actions.includes('buildNew') ? 'Lot is clear.' : `Demolish ${seconds}s, then build.`;
  return `<section class="go-path" data-path="rebuild"><h3>Demolish &amp; build new</h3><p class="go-path-note">${note} ${fmtCash(lot.lotPrice)}${purse(pay)}</p><div class="go-tile-row">${buttons}</div>${picked ? previewRow(lot.propertyType || 'lot', ghost.buildingId, lot.propertyLabel || 'Now', nextName) : ''}</section>`;
}

function plotColumn(lot) {
  const ids = listedBuilds(lot);
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
      rec: id === ids[0]
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
    if (!result.ok) sheetNote = '';
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
      $('title-modal').hidden = true;
      if (mapScene) mapScene.focusOnSlot('slot_rp_wh1', false);
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
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const strip = $('build-strip');
    if (placingId || (strip && !strip.hidden)) {
      stopPlace();
      if (strip) strip.hidden = true;
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
      if (!strip.hidden) {
        strip.hidden = true;
        stopPlace();
        return;
      }
      closeSheets();
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
      if (!btn) return;
      beginPlace(btn.dataset.place);
    });
  }
  const placeOk = $('place-ok');
  const placeNo = $('place-no');
  if (placeOk) placeOk.addEventListener('click', () => confirmPlace());
  if (placeNo) {
    placeNo.addEventListener('click', () => {
      stopPlace();
      const strip = $('build-strip');
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
