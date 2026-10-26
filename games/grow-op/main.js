// Grow Op: San Verde '84 — Main Application & HUD Controller

import { GOODS, STRAINS } from './data/goods.js';
import { BUILDINGS, BUILDING_LIST } from './data/buildings.js';
import { REGIONS, BUILD_SLOTS, LIEUTENANTS, ACTS } from './data/missions.js';
import { ICONS, iconForCategory } from './data/icons.js';
import { RESEARCH } from './data/research.js';
import { CartelSimulation } from './simulation.js';
import { MapScene } from './scene.js';
import { createAudio } from './audio.js';

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
  'Río Plata is already running: plantation, barn, warehouse, pier.',
  'Trucks follow the roads. A crate that reaches the pier becomes dirty cash.',
  'Build a taxi front on an empty plot. Fronts turn dirty cash into clean cash.',
  'Heat belongs to a district. Bribe the town, or a raid locks the buildings.',
  'Crew and the lab tab are how the valley becomes three provinces.'
];

const sim = new CartelSimulation((evt) => {
  handleSimEvent(evt);
});

// Check if saved game exists for title modal
const hasSave = sim.hasSavedGame();
if (hasSave) {
  sim.load();
}

function handleSimEvent(evt) {
  if (mapScene && mapScene.sys && mapScene.sys.isActive()) mapScene.fx(evt);
  if (evt.type === 'exported' || evt.type === 'laundered') audio.coin();
  if (evt.type === 'built') audio.build();
  if (evt.type === 'raid_started') audio.siren();
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

function selectSlot(slotId, openDrawer = true) {
  const slotDef = BUILD_SLOTS.find((s) => s.id === slotId);
  if (!slotDef) return;
  sim.state.selectedSlotId = slotId;
  sim.state.selectedRegionId = slotDef.regionId;
  activeTab = 'slot';
  if (openDrawer) drawerOpen = true;
  syncDrawerVisibility();
  renderDrawerContent();
  renderHud();
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

  // Currencies
  $('dirty-cash-val').textContent = fmtCash(st.dirtyCash);
  $('clean-cash-val').textContent = fmtCash(st.cleanCash);

  // Act & Day
  const actDef = ACTS[st.act] || ACTS[1];
  $('act-kicker').textContent = actDef.badge;
  $('day-sub').textContent = `Day ${st.day} · Fleet ${st.activeTrucks.length}/${sim.getMaxTrucks()} Trucks`;

  // Highest or selected regional heat
  const selReg = st.regions[st.selectedRegionId] || st.regions.rio_plata;
  const unlockedHeats = Object.values(st.regions)
    .filter((r) => r.unlocked)
    .map((r) => Number(r.heat) || 0);
  const maxHeat = unlockedHeats.length ? Math.max(...unlockedHeats) : 0;
  const displayHeat = Math.round(Math.max(Number(selReg?.heat) || 0, maxHeat));
  $('heat-val').textContent = `${displayHeat}%`;
  $('heat-bar-fill').style.width = `${Math.min(100, displayHeat)}%`;
  $('heat-meter').classList.toggle('is-hot', displayHeat >= 70);

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

  // Prominent Objective Card
  const mission = sim.getCurrentMission();
  const prog = sim.getMissionProgress(mission);
  if (mission) {
    $('obj-title').textContent = mission.title;
    $('obj-desc').textContent = mission.desc;
    $('obj-reward').textContent = `+${fmtCash(mission.rewardClean)} Clean`;
    $('obj-prog-text').textContent = prog.progressText;
    $('obj-bar-fill').style.width = `${prog.pct}%`;
  } else {
    $('obj-title').textContent = 'Syndicate Sovereignty Achieved';
    $('obj-desc').textContent = 'All campaign objectives complete. Continue expanding in Sandbox mode.';
    $('obj-reward').textContent = 'COMPLETE';
    $('obj-prog-text').textContent = '100%';
    $('obj-bar-fill').style.width = '100%';
  }

  // Raid / High Heat Emergency Banner
  const raidRegion = Object.values(st.regions).find((r) => r.raidActive);
  const hotRegion = Object.values(st.regions).find((r) => r.unlocked && r.heat >= 75);
  const raidBanner = $('raid-banner');

  if (raidRegion) {
    const regDef = REGIONS.find((r) => r.id === raidRegion.id);
    raidBanner.classList.add('is-visible');
    $('raid-title').textContent = `DEA & POLICÍA RAID: ${regDef.name.toUpperCase()}`;
    $('raid-sub').textContent = `Confiscation in ${Math.ceil(raidRegion.raidTimer)}s — Pay off commandante ($250 Clean / $350 Dirty)`;
    $('raid-action-btn').dataset.region = raidRegion.id;
    $('raid-action-btn').textContent = 'Bribe Officials';
  } else if (hotRegion) {
    const regDef = REGIONS.find((r) => r.id === hotRegion.id);
    raidBanner.classList.add('is-visible');
    $('raid-title').textContent = `HIGH REGIONAL HEAT: ${regDef.name.toUpperCase()} (${Math.floor(hotRegion.heat)}%)`;
    $('raid-sub').textContent = `Federal patrols mobilizing near ${regDef.townName}. Cool down suspicion now.`;
    $('raid-action-btn').dataset.region = hotRegion.id;
    $('raid-action-btn').textContent = 'Cool Heat ($160)';
  } else {
    raidBanner.classList.remove('is-visible');
  }

  // Bottom Feed Ticker
  if (st.feed.length > 0) {
    const latest = st.feed[0];
    $('feed-ticker').innerHTML = `<strong>[${latest.time}]</strong> ${latest.text}`;
  }
  renderTutorial();
  renderEvent();
}

function renderTutorial() {
  const bar = $('tutorial-bar');
  if (!bar) return;
  const show = sim.state.started && !sim.state.tutorialDone && sim.state.mode === 'campaign';
  bar.hidden = !show;
  if (!show) return;
  const step = Math.min(TUTORIAL.length - 1, sim.state.tutorialStep || 0);
  $('tutorial-text').textContent = TUTORIAL[step];
  $('tutorial-next').textContent = step >= TUTORIAL.length - 1 ? 'Got it' : 'Next';
}

function renderEvent() {
  const card = $('event-card');
  if (!card) return;
  const ev = sim.state.event;
  card.hidden = !ev || !sim.state.started;
  if (!ev) return;
  $('event-title').textContent = ev.title;
  $('event-body').textContent = ev.body;
  const actions = $('event-actions');
  actions.innerHTML = ev.choices.map((choice, i) =>
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
    $('drawer-kicker').textContent = `${regDef.name} · ${regDef.townName}`;
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
    $('drawer-kicker').textContent = 'Regions & Cultivar Genetics';
    $('drawer-title').textContent = 'Territory & R&D';

    const regionsHtml = REGIONS.map((r) => {
      const rs = st.regions[r.id];
      return `
        <div class="go-card">
          <div class="go-card-top">
            <div class="go-card-title-group">
              <div class="go-cat-badge">${ICONS.mapPin}</div>
              <div>
                <h3 class="go-card-name">${r.name}</h3>
                <span class="go-card-role">${r.townName} · Fertility ${Math.round(r.fertilityBonus * 100)}%</span>
              </div>
            </div>
          </div>
          <p class="go-card-desc">${r.desc}</p>
          <div class="go-chain-pill">
            <span>Status: <strong>${rs.unlocked ? 'Active Territory' : 'Locked Province'}</strong></span>
            <span>Heat: <strong>${Math.floor(rs.heat)}%</strong></span>
          </div>
          <div class="go-btn-row">
            ${
              rs.unlocked
                ? `<button type="button" class="go-action-btn" data-action="focus-region" data-region="${r.id}">
                    Pan Camera to ${r.name.split(' ')[0]}
                  </button>
                  <button type="button" class="go-action-btn" data-action="bribe-region" data-region="${r.id}">
                    Cool Heat ($160)
                  </button>`
                : `<button type="button" class="go-action-btn go-action-btn--dirty" data-action="unlock-region" data-region="${r.id}" ${
                    st.cleanCash < r.unlockCostClean ? 'disabled' : ''
                  }>
                    Unlock Province ($${r.unlockCostClean} Clean Cash)
                  </button>`
            }
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

function begin(mode) {
  audio.start();
  if (mode === 'sandbox') sim.startSandbox();
  else if (!sim.state.started) {
    sim.state.started = true;
    sim.save();
  }
  $('title-modal').hidden = true;
  if (mapScene) mapScene.frameValley(false);
  renderHud();
  renderDrawerContent();
}

function wireEvents() {
  $('btn-start-operation').addEventListener('click', () => begin('campaign'));
  $('btn-sandbox').addEventListener('click', () => begin('sandbox'));

  $('tutorial-next').addEventListener('click', () => {
    const step = (sim.state.tutorialStep || 0) + 1;
    if (step >= TUTORIAL.length) sim.state.tutorialDone = true;
    else sim.state.tutorialStep = step;
    sim.save();
    renderHud();
  });
  $('event-actions').addEventListener('click', (e) => {
    const choice = e.target.closest('[data-choice]');
    if (!choice) return;
    audio.click();
    sim.resolveEvent(Number(choice.dataset.choice));
    renderHud();
    renderDrawerContent();
  });
  $('btn-mute').addEventListener('click', () => {
    const muted = audio.toggle();
    $('btn-mute').textContent = muted ? 'Muted' : 'Sound';
    $('btn-mute').setAttribute('aria-pressed', muted ? 'true' : 'false');
  });
  if (audio.muted) $('btn-mute').textContent = 'Muted';

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
  for (const dockBtn of document.querySelectorAll('.go-dock-btn')) {
    dockBtn.addEventListener('click', () => {
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
  phaserGame.registry.set('sim', sim);
  phaserGame.registry.set('onSlotSelected', (slotId) => {
    selectSlot(slotId, true);
  });
  phaserGame.registry.set('onRegionSelected', (regionId) => {
    selectRegion(regionId);
  });
  phaserGame.registry.set('bindScene', (scene) => { mapScene = scene; });

  phaserGame.events.on('ready', () => {
    mapScene = phaserGame.scene.getScene('MapScene');
  });
}

// Expose deterministic testing & inspection API on window.__growOp
window.__growOp = {
  sim,
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
  openPanel: (tab) => {
    activeTab = tab;
    drawerOpen = true;
    syncDrawerVisibility();
    renderDrawerContent();
  },
  dismissChrome: () => {
    sim.state.tutorialDone = true;
    if (sim.state.event) sim.resolveEvent(Math.min(1, (sim.state.event.choices.length || 1) - 1));
    drawerOpen = false;
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

// Default drawer closed on narrow mobile until tapped, open on tablet/desktop
if (window.innerWidth <= 640) {
  drawerOpen = false;
}

wireEvents();
syncDrawerVisibility();
renderHud();
renderDrawerContent();
bootPhaser();
