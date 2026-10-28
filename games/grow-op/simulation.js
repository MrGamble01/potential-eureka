// Grow Op: San Verde '84 — Core Simulation, Logistics, Laundering, Heat & Save Engine

import { GOODS, STRAINS } from './data/goods.js';
import { BUILDINGS } from './data/buildings.js';
import { REGIONS, BUILD_SLOTS, LIEUTENANTS, MISSIONS, CORE_MISSIONS, findRoadPath } from './data/missions.js';
import { coreMode, riskLive } from './data/config.js';
import { RESEARCH } from './data/research.js';
import { DIFFICULTIES, createZoneBook, zoneById } from './data/zones.js';
import { createLotBook, roleForBuilding } from './data/lots.js';
import { createRivalBook } from './data/rivals.js';
import { storageCap, capExtra, launderTake } from './systems/chains.js';
import { buyAndConvert, buyLot, startDemolish, buildNew, buildOnPlot, negotiate, intimidate, tickLots } from './systems/lots.js';
import { unlockZone, refreshControl, syncMap, measureControl } from './systems/zones.js';
import { notePatrol, tickPatrol, hide, hiddenNow } from './systems/heat.js';
import { planRoute, tickShipments } from './systems/routes.js';
import { tickRivals } from './systems/rivals.js';
import { crewMods, tickLoyalty, tickBetrayal } from './systems/lieutenants.js';
import { nextEvent, applyEffect } from './systems/events.js';
import { campaignFailure } from './systems/campaign.js';
import { gameplayView } from './systems/hooks.js';

export const SAVE_KEY = 'growop-cartel-v1';

export function createInitialState() {
  const slots = {};
  for (const s of BUILD_SLOTS) {
    slots[s.id] = {
      slotId: s.id,
      regionId: s.regionId,
      buildingId: s.starterBuilding || null,
      level: 1,
      progress: s.starterBuilding === 'plantation' ? 0.1 : s.starterBuilding ? 0.35 : 0,
      inputBuffer: {},
      outputBuffer: s.starterBuilding === 'plantation' ? { raw_herb: 2 } : s.starterBuilding === 'drying_barn' ? { cured_pack: 1 } : {},
      rivalControlled: !!s.rivalControlled,
      disabledUntil: 0,
      raidLocked: false
    };
  }

  const regions = {};
  for (const r of REGIONS) {
    regions[r.id] = {
      id: r.id,
      unlocked: r.actUnlock === 1 && r.unlockCostClean === 0,
      heat: 0,
      loyalty: r.id === 'rio_plata' ? 62 : 50,
      raidActive: false,
      raidTimer: 0,
      raidTargetSlot: null
    };
  }

  const lieutenants = {};
  for (const lt of LIEUTENANTS) {
    lieutenants[lt.id] = {
      id: lt.id,
      hired: !!lt.unlockedAtStart,
      regionId: lt.unlockedAtStart ? 'rio_plata' : null,
      zoneId: lt.unlockedAtStart ? 'rio_plata' : null,
      loyalty: lt.loyalty,
      cooldown: 0,
      betrayed: false
    };
  }

  const state = {
    version: 1,
    started: false,
    paused: false,
    speed: 1,
    elapsedSeconds: 0,
    day: 1,
    dirtyCash: 850,
    cleanCash: 350,
    totalDirtyEarned: 150,
    totalCleanEarned: 50,
    totalExportedUnits: 2,
    activeStrain: 'kush',
    unlockedStrains: ['kush'],
    act: 1,
    missionIndex: 0,
    completedMissions: [],
    selectedSlotId: 'slot_rp_farm1',
    selectedRegionId: 'rio_plata',
    slots,
    regions,
    lieutenants,
    rival: {
      name: 'Los Lobos Syndicate',
      threatTimer: 48,
      activeRaidRegion: null,
      defeatedCount: 0
    },
    activeTrucks: [],
    nextTruckId: 1,
    mode: 'campaign',
    timeOfDay: 0.34,
    weather: 'clear',
    weatherTimer: 28,
    research: {},
    tutorialStep: 0,
    tutorialDone: false,
    mapOpen: false,
    reputation: 0,
    difficulty: 'standard',
    difficultyMods: null,
    heatIntro: false,
    noSeizure: true,
    heatHandled: 0,
    patrolsHandled: 0,
    routesCompleted: 0,
    routesLost: 0,
    boatRuns: 0,
    valleySeizures: 0,
    campaignStatus: 'playing',
    failReason: null,
    failId: null,
    dea: { agent: 'Helen Ruiz', case: 0 },
    routeLuck: null,
    event: null,
    eventCooldown: 180,
    eventsSeen: [],
    priceMood: 1,
    chain: { raw: 0, cured: 0, stored: 0, hauled: 0 },
    missionMark: null,
    riskReadyAt: null,
    lossWarning: null,
    zones: createZoneBook(),
    lots: createLotBook(),
    rivals: createRivalBook(),
    shipments: [],
    feed: [
      { id: 1, time: 'Day 1', text: 'Río Plata supply chain online: Plantation → Drying Barn → Warehouse → River Pier.', kind: 'info' },
      { id: 2, time: 'Day 1', text: coreMode()
        ? 'Grow, cure, store, haul, then sell. Dirty cash pays for the next field.'
        : 'Dirty Cash pays for field expansion. Launder Dirty Cash through Fronts to earn Clean Cash.', kind: 'ok' }
    ]
  };
  settlePeace(state);
  return state;
}

function settlePeace(state) {
  if (!state || !state.noSeizure) return;
  for (const reg of Object.values(state.regions || {})) {
    reg.heat = 0;
    reg.patrol = null;
    reg.raidActive = false;
    reg.raidTimer = 0;
    if (reg.raidTargetSlot && state.slots && state.slots[reg.raidTargetSlot]) {
      state.slots[reg.raidTargetSlot].raidLocked = false;
    }
    reg.raidTargetSlot = null;
  }
  for (const zone of Object.values(state.zones || {})) {
    zone.heat = 0;
    zone.patrol = null;
    zone.raidActive = false;
    zone.raidTimer = 0;
  }
}

export class CartelSimulation {
  constructor(onEvent) {
    this.onEvent = onEvent || (() => {});
    this.state = createInitialState();
    this.saveTimer = 0;
  }

  hasSavedGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return !!(parsed && parsed.version === 1 && parsed.slots);
    } catch (e) {
      return false;
    }
  }

  save() {
    try {
      const payload = JSON.stringify({
        ...this.state,
        // Cap transient arrays on save
        activeTrucks: this.state.activeTrucks.slice(0, 24),
        feed: this.state.feed.slice(0, 14)
      });
      localStorage.setItem(SAVE_KEY, payload);
      return true;
    } catch (e) {
      return false;
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || !data.slots) return false;
      const fresh = createInitialState();
      this.state = {
        ...fresh,
        ...data,
        slots: { ...fresh.slots, ...(data.slots || {}) },
        regions: { ...fresh.regions, ...(data.regions || {}) },
        lieutenants: { ...fresh.lieutenants, ...(data.lieutenants || {}) },
        rival: { ...fresh.rival, ...(data.rival || {}) },
        activeTrucks: Array.isArray(data.activeTrucks) ? data.activeTrucks : [],
        feed: Array.isArray(data.feed) ? data.feed : fresh.feed,
        research: data.research && typeof data.research === 'object' ? data.research : {},
        zones: data.zones && typeof data.zones === 'object' ? { ...fresh.zones, ...data.zones } : fresh.zones,
        lots: data.lots && typeof data.lots === 'object' ? { ...fresh.lots, ...data.lots } : fresh.lots,
        rivals: data.rivals && typeof data.rivals === 'object' ? { ...fresh.rivals, ...data.rivals } : fresh.rivals,
        shipments: Array.isArray(data.shipments) ? data.shipments : [],
        mode: data.mode === 'sandbox' ? 'sandbox' : 'campaign',
        timeOfDay: Number.isFinite(data.timeOfDay) ? data.timeOfDay : fresh.timeOfDay,
        weather: data.weather === 'rain' || data.weather === 'fog' ? data.weather : 'clear',
        weatherTimer: Number.isFinite(data.weatherTimer) ? data.weatherTimer : fresh.weatherTimer,
        tutorialStep: Math.max(0, Math.floor(Number(data.tutorialStep) || 0)),
        tutorialDone: !!data.tutorialDone,
        heatIntro: !!data.heatIntro,
        event: data.event && data.event.id ? data.event : null,
        eventCooldown: Number.isFinite(data.eventCooldown) ? data.eventCooldown : fresh.eventCooldown,
        eventsSeen: Array.isArray(data.eventsSeen) ? data.eventsSeen.filter((id) => typeof id === 'string') : [],
        priceMood: Number.isFinite(data.priceMood) ? data.priceMood : 1,
        chain: {
          raw: Number(data.chain && data.chain.raw) || 0,
          cured: Number(data.chain && data.chain.cured) || 0,
          stored: Number(data.chain && data.chain.stored) || 0,
          hauled: Number(data.chain && data.chain.hauled) || 0
        },
        missionMark: data.missionMark && data.missionMark.id ? data.missionMark : null,
        riskReadyAt: Number.isFinite(data.riskReadyAt) ? data.riskReadyAt : null,
        lossWarning: typeof data.lossWarning === 'string' ? data.lossWarning : null
      };
      if (coreMode()) this.state.noSeizure = true;
      // Ensure every slot has clean objects
      for (const s of BUILD_SLOTS) {
        if (!this.state.slots[s.id]) {
          this.state.slots[s.id] = fresh.slots[s.id];
        } else {
          this.state.slots[s.id].inputBuffer = this.state.slots[s.id].inputBuffer || {};
          this.state.slots[s.id].outputBuffer = this.state.slots[s.id].outputBuffer || {};
          this.state.slots[s.id].constructLeft = Number(this.state.slots[s.id].constructLeft) || 0;
        }
      }
      for (const lot of Object.values(this.state.lots)) {
        lot.inputBuffer = lot.inputBuffer || {};
        lot.outputBuffer = lot.outputBuffer || {};
      }
      this.state.mapOpen = !!this.state.mapOpen;
      this.state.reputation = Number(this.state.reputation) || 0;
      this.state.heatHandled = Number(this.state.heatHandled) || 0;
      this.state.routesCompleted = Number(this.state.routesCompleted) || 0;
      this.state.boatRuns = Number(this.state.boatRuns) || 0;
      this.state.valleySeizures = Number(this.state.valleySeizures) || 0;
      this.state.dea = {
        agent: 'Helen Ruiz',
        case: Math.max(0, Math.min(100, Number(this.state.dea && this.state.dea.case) || 0))
      };
      if (this.state.campaignStatus !== 'failed' && this.state.campaignStatus !== 'complete') {
        this.state.campaignStatus = 'playing';
      }
      this.state.failReason = this.state.failReason || null;
      this.state.failId = this.state.failId || null;
      for (const row of Object.values(this.state.lieutenants)) {
        row.betrayed = !!row.betrayed;
        if (!row.zoneId && row.regionId) row.zoneId = row.regionId;
      }
      refreshControl(this.state);
      settlePeace(this.state);
      return true;
    } catch (e) {
      return false;
    }
  }

  resetNewGame() {
    this.state = createInitialState();
    this.state.started = true;
    this.save();
  }

  startSandbox(difficulty = 'standard') {
    const diff = DIFFICULTIES[difficulty] || DIFFICULTIES.standard;
    this.state = createInitialState();
    this.state.mode = 'sandbox';
    this.state.started = true;
    this.state.act = 3;
    this.state.difficulty = diff.id;
    this.state.difficultyMods = { heat: diff.heat, rival: diff.rival, prices: diff.prices };
    this.state.dirtyCash = diff.dirty;
    this.state.cleanCash = diff.clean;
    this.state.reputation = diff.reputation;
    this.state.tutorialDone = true;
    this.state.tutorialStep = 99;
    this.state.mapOpen = true;
    this.state.noSeizure = coreMode();
    this.state.riskReadyAt = coreMode() ? null : 0;
    this.state.lossWarning = null;
    for (const region of Object.values(this.state.regions)) region.unlocked = true;
    for (const zone of Object.values(this.state.zones)) zone.unlocked = true;
    refreshControl(this.state);
    this.log(`Sandbox open on ${diff.label}. Country and Puerto Sol are both on the map.`, 'ok');
    this.save();
  }

  setDifficulty(id) {
    if (this.state.mode !== 'sandbox') return { ok: false, reason: 'Difficulty is a sandbox setting.' };
    const diff = DIFFICULTIES[id];
    if (!diff) return { ok: false, reason: 'Unknown difficulty.' };
    this.state.difficulty = diff.id;
    this.state.difficultyMods = { heat: diff.heat, rival: diff.rival, prices: diff.prices };
    this.save();
    return { ok: true, difficulty: diff.id };
  }

  log(text, kind = 'info') {
    const entry = {
      id: Date.now() + Math.random(),
      time: `Day ${this.state.day}`,
      text,
      kind
    };
    this.state.feed.unshift(entry);
    if (this.state.feed.length > 16) this.state.feed.length = 16;
    this.onEvent({ type: 'log', entry });
  }

  getActiveStrain() {
    return STRAINS.find((s) => s.id === this.state.activeStrain) || STRAINS[0];
  }

  getRegionModifiers(regionId) {
    const regDef = REGIONS.find((r) => r.id === regionId);
    const crew = coreMode()
      ? { prodMult: 1, launderMult: 1, heatMult: 1, defensePower: 0 }
      : crewMods(this.state, regionId);
    let prodMult = (regDef ? regDef.fertilityBonus : 1.0) * crew.prodMult;
    let launderMult = crew.launderMult;
    let heatMult = crew.heatMult;
    const defensePower = crew.defensePower;
    if (this.state.research.lights) prodMult *= 1.2;
    if (this.state.research.irrigation && regionId === 'rio_plata') prodMult *= 1.08;
    if (this.state.research.filters) heatMult *= 0.75;
    return { prodMult, launderMult, heatMult, defensePower };
  }

  truckSpeed() {
    const slots = Object.values(this.state.slots);
    const hasDepot = slots.some((s) => s.buildingId === 'transport_depot' && !s.raidLocked);
    let speed = hasDepot ? 210 : 165;
    if (coreMode()) speed = hasDepot ? 155 : 115;
    if (this.state.research.radios) speed *= 1.3;
    if (this.state.weather === 'rain') speed *= 0.82;
    return speed;
  }

  getMaxTrucks() {
    let base = 4; // Base syndicate pickup fleet
    for (const slot of Object.values(this.state.slots)) {
      if (!slot.buildingId || slot.raidLocked) continue;
      const b = BUILDINGS[slot.buildingId];
      if (b && b.trucksProvided) {
        base += b.trucksProvided + (slot.level - 1);
      }
    }
    if (!coreMode()) {
      for (const lt of LIEUTENANTS) {
        const ls = this.state.lieutenants[lt.id];
        if (ls && ls.hired && lt.id === 'cesar') base += 2;
      }
    }
    return base;
  }

  getStorageCount(buffer) {
    let sum = 0;
    for (const k in buffer) sum += buffer[k] || 0;
    return sum;
  }

  // Build a facility on an empty unlocked slot
  buildOnSlot(slotId, buildingId) {
    const slot = this.state.slots[slotId];
    const slotDef = BUILD_SLOTS.find((s) => s.id === slotId);
    const bDef = BUILDINGS[buildingId];
    if (!slot || !slotDef || !bDef) return { ok: false, reason: 'Invalid slot or building.' };

    const reg = this.state.regions[slot.regionId];
    if (!reg || !reg.unlocked) return { ok: false, reason: 'Unlock this region first.' };
    if (slot.rivalControlled) return { ok: false, reason: 'Clear the rival outpost on this lot first.' };
    if (slot.buildingId) return { ok: false, reason: 'Slot already occupied.' };
    const lotGate = this.state.lots && this.state.lots[slotId];
    if (lotGate && lotGate.kind === 'standing' && lotGate.phase !== 'cleared') {
      return { ok: false, reason: 'Buy and convert the building, or buy the lot and demolish it.' };
    }
    if (this.state.mode !== 'sandbox' && this.state.act < bDef.act) {
      return { ok: false, reason: `Unlocks in Act ${bDef.act}.` };
    }
    const openPlot = lotGate && lotGate.kind === 'open';
    const dirtyCost = openPlot ? Math.round(bDef.buildCostDirty * 0.85) : bDef.buildCostDirty;
    const cleanCost = openPlot ? Math.round(bDef.buildCostClean * 0.85) : bDef.buildCostClean;
    if (this.state.dirtyCash < dirtyCost) {
      return { ok: false, reason: `Need $${dirtyCost - Math.floor(this.state.dirtyCash)} more Dirty Cash.` };
    }
    if (this.state.cleanCash < cleanCost) {
      return { ok: false, reason: `Need $${cleanCost - Math.floor(this.state.cleanCash)} more Clean Cash.` };
    }

    this.state.dirtyCash -= dirtyCost;
    this.state.cleanCash -= cleanCost;
    slot.buildingId = buildingId;
    slot.level = 1;
    slot.progress = 0;
    slot.constructLeft = 60;
    slot.inputBuffer = {};
    slot.outputBuffer = {};
    slot.raidLocked = false;
    if (lotGate) {
      lotGate.owned = true;
      lotGate.owner = 'player';
      lotGate.phase = 'building';
      lotGate.buildingId = buildingId;
      lotGate.role = roleForBuilding(buildingId);
      lotGate.constructLeft = 60;
    }

    this.log(`Constructed ${bDef.name} at ${slotDef.label}. Crews need a minute.`, 'ok');
    if (!this.state.tutorialDone && (buildingId === 'taxi_co' || bDef.role === 'launderer')) this.advanceTutorial(1);
    this.onEvent({ type: 'built', slotId, buildingId });
    this.checkMissionsAndActs();
    this.save();
    return { ok: true };
  }

  upgradeQuote(slotId) {
    const slot = this.state.slots[slotId];
    if (!slot || !slot.buildingId || slot.level >= 3) return null;
    const bDef = BUILDINGS[slot.buildingId];
    if (!bDef) return null;
    if (coreMode()) {
      if (slot.level >= 2) return null;
      return { dirty: Math.max(120, Math.round((bDef.buildCostDirty || 200) * 0.35)), clean: 0 };
    }
    const clean = (bDef.upgradeCostClean && bDef.upgradeCostClean[slot.level - 1]) || 0;
    if (!clean) return null;
    return { dirty: 0, clean };
  }

  upgradeSlot(slotId) {
    const slot = this.state.slots[slotId];
    if (!slot || !slot.buildingId) return { ok: false, reason: 'No facility on this lot.' };
    const quote = this.upgradeQuote(slotId);
    if (!quote) return { ok: false, reason: slot.level >= 2 && coreMode() ? 'That upgrade is already in.' : 'Facility is already at maximum tier (Lv 3).' };
    const bDef = BUILDINGS[slot.buildingId];
    if (quote.dirty && this.state.dirtyCash < quote.dirty) {
      return { ok: false, reason: `Requires $${quote.dirty} Dirty Cash.` };
    }
    if (quote.clean && this.state.cleanCash < quote.clean) {
      return { ok: false, reason: `Requires $${quote.clean} Clean Cash (launder more via Fronts).` };
    }
    this.state.dirtyCash -= quote.dirty || 0;
    this.state.cleanCash -= quote.clean || 0;
    slot.level += 1;
    this.log(`Upgraded ${bDef.name} to Tier ${slot.level} (+40% throughput).`, 'ok');
    this.onEvent({ type: 'upgraded', slotId, level: slot.level });
    this.checkMissionsAndActs();
    this.save();
    return { ok: true, quote };
  }

  demolishSlot(slotId) {
    const slot = this.state.slots[slotId];
    if (!slot || !slot.buildingId) return { ok: false, reason: 'Nothing to demolish.' };
    const bDef = BUILDINGS[slot.buildingId];
    const refund = Math.floor(bDef.buildCostDirty * 0.5);
    this.state.dirtyCash += refund;
    slot.buildingId = null;
    slot.level = 1;
    slot.progress = 0;
    slot.inputBuffer = {};
    slot.outputBuffer = {};
    slot.raidLocked = false;
    this.log(`Deconstructed ${bDef.name} (+$${refund} Dirty Cash salvaged).`, 'info');
    this.onEvent({ type: 'demolished', slotId });
    this.save();
    return { ok: true };
  }

  unlockRegion(regionId) {
    const reg = this.state.regions[regionId];
    const regDef = REGIONS.find((r) => r.id === regionId);
    if (!reg || !regDef) return { ok: false, reason: 'Unknown region.' };
    if (reg.unlocked) return { ok: false, reason: 'Region already unlocked.' };
    const cost = regDef.unlockCostClean;
    if (coreMode()) {
      if (this.state.dirtyCash < cost) {
        return { ok: false, reason: `Requires $${cost} Dirty Cash to open ${regDef.name}.` };
      }
      this.state.dirtyCash -= cost;
    } else if (this.state.cleanCash < cost) {
      return { ok: false, reason: `Requires $${cost} Clean Cash to bribe regional officials.` };
    } else {
      this.state.cleanCash -= cost;
    }
    reg.unlocked = true;
    if (!coreMode() && regionId === 'san_marco' && this.state.act < 2) this.state.act = 2;
    if (!coreMode() && regionId === 'sierra_alta' && this.state.act < 3) this.state.act = 3;

    this.log(`Expanded syndicate territory into ${regDef.name}!`, 'ok');
    this.onEvent({ type: 'region_unlocked', regionId });
    this.checkMissionsAndActs();
    this.save();
    return { ok: true };
  }

  clearRivalSlot(slotId) {
    const slot = this.state.slots[slotId];
    const slotDef = BUILD_SLOTS.find((s) => s.id === slotId);
    if (!slot || !slot.rivalControlled) return { ok: false, reason: 'No rival outpost here.' };
    const reg = this.state.regions[slot.regionId];
    if (!reg || !reg.unlocked) return { ok: false, reason: 'Unlock Sierra Alta Highlands first.' };

    const costDirty = 900;
    const costClean = 350;
    if (this.state.dirtyCash < costDirty || this.state.cleanCash < costClean) {
      return { ok: false, reason: `Assaulting Los Lobos requires $${costDirty} Dirty + $${costClean} Clean Cash.` };
    }
    this.state.dirtyCash -= costDirty;
    this.state.cleanCash -= costClean;
    slot.rivalControlled = false;
    this.state.rival.defeatedCount += 1;
    const clearedLot = this.state.lots && this.state.lots[slotId];
    if (clearedLot) {
      clearedLot.owned = true;
      clearedLot.owner = 'player';
      clearedLot.access = 'intimidated';
      clearedLot.phase = 'cleared';
      clearedLot.role = null;
      clearedLot.buildingId = null;
    }
    reg.heat = Math.min(95, reg.heat + 16);

    this.log(`Seized ${slotDef.label} from Los Lobos Syndicate!`, 'ok');
    this.onEvent({ type: 'rival_cleared', slotId });
    this.checkMissionsAndActs();
    this.save();
    return { ok: true };
  }

  hireLieutenant(ltId) {
    if (coreMode()) return { ok: false, reason: 'Crew payroll is paused.' };
    const ltDef = LIEUTENANTS.find((l) => l.id === ltId);
    const ltState = this.state.lieutenants[ltId];
    if (!ltDef || !ltState) return { ok: false, reason: 'Invalid lieutenant.' };
    if (ltState.betrayed) return { ok: false, reason: 'They already walked.' };
    if (ltState.hired) return { ok: false, reason: 'Already on the payroll.' };
    if (this.state.cleanCash < ltDef.hireCostClean) {
      return { ok: false, reason: `Requires $${ltDef.hireCostClean} Clean Cash retainer.` };
    }
    this.state.cleanCash -= ltDef.hireCostClean;
    ltState.hired = true;
    ltState.loyalty = ltDef.loyalty;
    this.log(`Recruited ${ltDef.name} (${ltDef.perkName}).`, 'ok');
    this.onEvent({ type: 'lieutenant_hired', ltId });
    this.checkMissionsAndActs();
    this.save();
    return { ok: true };
  }

  assignLieutenant(ltId, placeId) {
    if (coreMode()) return { ok: false, reason: 'Crew payroll is paused.' };
    const ltState = this.state.lieutenants[ltId];
    const ltDef = LIEUTENANTS.find((l) => l.id === ltId);
    const zone = this.state.zones && this.state.zones[placeId];
    const reg = this.state.regions[placeId];
    if (!ltState || !ltState.hired || ltState.betrayed || !ltDef) return { ok: false, reason: 'Cannot assign.' };
    if (!zone && !reg) return { ok: false, reason: 'Unknown zone.' };
    if (zone && !zone.unlocked) return { ok: false, reason: 'Unlock that zone first.' };
    if (!zone && reg && !reg.unlocked) return { ok: false, reason: 'Unlock that region first.' };
    ltState.regionId = placeId;
    ltState.zoneId = placeId;
    const zoneDef = zoneById(placeId);
    const regDef = REGIONS.find((item) => item.id === placeId);
    const placeName = (zoneDef && zoneDef.name) || (regDef && regDef.name) || placeId;
    const bits = [];
    if (ltDef.prodMult > 1) bits.push(`${Math.round((ltDef.prodMult - 1) * 100)}% output`);
    if (ltDef.launderMult > 1) bits.push(`${Math.round((ltDef.launderMult - 1) * 100)}% laundering`);
    if (ltDef.heatMult < 1) bits.push(`${Math.round((1 - ltDef.heatMult) * 100)}% less heat`);
    if (ltDef.defensePower >= 8) bits.push('repels raids');
    this.log(`${ltDef.name.split(' ')[0]} is in ${placeName}${bits.length ? ': ' + bits.join(', ') : ''}.`, 'ok');
    this.checkMissionsAndActs();
    this.save();
    return { ok: true };
  }

  payLieutenantBonus(ltId) {
    if (coreMode()) return { ok: false, reason: 'Crew payroll is paused.' };
    const ltState = this.state.lieutenants[ltId];
    const ltDef = LIEUTENANTS.find((l) => l.id === ltId);
    if (!ltState || !ltState.hired) return { ok: false };
    const bonusCost = 200;
    if (this.state.cleanCash < bonusCost) return { ok: false, reason: 'Need $200 Clean Cash for loyalty bonus.' };
    this.state.cleanCash -= bonusCost;
    ltState.loyalty = Math.min(100, ltState.loyalty + 20);
    this.log(`Paid $${bonusCost} Clean Cash bonus to ${ltDef.name} (Loyalty ${ltState.loyalty}%).`, 'ok');
    this.save();
    return { ok: true };
  }

  selectStrain(strainId) {
    const st = STRAINS.find((s) => s.id === strainId);
    if (!st) return { ok: false };
    if (!this.state.unlockedStrains.includes(strainId)) {
      if (this.state.cleanCash < st.unlockCostClean) {
        return { ok: false, reason: `Requires $${st.unlockCostClean} Clean Cash to research ${st.name}.` };
      }
      this.state.cleanCash -= st.unlockCostClean;
      this.state.unlockedStrains.push(strainId);
      this.log(`Unlocked ${st.name} cultivar genetics!`, 'ok');
    }
    this.state.activeStrain = strainId;
    this.save();
    return { ok: true };
  }

  // Mayor / Police Bribe & Raid resolution
  bribeRegionAuthorities(regionId) {
    const reg = this.state.regions[regionId];
    const regDef = REGIONS.find((r) => r.id === regionId);
    if (!reg) return { ok: false };
    let cleanCost = reg.raidActive ? 250 : 160;
    let dirtyCost = reg.raidActive ? 350 : 200;

    if (this.state.research && this.state.research.bribe_net) {
      cleanCost = Math.round(cleanCost * 0.8);
      dirtyCost = Math.round(dirtyCost * 0.8);
    }

    if (this.state.cleanCash >= cleanCost) {
      this.state.cleanCash -= cleanCost;
    } else if (this.state.dirtyCash >= dirtyCost) {
      this.state.dirtyCash -= dirtyCost;
    } else {
      return { ok: false, reason: `Need $${cleanCost} Clean Cash (or $${dirtyCost} Dirty Cash) to pay off ${regDef.townName} commandante.` };
    }

    const drop = this.state.research && this.state.research.bribe_net ? 56 : 48;
    reg.heat = Math.max(5, reg.heat - drop);
    if (this.state.dea) this.state.dea.case = Math.max(0, (Number(this.state.dea.case) || 0) - 6);
    reg.loyalty = Math.min(100, reg.loyalty + 10);
    const zoneMirror = this.state.zones && this.state.zones[regionId];
    if (zoneMirror) zoneMirror.heat = reg.heat;
    if (reg.patrol && reg.patrol.active) {
      reg.patrol = null;
      this.state.patrolsHandled = (this.state.patrolsHandled || 0) + 1;
      this.state.heatHandled = (this.state.heatHandled || 0) + 1;
    }
    if (reg.raidActive) {
      this.state.heatHandled = (this.state.heatHandled || 0) + 1;
      reg.raidActive = false;
      reg.raidTimer = 0;
      if (reg.raidTargetSlot && this.state.slots[reg.raidTargetSlot]) {
        this.state.slots[reg.raidTargetSlot].raidLocked = false;
      }
      reg.raidTargetSlot = null;
      this.log(`Commandante paid off in ${regDef.name} — federal raid called off!`, 'ok');
      this.onEvent({ type: 'raid_cleared', regionId });
    } else {
      this.state.heatHandled = (this.state.heatHandled || 0) + 1;
      this.log(`Donated civic funds in ${regDef.townName} (-${drop} Regional Heat).`, 'ok');
    }
    this.onEvent({ type: 'bribed', regionId });
    this.checkMissionsAndActs();
    this.save();
    return { ok: true };
  }

  // Trigger a raid on a region (either naturally when heat >= 100 or for inspection/testing)
  triggerRegionalRaid(regionId) {
    const reg = this.state.regions[regionId];
    const regDef = REGIONS.find((r) => r.id === regionId);
    if (!reg) return;
    const mods = this.getRegionModifiers(regionId);

    // Find an active player building in this region
    const regionSlots = Object.values(this.state.slots).filter(
      (s) => s.regionId === regionId && s.buildingId && !s.raidLocked
    );
    const targetSlot = regionSlots.length > 0 ? regionSlots[0] : null;

    reg.raidActive = true;
    reg.raidTimer = 22;
    reg.heat = Math.max(78, reg.heat);
    if (targetSlot) {
      reg.raidTargetSlot = targetSlot.slotId;
      targetSlot.raidLocked = true;
    }

    if (mods.defensePower >= 8) {
      this.log(`Federal inspection in ${regDef.name}! Comandante Valeria is engaging the task force.`, 'warn');
    } else {
      this.log(`ALERT: DEA & Policía Raid in ${regDef.name}! Bribe officials or send enforcers before confiscation!`, 'danger');
    }
    this.onEvent({ type: 'raid_started', regionId, slotId: reg.raidTargetSlot });
  }

  // Main simulation tick (dt in seconds)
  step(dt) {
    if (this.state.paused || !this.state.started) return;
    const effDt = dt * (this.state.speed || 1);
    this.state.elapsedSeconds += effDt;
    this.armRisk();
    this.syncRisk();
    if (this.state.lossWarning && this.state.riskReadyAt != null && this.state.elapsedSeconds >= this.state.riskReadyAt) {
      this.state.lossWarning = null;
    }
    this.state.timeOfDay = (this.state.timeOfDay + effDt / 90) % 1;
    this.advanceWorld(effDt);
    const newDay = 1 + Math.floor(this.state.elapsedSeconds / 10);
    if (newDay !== this.state.day) {
      this.state.day = newDay;
      this.onDailyTick();
    }

    const strain = this.getActiveStrain();

    // 1. Update all buildings
    for (const slot of Object.values(this.state.slots)) {
      if (!slot.buildingId || slot.rivalControlled) continue;
      const bDef = BUILDINGS[slot.buildingId];
      if (!bDef) continue;
      const reg = this.state.regions[slot.regionId];
      if (!reg || !reg.unlocked) continue;
      if (slot.raidLocked) continue;
      if (slot.constructLeft > 0) {
        slot.constructLeft -= effDt;
        const buildingLot = this.state.lots && this.state.lots[slot.slotId];
        if (buildingLot) buildingLot.constructLeft = Math.max(0, slot.constructLeft);
        if (slot.constructLeft > 0) continue;
        slot.constructLeft = 0;
        if (buildingLot) buildingLot.phase = 'operating';
      }

      const mods = this.getRegionModifiers(slot.regionId);
      const levelMult = 1 + (slot.level - 1) * 0.4;
      let speedMult = mods.prodMult * levelMult * (slot.buildingId === 'plantation' ? strain.speedMult : 1.0);
      if (this.state.weather === 'rain') speedMult *= 0.84;
      if (this.state.weather === 'fog') speedMult *= 0.92;
      if (hiddenNow(this.state, reg)) speedMult *= 0.15;

      // Ambient heat contribution
      const night = this.state.timeOfDay > 0.72 || this.state.timeOfDay < 0.18;
      const diffHeat = this.state.difficultyMods ? this.state.difficultyMods.heat : 1;
      const heatDelta = (bDef.heatRate || 0) * effDt * mods.heatMult * diffHeat * (night ? 0.8 : 1) * (slot.buildingId === 'plantation' ? strain.heatMult : 1.0);
      if (riskLive(this.state)) reg.heat = Math.max(0, Math.min(100, (Number(reg.heat) || 0) + heatDelta * 0.35));

      if (bDef.role === 'producer') {
        const outCount = this.getStorageCount(slot.outputBuffer);
        const cap = storageCap(bDef, slot.level, capExtra(this.state, bDef));
        if (outCount < cap) {
          slot.progress += (effDt * speedMult) / bDef.cycleSeconds;
          if (slot.progress >= 1) {
            slot.progress = 0;
            for (const [goodId, qty] of Object.entries(bDef.outputs)) {
              const had = slot.outputBuffer[goodId] || 0;
              slot.outputBuffer[goodId] = Math.min(cap, had + qty);
              if (goodId === 'raw_herb') this.noteChain('raw', slot.outputBuffer[goodId] - had);
            }
            this.onEvent({ type: 'produced', slotId: slot.slotId, buildingId: slot.buildingId });
          }
        }
      } else if (bDef.role === 'processor') {
        const hasInputs = Object.entries(bDef.inputs).every(
          ([goodId, reqQty]) => (slot.inputBuffer[goodId] || 0) >= reqQty
        );
        const outCount = this.getStorageCount(slot.outputBuffer);
        const cap = storageCap(bDef, slot.level, capExtra(this.state, bDef));
        if (hasInputs && outCount < cap) {
          slot.progress += (effDt * speedMult) / bDef.cycleSeconds;
          if (slot.progress >= 1) {
            slot.progress = 0;
            for (const [goodId, reqQty] of Object.entries(bDef.inputs)) {
              slot.inputBuffer[goodId] = Math.max(0, (slot.inputBuffer[goodId] || 0) - reqQty);
            }
            for (const [goodId, outQty] of Object.entries(bDef.outputs)) {
              const had = slot.outputBuffer[goodId] || 0;
              slot.outputBuffer[goodId] = Math.min(cap, had + outQty);
              if (goodId === 'cured_pack') this.noteChain('cured', slot.outputBuffer[goodId] - had);
            }
            this.onEvent({ type: 'processed', slotId: slot.slotId, buildingId: slot.buildingId });
          }
        }
      } else if (bDef.role === 'smuggling') {
        // Export any goods in inputBuffer
        const inCount = this.getStorageCount(slot.inputBuffer);
        if (inCount > 0) {
          slot.progress += (effDt * levelMult) / bDef.cycleSeconds;
          if (slot.progress >= 1) {
            slot.progress = 0;
            let remainingCap = bDef.exportCapPerCycle * slot.level;
            let earnedDirty = 0;
            let earnedClean = 0;
            let shippedUnits = 0;

            for (const [goodId, avail] of Object.entries(slot.inputBuffer)) {
              if (avail <= 0 || remainingCap <= 0) continue;
              const take = Math.min(avail, remainingCap);
              const gDef = GOODS[goodId];
              if (!gDef) continue;
              slot.inputBuffer[goodId] -= take;
              remainingCap -= take;
              shippedUnits += take;

              const strainPriceMult = (goodId === 'raw_herb' || goodId === 'cured_pack') ? strain.valueMult : 1.0;
              const seal = this.state.research.seal ? 1.2 : 1;
              const pilots = this.state.research.pilots && slot.buildingId === 'aerodrome' ? 1.15 : 1;
              const mood = this.state.priceMood || 1;
              let dirtyBit = Math.round(take * gDef.unitValueDirty * bDef.priceMultiplier * strainPriceMult * seal * pilots * mood);
              let cleanBit = Math.round(take * gDef.unitValueClean * bDef.priceMultiplier * mood);
              if (slot.buyer === 'cafe') {
                const moved = Math.round(dirtyBit * 0.5);
                dirtyBit -= moved;
                cleanBit = Math.round((cleanBit + moved * 0.6) * 1.45);
              }
              earnedDirty += dirtyBit;
              earnedClean += cleanBit;
              const manifest = this.state.research.manifests ? 0.7 : 1;
              if (riskLive(this.state)) reg.heat = Math.min(100, reg.heat + take * gDef.heatPerUnit * bDef.heatPerExport * mods.heatMult * manifest);
            }

            if (shippedUnits > 0) {
              this.state.dirtyCash += earnedDirty;
              this.state.cleanCash += earnedClean;
              this.state.totalDirtyEarned += earnedDirty;
              this.state.totalCleanEarned += earnedClean;
              this.state.totalExportedUnits += shippedUnits;
              if (riskLive(this.state) && !this.state.tutorialDone && !this.state.heatIntro) {
                this.state.heatIntro = true;
                reg.heat = Math.min(92, reg.heat + 28);
                this.advanceTutorial(3);
                this.log('The pier run spiked heat in the valley. Cool it before a raid.', 'warn');
                this.onEvent({ type: 'heat_spike', regionId: reg.id });
              }
              this.onEvent({
                type: 'exported',
                slotId: slot.slotId,
                earnedDirty,
                earnedClean,
                shippedUnits
              });
              this.checkMissionsAndActs();
            }
          }
        }
      } else if (bDef.role === 'launderer') {
        // Convert Dirty Cash into Clean Cash
        const maxLaunder = Math.round(bDef.launderPerCycle * levelMult * mods.launderMult);
        if (launderTake(this.state.dirtyCash, maxLaunder) > 0) {
          slot.progress += (effDt * levelMult) / bDef.cycleSeconds;
          if (slot.progress >= 1) {
            slot.progress = 0;
            const dirtyToConvert = launderTake(this.state.dirtyCash, maxLaunder);
            if (dirtyToConvert > 0) {
              const cleanOut = Math.round(dirtyToConvert * bDef.launderRatio);
              this.state.dirtyCash -= dirtyToConvert;
              this.state.cleanCash += cleanOut;
              this.state.totalCleanEarned += cleanOut;
              reg.loyalty = Math.min(100, reg.loyalty + bDef.loyaltyBonus);
              if (!this.state.tutorialDone && this.state.tutorialStep < 2) this.advanceTutorial(2);
              this.onEvent({
                type: 'laundered',
                slotId: slot.slotId,
                dirtyUsed: dirtyToConvert,
                cleanEarned: cleanOut
              });
              this.checkMissionsAndActs();
            }
          }
        }
      }
    }

    // 2. Dispatch & advance logistics trucks
    this.dispatchLogisticsTrucks();
    this.updateTrucks(effDt);

    // 3. Update Regional Heat & Raids
    for (const reg of Object.values(this.state.regions)) {
      if (!reg.unlocked) continue;
      if (this.state.noSeizure) continue;
      const regDef = REGIONS.find((r) => r.id === reg.id);
      const mods = this.getRegionModifiers(reg.id);

      // Passive cooling from town loyalty & security lieutenants
      const cooling = (regDef.baseHeatDecay + (mods.defensePower >= 8 ? 0.55 : 0)) * effDt * 0.35;
      reg.heat = Math.max(0, reg.heat - cooling);

      if (hiddenNow(this.state, reg)) reg.heat = Math.max(0, reg.heat - effDt * 0.35);
      notePatrol(reg, reg.heat);
      const patrolSignal = tickPatrol(reg, effDt);
      if (!reg.raidActive && (reg.heat >= 96 || patrolSignal === 'escalate')) {
        this.triggerRegionalRaid(reg.id);
      }
      const mirror = this.state.zones && this.state.zones[reg.id];
      if (mirror) {
        mirror.heat = reg.heat;
        mirror.patrol = reg.patrol;
        mirror.raidActive = reg.raidActive;
        mirror.hiddenUntil = reg.hiddenUntil || 0;
      }

      if (reg.raidActive) {
        reg.raidTimer -= effDt;
        // If Comandante Valeria is stationed here, she repels the raid automatically
        if (mods.defensePower >= 8 && reg.raidTimer <= 14) {
          reg.raidActive = false;
          reg.raidTimer = 0;
          reg.heat = 45;
          if (reg.raidTargetSlot && this.state.slots[reg.raidTargetSlot]) {
            this.state.slots[reg.raidTargetSlot].raidLocked = false;
          }
          reg.raidTargetSlot = null;
          this.log(`Comandante Valeria's security detail repelled the raid in ${regDef.name}!`, 'ok');
          this.onEvent({ type: 'raid_cleared', regionId: reg.id });
        } else if (reg.raidTimer <= 0) {
          // Raid completes confiscation
          reg.raidActive = false;
          reg.raidTimer = 0;
          reg.heat = 42;
          const fineDirty = Math.min(Math.floor(this.state.dirtyCash * 0.25), 600);
          this.state.dirtyCash = Math.max(0, this.state.dirtyCash - fineDirty);
          if (reg.raidTargetSlot && this.state.slots[reg.raidTargetSlot]) {
            const target = this.state.slots[reg.raidTargetSlot];
            target.raidLocked = false;
            target.inputBuffer = {};
            target.outputBuffer = {};
          }
          reg.raidTargetSlot = null;
          if (this.state.dea) this.state.dea.case = Math.min(100, (Number(this.state.dea.case) || 0) + 8);
          if (reg.id === 'rio_plata') this.state.valleySeizures = (this.state.valleySeizures || 0) + 1;
          this.log(`DEA raid seized stock and $${fineDirty} Dirty Cash in ${regDef.name}.`, 'danger');
          this.onEvent({ type: 'raid_seized', regionId: reg.id, fineDirty });
        }
      }
    }

    for (const slot of Object.values(this.state.slots)) {
      if (slot.rivalLock && this.state.elapsedSeconds >= (slot.rivalUntil || 0)) {
        slot.rivalLock = false;
        const reg = this.state.regions[slot.regionId];
        if (!reg || !reg.raidActive || reg.raidTargetSlot !== slot.slotId) slot.raidLocked = false;
      }
    }

    tickLots(this.state, effDt);
    const arrived = tickShipments(this.state, effDt);
    if (arrived && arrived.ok) {
      this.log(`Shipment landed: $${arrived.earned} dirty.`, 'ok');
      this.onEvent({ type: 'route_landed', earned: arrived.earned, vehicleId: arrived.shipment.vehicleId });
      this.checkMissionsAndActs();
    } else if (arrived && arrived.caught) {
      this.log(`A ${arrived.shipment.vehicleId} was stopped. The load is gone.`, 'danger');
      this.onEvent({ type: 'route_caught', vehicleId: arrived.shipment.vehicleId });
    }
    refreshControl(this.state);
    syncMap(this.state);
    if (coreMode()) {
      for (const reg of Object.values(this.state.regions)) reg.heat = 0;
      for (const zone of Object.values(this.state.zones || {})) zone.heat = 0;
    }
    settlePeace(this.state);
    this.checkMissionsAndActs();

    // 4. Autosave periodically
    this.saveTimer += dt;
    if (this.saveTimer >= 5) {
      this.saveTimer = 0;
      this.save();
    }
  }

  noteChain(key, amount) {
    if (!amount) return;
    if (!this.state.chain) this.state.chain = { raw: 0, cured: 0, stored: 0, hauled: 0 };
    this.state.chain[key] += amount;
  }

  armRisk() {
    if (coreMode() || this.state.mode === 'sandbox') return;
    if ((this.state.act || 1) < 2 || this.state.riskReadyAt != null) return;
    this.state.riskReadyAt = this.state.elapsedSeconds + 20;
    this.state.lossWarning = 'The valley tutorial is over. Raids, patrols, and rival crews can take cash and stock. A countdown will show before anything is seized.';
    this.log(this.state.lossWarning, 'warn');
  }

  // Peace holds through Act I and the warning. riskReadyAt 0 is the test
  // and sandbox bypass. Core mode never leaves peace.
  syncRisk() {
    if (coreMode()) {
      this.state.noSeizure = true;
      return;
    }
    if (this.state.mode === 'sandbox') {
      this.state.noSeizure = false;
      if (this.state.riskReadyAt == null) this.state.riskReadyAt = 0;
      return;
    }
    if (this.state.riskReadyAt === 0) {
      this.state.noSeizure = false;
      return;
    }
    const live = this.state.riskReadyAt != null && this.state.elapsedSeconds >= this.state.riskReadyAt;
    this.state.noSeizure = !live;
  }

  noteCampaignFailure() {
    const failure = campaignFailure(this.state);
    if (!failure) return;
    this.state.campaignStatus = 'failed';
    this.state.failId = failure.id;
    this.state.failReason = failure.text;
    this.log(failure.text, 'danger');
    this.onEvent({ type: 'campaign_failed', id: failure.id });
  }

  onDailyTick() {
    this.noteCampaignFailure();
    if (coreMode()) return;
    tickLoyalty(this.state);
    const betrayals = tickBetrayal(this.state);
    for (const note of betrayals) {
      this.log(`${note.name} walked with $${note.skim} and talked to Ruiz.`, 'danger');
      this.onEvent({ type: 'betrayed', ltId: note.id, zoneId: note.zoneId });
    }
    const notes = riskLive(this.state) ? tickRivals(this.state, this.state.elapsedSeconds) : [];
    for (const note of notes) {
      this.log(note.text, note.slotId || note.lotId ? 'danger' : 'warn');
      if (note.slotId || note.lotId) this.onEvent({ type: 'rival_raid', slotId: note.slotId || null, lotId: note.lotId || null, rivalId: note.rivalId });
    }
  }

  // Logistics router: matches outputBuffers to best downstream consumer
  dispatchLogisticsTrucks() {
    const maxTrucks = this.getMaxTrucks();
    if (this.state.activeTrucks.length >= maxTrucks) return;

    const slots = Object.values(this.state.slots);
    const truckSpeed = this.truckSpeed();

    // 1. Producers/Warehouses with outputBuffer -> Processors needing input OR Warehouses OR Smuggling points
    for (const src of slots) {
      if (this.state.activeTrucks.length >= maxTrucks) break;
      if (!src.buildingId || src.raidLocked) continue;
      const srcDef = BUILDINGS[src.buildingId];
      if (!srcDef) continue;

      for (const [goodId, availQty] of Object.entries(src.outputBuffer)) {
        if (availQty < 1) continue;

        // Find best destination for goodId
        let bestDest = null;
        let bestPriority = -1;

        for (const dst of slots) {
          if (dst.slotId === src.slotId || !dst.buildingId || dst.raidLocked) continue;
          const dstDef = BUILDINGS[dst.buildingId];
          if (!dstDef) continue;
          const dstInCount = this.getStorageCount(dst.inputBuffer);
          const dstOutCount = this.getStorageCount(dst.outputBuffer);

          // Priority 3: Processor that specifically requires this goodId
          if (dstDef.role === 'processor' && dstDef.inputs[goodId] && dstInCount < dstDef.storageCap - 1) {
            const p = 30 - (dst.inputBuffer[goodId] || 0);
            if (p > bestPriority) {
              bestPriority = p;
              bestDest = { slot: dst, targetBuffer: 'input' };
            }
          }
          // Priority 2: Smuggling point (prefers processed/concealed/legal goods, or raw if no processor)
          else if (dstDef.role === 'smuggling' && dstInCount < dstDef.storageCap - 1) {
            const isProcessed = GOODS[goodId]?.category !== 'raw';
            const p = isProcessed ? 25 : 12;
            if (p > bestPriority) {
              bestPriority = p;
              bestDest = { slot: dst, targetBuffer: 'input' };
            }
          }
          // Priority 1: Warehouse buffer (if source is not already a warehouse).
          // While the goal is storage, processed goods fill the shed before the pier,
          // the way Cartel Tycoon's early loop puts a warehouse between the lab and the sale.
          else if (srcDef.role !== 'warehouse' && dstDef.role === 'warehouse' && dstOutCount < dstDef.storageCap - 2) {
            const storeMission = coreMode() && this.getCurrentMission();
            const wantStore = !!(storeMission && storeMission.metric === 'stored');
            const processed = GOODS[goodId] && GOODS[goodId].category !== 'raw';
            // A short buffer in the shed sits between the lab and the pier, then the pier takes the rest.
            const p = wantStore && processed ? 40 : (processed && dstOutCount < 4 ? 28 : 15);
            if (p > bestPriority) {
              bestPriority = p;
              bestDest = { slot: dst, targetBuffer: 'output' };
            }
          }
        }

        if (bestDest) {
          const carryQty = Math.min(availQty, 2);
          src.outputBuffer[goodId] -= carryQty;

          const srcSlotDef = BUILD_SLOTS.find((s) => s.id === src.slotId);
          const dstSlotDef = BUILD_SLOTS.find((s) => s.id === bestDest.slot.slotId);

          const path = findRoadPath(src.slotId, bestDest.slot.slotId);
          const last = path[path.length - 1] || { x: dstSlotDef.x, y: dstSlotDef.y };
          const truck = {
            id: this.state.nextTruckId++,
            fromSlotId: src.slotId,
            toSlotId: bestDest.slot.slotId,
            targetBuffer: bestDest.targetBuffer,
            goodId,
            qty: carryQty,
            x: srcSlotDef.x,
            y: srcSlotDef.y,
            tx: last.x,
            ty: last.y,
            path,
            pathIndex: 0,
            speed: truckSpeed
          };
          this.state.activeTrucks.push(truck);
          this.onEvent({ type: 'truck_departed', truck });
          break;
        }
      }
    }
  }

  updateTrucks(effDt) {
    const remaining = [];
    for (const t of this.state.activeTrucks) {
      if (!t.path || !t.path.length) {
        t.path = [{ x: t.tx, y: t.ty }];
        t.pathIndex = 0;
      }
      const target = t.path[t.pathIndex] || { x: t.tx, y: t.ty };
      const dx = target.x - t.x;
      const dy = target.y - t.y;
      const dist = Math.hypot(dx, dy);
      const stepDist = t.speed * effDt;
      if (dist <= stepDist + 3) {
        t.x = target.x;
        t.y = target.y;
        t.pathIndex += 1;
        if (t.pathIndex >= t.path.length) {
          const dst = this.state.slots[t.toSlotId];
          if (dst && dst.buildingId) {
            const buf = t.targetBuffer === 'output' ? dst.outputBuffer : dst.inputBuffer;
            const had = buf[t.goodId] || 0;
            buf[t.goodId] = had + t.qty;
            const moved = buf[t.goodId] - had;
            this.noteChain('hauled', moved);
            const dstDef = BUILDINGS[dst.buildingId];
            if (dstDef && dstDef.role === 'warehouse') this.noteChain('stored', moved);
            this.onEvent({ type: 'truck_delivered', truck: t });
            if (!this.state.tutorialDone && this.state.tutorialStep < 2) this.state.tutorialStep = 2;
          }
        } else {
          remaining.push(t);
        }
      } else {
        t.x += (dx / dist) * stepDist;
        t.y += (dy / dist) * stepDist;
        t.heading = Math.atan2(dy, dx);
        remaining.push(t);
      }
    }
    this.state.activeTrucks = remaining;
  }

  advanceWorld(effDt) {
    this.state.weatherTimer -= effDt;
    if (this.state.weatherTimer <= 0) {
      this.state.weatherTimer = 26 + Math.random() * 18;
      const roll = Math.random();
      const next = roll < 0.55 ? 'clear' : roll < 0.82 ? 'rain' : 'fog';
      if (next !== this.state.weather) {
        this.state.weather = next;
        const label = next === 'clear' ? 'The ridge clears.' : next === 'rain' ? 'Rain walks down the valley. Fields slow.' : 'Fog sits on the river. Trucks take the long bends.';
        this.log(label, 'info');
        this.onEvent({ type: 'weather', weather: next });
      }
    }
    if (this.state.priceMood > 1) this.state.priceMood = Math.max(1, this.state.priceMood - effDt * 0.01);
    if (!this.state.tutorialDone && this.state.mode === 'campaign') {
      const t = this.state.elapsedSeconds;
      if (this.state.tutorialStep < 1 && t > 55) this.state.tutorialStep = 1;
      if (this.state.tutorialStep < 2 && t > 95) this.state.tutorialStep = 2;
      if (this.state.tutorialStep < 3 && t > 130) this.state.tutorialStep = 3;
      if (t > 175) this.state.tutorialDone = true;
    }
    if (coreMode()) {
      this.state.event = null;
      return;
    }
    if (this.state.event) return;
    this.state.eventCooldown -= effDt;
    if (this.state.eventCooldown > 0) return;
    if (!this.state.tutorialDone && this.state.elapsedSeconds < 45) return;
    const card = nextEvent(this.state);
    if (!card) return;
    this.state.event = card;
    this.onEvent({ type: 'event', event: this.state.event });
  }

  buyResearch(id) {
    const node = RESEARCH.find((item) => item.id === id);
    if (!node) return { ok: false, reason: 'Unknown research.' };
    if (this.state.research[id]) return { ok: false, reason: 'Already on the books.' };
    if (node.requires && !this.state.research[node.requires]) {
      const prev = RESEARCH.find((item) => item.id === node.requires);
      return { ok: false, reason: `Research ${prev ? prev.name : node.requires} first.` };
    }
    if (this.state.cleanCash < node.cost) return { ok: false, reason: `Need $${node.cost - Math.floor(this.state.cleanCash)} more Clean Cash.` };
    this.state.cleanCash -= node.cost;
    this.state.research[id] = true;
    this.log(`Research complete: ${node.name}.`, 'ok');
    this.onEvent({ type: 'research', id });
    this.save();
    return { ok: true };
  }

  resolveEvent(index) {
    const card = this.state.event;
    if (!card) return { ok: false, reason: 'No open card.' };
    const choice = card.choices[index];
    if (!choice) return { ok: false, reason: 'That choice is not on the card.' };
    const applied = applyEffect(this.state, choice.effect);
    if (!applied.ok) return applied;
    if (applied.text) this.log(applied.text, applied.kind || 'ok');
    this.state.eventsSeen.push(card.id);
    this.state.event = null;
    this.state.eventCooldown = 180;
    this.onEvent({ type: 'event_resolved', id: card.id, effect: choice.effect });
    settlePeace(this.state);
    this.save();
    return { ok: true };
  }

  advanceTutorial(step) {
    if (this.state.tutorialDone) return;
    if (step > this.state.tutorialStep) this.state.tutorialStep = step;
    if (step >= 5) this.state.tutorialDone = true;
    this.save();
  }

  getCurrentMission() {
    const list = coreMode() ? CORE_MISSIONS : MISSIONS;
    return list[this.state.missionIndex] || null;
  }

  getMissionProgress(mission) {
    if (!mission) return { current: 1, target: 1, done: true, label: 'All Syndicate Objectives Complete' };

    const slots = Object.values(this.state.slots);
    let current = 0;
    if (mission.metric === 'totalDirtyEarned') {
      current = Math.floor(this.state.totalDirtyEarned);
    } else if (mission.metric === 'totalCleanEarned') {
      current = Math.floor(this.state.totalCleanEarned);
    } else if (mission.metric === 'buildingCount') {
      current = slots.filter((s) => !!s.buildingId).length;
    } else if (mission.metric === 'aerodromeBuilt') {
      current = slots.some((s) => s.buildingId === 'aerodrome') ? 1 : 0;
    } else if (mission.metric === 'ruralZones') {
      current = ['jungle_alta', 'river_delta', 'mesa_strip'].filter((id) => this.state.zones[id] && this.state.zones[id].unlocked).length;
    } else if (mission.metric === 'cityProperties') {
      current = Object.values(this.state.lots).filter((lot) => {
        if (!lot.owned || !lot.zoneId || !lot.zoneId.startsWith('ps_')) return false;
        return lot.phase === 'operating' || lot.phase === 'building' || lot.phase === 'cleared' || lot.phase === 'encumbered';
      }).length;
    } else if (mission.metric === 'cityControl') {
      current = Math.max(0, ...Object.values(this.state.zones).filter((zone) => String(zone.id).startsWith('ps_')).map((zone) => zone.control || 0));
    } else if (mission.metric === 'heatHandled') {
      current = this.state.heatHandled || 0;
    } else if (mission.metric === 'zoneUnlocked') {
      const live = this.state.zones[mission.zoneId];
      current = live && live.unlocked ? 1 : 0;
    } else if (mission.metric === 'ruralOperations') {
      current = Object.values(this.state.lots).filter((lot) => {
        if (!lot.owned || lot.phase !== 'operating') return false;
        const zone = zoneById(lot.zoneId);
        return !!(zone && zone.kind === 'rural' && zone.id !== 'rio_plata');
      }).length;
    } else if (mission.metric === 'assignedOutside') {
      current = Object.values(this.state.lieutenants).filter((row) => {
        if (!row.hired || row.betrayed) return false;
        const place = row.zoneId || row.regionId;
        return !!place && place !== 'rio_plata';
      }).length;
    } else if (mission.metric === 'boatRuns') {
      current = this.state.boatRuns || 0;
    } else if (mission.metric === 'zoneProperty') {
      current = Object.values(this.state.lots).filter((lot) => {
        if (lot.zoneId !== mission.zoneId || !lot.owned) return false;
        return lot.phase === 'operating' || lot.phase === 'building';
      }).length;
    } else if (mission.metric === 'zoneRole') {
      current = Object.values(this.state.lots).filter((lot) => {
        return lot.zoneId === mission.zoneId && lot.owned && lot.phase === 'operating' && lot.role === mission.role;
      }).length;
    } else if (mission.metric === 'lotOwned') {
      const lot = this.state.lots[mission.lotId];
      current = lot && lot.owned && (lot.phase === 'operating' || lot.phase === 'building') ? 1 : 0;
    } else if (mission.metric === 'zoneControl') {
      current = measureControl(this.state, mission.zoneId);
    } else if (mission.metric === 'producedRaw' || mission.metric === 'producedCured' || mission.metric === 'stored' || mission.metric === 'hauled') {
      const chain = this.state.chain || { raw: 0, cured: 0, stored: 0, hauled: 0 };
      if (!this.state.missionMark || this.state.missionMark.id !== mission.id) {
        this.state.missionMark = { id: mission.id, raw: chain.raw, cured: chain.cured, stored: chain.stored, hauled: chain.hauled };
      }
      const key = mission.metric === 'producedRaw' ? 'raw'
        : mission.metric === 'producedCured' ? 'cured'
        : mission.metric === 'stored' ? 'stored'
        : 'hauled';
      current = Math.max(0, chain[key] - (this.state.missionMark[key] || 0));
    } else if (mission.metric === 'slotBuilding') {
      const built = this.state.slots[mission.slotId];
      current = built && built.buildingId === mission.buildingId ? 1 : 0;
    } else if (mission.metric === 'cityNeighborhoods') {
      const ids = new Set();
      for (const lot of Object.values(this.state.lots)) {
        if (!lot.owned || !String(lot.zoneId).startsWith('ps_')) continue;
        if (lot.phase !== 'operating' && lot.phase !== 'building') continue;
        ids.add(lot.zoneId);
      }
      current = ids.size;
    }

    let extraMet = true;
    let extraNote = '';
    if (mission.requireBuilding) {
      const hasB = slots.some((s) => s.buildingId === mission.requireBuilding);
      if (!hasB) {
        extraMet = false;
        extraNote = `Build ${BUILDINGS[mission.requireBuilding]?.shortName || mission.requireBuilding}`;
      }
    }
    if (mission.requireAnyBuilding) {
      const hasAny = slots.some((s) => mission.requireAnyBuilding.includes(s.buildingId));
      if (!hasAny) {
        extraMet = false;
        extraNote = 'Build Chem Lab or Packer Mill';
      }
    }
    if (mission.requireRegion) {
      const reg = this.state.regions[mission.requireRegion];
      if (!reg || !reg.unlocked) {
        extraMet = false;
        extraNote = 'Unlock required region';
      }
    }
    if (mission.requireLieutenants) {
      const hiredCount = Object.values(this.state.lieutenants).filter((l) => l.hired).length;
      if (hiredCount < mission.requireLieutenants) {
        extraMet = false;
        extraNote = `Hire ${mission.requireLieutenants} Lieutenants (${hiredCount}/${mission.requireLieutenants})`;
      }
    }
    if (mission.requireZone) {
      const zone = this.state.zones[mission.requireZone];
      if (!zone || !zone.unlocked) {
        extraMet = false;
        if (!extraNote) extraNote = 'Open the zone';
      }
    }
    if (mission.requireProperty) {
      const owned = Object.values(this.state.lots).some((lot) => {
        if (lot.zoneId !== mission.requireProperty || !lot.owned) return false;
        return lot.phase === 'operating' || lot.phase === 'building';
      });
      if (!owned) {
        extraMet = false;
        if (!extraNote) extraNote = 'Own a property there';
      }
    }
    if (mission.requireRivalCleared) {
      const anyRival = slots.some((s) => s.rivalControlled);
      if (anyRival) {
        extraMet = false;
        extraNote = 'Clear Los Lobos outposts';
      }
    }

    const done = current >= mission.targetValue && extraMet;
    const progressText = extraNote
      ? `${extraNote} · ${Math.min(current, mission.targetValue)}/${mission.targetValue}`
      : `${Math.min(current, mission.targetValue).toLocaleString()} / ${mission.targetValue.toLocaleString()}`;

    return {
      current: Math.min(current, mission.targetValue),
      target: mission.targetValue,
      pct: Math.min(100, Math.round((current / mission.targetValue) * 100)),
      done,
      progressText
    };
  }

  checkMissionsAndActs() {
    let guard = 0;
    while (guard < 8) {
      guard += 1;
      const mission = this.getCurrentMission();
      if (!mission) {
        if (this.state.campaignStatus !== 'failed') this.state.campaignStatus = 'complete';
        return;
      }
      const prog = this.getMissionProgress(mission);
      if (!prog.done || this.state.completedMissions.includes(mission.id)) return;
      this.state.completedMissions.push(mission.id);
      if (Array.isArray(mission.alsoComplete)) {
        for (const id of mission.alsoComplete) {
          if (!this.state.completedMissions.includes(id)) this.state.completedMissions.push(id);
        }
      }
      this.state.cleanCash += mission.rewardClean;
      this.state.dirtyCash += mission.rewardDirty;
      this.state.totalCleanEarned += mission.rewardClean;
      this.state.totalDirtyEarned += mission.rewardDirty;
      this.state.missionIndex += 1;
      this.state.reputation = (this.state.reputation || 0) + 6;

      const prevAct = this.state.act;
      const nextM = this.getCurrentMission();
      if (nextM && nextM.act > this.state.act) this.state.act = nextM.act;
      if (this.state.act > prevAct) this.armRisk();
      if (!nextM && this.state.campaignStatus !== 'failed') this.state.campaignStatus = 'complete';
      const rewardNote = mission.rewardClean > 0 ? ` (+$${mission.rewardClean} Clean Cash)` : '';
      this.log(`Objective Complete: ${mission.title}${rewardNote}!`, 'ok');
      this.onEvent({ type: 'mission_completed', mission });
    }
  }

  // --- Gameplay hooks. The scene reads gameplayView() and calls these. ---

  gameplayView() {
    return gameplayView(this);
  }

  recommendedLotId() {
    const mission = this.getCurrentMission();
    if (coreMode()) {
      const corePick = {
        c1_grow: 'slot_rp_farm1',
        c1_process: 'slot_rp_barn1',
        c1_store: 'slot_rp_wh1',
        c1_haul: 'slot_rp_wh1',
        c1_sell: 'slot_rp_pier',
        c1_plot: 'slot_rp_south',
        c2_zone: 'lot_rd_mill',
        c2_lot: 'lot_rd_mill'
      };
      return (mission && corePick[mission.id]) || null;
    }
    if (!this.state.tutorialDone && (this.state.tutorialStep || 0) === 0) return 'slot_rp_town1';
    const pick = {
      m1_first_export: 'slot_rp_pier',
      m1_heat: 'slot_rp_town1',
      m2_first_front: 'slot_rp_town1',
      m2_delta_work: 'lot_rd_mill',
      m2_boat_run: 'slot_rp_wh1',
      m3_barrio: 'lot_ba_laundry',
      m3_docks: 'lot_dk_garage',
      m3_downtown: 'lot_dt_cars',
      m3_beach: 'lot_bh_motel',
      m3_hold_barrio: 'lot_ba_pawn',
      m3_hills: 'lot_hi_motel'
    };
    return (mission && pick[mission.id]) || null;
  }

  recommendedSlot() {
    const id = this.recommendedLotId();
    if (!id || !this.state.slots[id] || this.state.slots[id].buildingId) return null;
    return id;
  }

  observeFrame() {
    syncMap(this.state);
    refreshControl(this.state);
  }

  zoneControl(zoneId) {
    refreshControl(this.state);
    return measureControl(this.state, zoneId);
  }

  unlockZone(zoneId) {
    syncMap(this.state);
    const result = unlockZone(this.state, zoneId);
    if (!result.ok) return result;
    this.log(`Opened ${result.zone.name}.`, 'ok');
    this.onEvent({ type: 'zone_unlocked', zoneId });
    refreshControl(this.state);
    this.checkMissionsAndActs();
    this.save();
    return result;
  }

  buyAndConvert(lotId, role) {
    const result = buyAndConvert(this.state, lotId, role);
    if (!result.ok) return result;
    this.log(`Converted the lot into a ${role}.`, 'ok');
    this.onEvent({ type: 'converted', lotId, role });
    refreshControl(this.state);
    this.checkMissionsAndActs();
    this.save();
    return result;
  }

  buyLot(lotId) {
    const result = buyLot(this.state, lotId);
    if (!result.ok) return result;
    this.log('Deed signed. The old building still stands until you demolish it.', 'ok');
    this.onEvent({ type: 'lot_bought', lotId });
    this.save();
    return result;
  }

  startDemolish(lotId) {
    const result = startDemolish(this.state, lotId);
    if (!result.ok) return result;
    this.log(`Demolition crew on site, ${result.seconds}s.`, 'info');
    this.onEvent({ type: 'demolish_started', lotId });
    this.save();
    return result;
  }

  buildNew(lotId, buildingId) {
    const result = buildNew(this.state, lotId, buildingId);
    if (!result.ok) return result;
    this.log('New build started on the cleared lot.', 'ok');
    this.onEvent({ type: 'build_started', lotId, buildingId });
    this.save();
    return result;
  }

  buildOnPlot(lotId, buildingId) {
    if (this.state.slots[lotId]) return this.buildOnSlot(lotId, buildingId);
    const result = buildOnPlot(this.state, lotId, buildingId);
    if (!result.ok) return result;
    this.log('Crews broke ground on an open plot.', 'ok');
    this.onEvent({ type: 'build_started', lotId, buildingId });
    this.checkMissionsAndActs();
    this.save();
    return result;
  }

  negotiate(lotId) {
    const result = negotiate(this.state, lotId);
    if (!result.ok) return result;
    this.log('The owner will sell.', 'ok');
    this.save();
    return result;
  }

  intimidate(lotId, spendDirty = 0) {
    const result = intimidate(this.state, lotId, spendDirty);
    if (!result.ok) {
      if (result.reason) this.log(result.reason, 'warn');
      return result;
    }
    this.log('They handed over the conversation. The price dropped.', 'ok');
    this.save();
    return result;
  }

  planRoute(request) {
    const result = planRoute(this.state, request || {});
    if (!result.ok) return result;
    this.log(`${result.shipment.vehicleId} loaded with ${result.shipment.qty}. ${Math.ceil(result.shipment.left)}s out.`, 'info');
    this.onEvent({ type: 'route_planned', shipment: result.shipment });
    this.save();
    return result;
  }

  hideFromPatrol(id) {
    const result = hide(this.state, id);
    if (!result.ok) return result;
    const region = this.state.regions[id];
    const zone = this.state.zones[id];
    if (region && zone) {
      zone.heat = region.heat;
      zone.hiddenUntil = region.hiddenUntil;
      zone.patrol = null;
    }
    this.log(result.slipped ? 'Lights out. The patrol rolled past.' : 'The block goes quiet.', result.slipped ? 'ok' : 'info');
    this.onEvent({ type: 'hid', id });
    refreshControl(this.state);
    this.checkMissionsAndActs();
    this.save();
    return result;
  }
}
