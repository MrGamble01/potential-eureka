// Grow Op: San Verde '84 — Core Simulation, Logistics, Laundering, Heat & Save Engine

import { GOODS, STRAINS } from './data/goods.js';
import { BUILDINGS } from './data/buildings.js';
import { REGIONS, BUILD_SLOTS, LIEUTENANTS, ACTS, MISSIONS, findRoadPath } from './data/missions.js';
import { RESEARCH } from './data/research.js';
import { EVENTS } from './data/events.js';

export const SAVE_KEY = 'growop-cartel-v1';

export function createInitialState() {
  const slots = {};
  for (const s of BUILD_SLOTS) {
    slots[s.id] = {
      slotId: s.id,
      regionId: s.regionId,
      buildingId: s.starterBuilding || null,
      level: 1,
      progress: s.starterBuilding ? 0.35 : 0,
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
      heat: r.id === 'rio_plata' ? 14 : 6,
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
      regionId: lt.unlockedAtStart ? 'rio_plata' : 'rio_plata',
      loyalty: lt.loyalty,
      cooldown: 0
    };
  }

  return {
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
    event: null,
    eventCooldown: 16,
    eventsSeen: [],
    priceMood: 1,
    feed: [
      { id: 1, time: 'Day 1', text: 'Río Plata supply chain online: Plantation → Drying Barn → Warehouse → River Pier.', kind: 'info' },
      { id: 2, time: 'Day 1', text: 'Dirty Cash pays for field expansion. Launder Dirty Cash through Fronts to earn Clean Cash.', kind: 'ok' }
    ]
  };
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
        mode: data.mode === 'sandbox' ? 'sandbox' : 'campaign',
        timeOfDay: Number.isFinite(data.timeOfDay) ? data.timeOfDay : fresh.timeOfDay,
        weather: data.weather === 'rain' || data.weather === 'fog' ? data.weather : 'clear',
        weatherTimer: Number.isFinite(data.weatherTimer) ? data.weatherTimer : fresh.weatherTimer,
        tutorialStep: Math.max(0, Math.floor(Number(data.tutorialStep) || 0)),
        tutorialDone: !!data.tutorialDone,
        event: data.event && data.event.id ? data.event : null,
        eventCooldown: Number.isFinite(data.eventCooldown) ? data.eventCooldown : fresh.eventCooldown,
        eventsSeen: Array.isArray(data.eventsSeen) ? data.eventsSeen.filter((id) => typeof id === 'string') : [],
        priceMood: Number.isFinite(data.priceMood) ? data.priceMood : 1
      };
      // Ensure every slot has clean objects
      for (const s of BUILD_SLOTS) {
        if (!this.state.slots[s.id]) {
          this.state.slots[s.id] = fresh.slots[s.id];
        } else {
          this.state.slots[s.id].inputBuffer = this.state.slots[s.id].inputBuffer || {};
          this.state.slots[s.id].outputBuffer = this.state.slots[s.id].outputBuffer || {};
        }
      }
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

  startSandbox() {
    this.state = createInitialState();
    this.state.mode = 'sandbox';
    this.state.started = true;
    this.state.act = 3;
    this.state.dirtyCash = 8000;
    this.state.cleanCash = 4500;
    this.state.tutorialDone = true;
    this.state.tutorialStep = 99;
    for (const region of Object.values(this.state.regions)) region.unlocked = true;
    this.log('Sandbox open. Every district is already on the map.', 'ok');
    this.save();
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
    let prodMult = regDef ? regDef.fertilityBonus : 1.0;
    let launderMult = 1.0;
    let heatMult = 1.0;
    let defensePower = 0;

    for (const lt of LIEUTENANTS) {
      const ls = this.state.lieutenants[lt.id];
      if (ls && ls.hired && ls.regionId === regionId) {
        prodMult *= lt.prodMult;
        launderMult *= lt.launderMult;
        heatMult *= lt.heatMult;
        defensePower += lt.defensePower;
      }
    }
    if (this.state.research.lights) prodMult *= 1.2;
    if (this.state.research.filters) heatMult *= 0.75;
    return { prodMult, launderMult, heatMult, defensePower };
  }

  truckSpeed() {
    const slots = Object.values(this.state.slots);
    const hasDepot = slots.some((s) => s.buildingId === 'transport_depot' && !s.raidLocked);
    let speed = hasDepot ? 210 : 165;
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
    for (const lt of LIEUTENANTS) {
      const ls = this.state.lieutenants[lt.id];
      if (ls && ls.hired && lt.id === 'cesar') base += 2;
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
    if (this.state.mode !== 'sandbox' && this.state.act < bDef.act) {
      return { ok: false, reason: `Unlocks in Act ${bDef.act}.` };
    }
    if (this.state.dirtyCash < bDef.buildCostDirty) {
      return { ok: false, reason: `Need $${bDef.buildCostDirty - Math.floor(this.state.dirtyCash)} more Dirty Cash.` };
    }
    if (this.state.cleanCash < bDef.buildCostClean) {
      return { ok: false, reason: `Need $${bDef.buildCostClean - Math.floor(this.state.cleanCash)} more Clean Cash.` };
    }

    this.state.dirtyCash -= bDef.buildCostDirty;
    this.state.cleanCash -= bDef.buildCostClean;
    slot.buildingId = buildingId;
    slot.level = 1;
    slot.progress = 0;
    slot.inputBuffer = {};
    slot.outputBuffer = {};
    slot.raidLocked = false;

    this.log(`Constructed ${bDef.name} at ${slotDef.label}.`, 'ok');
    if (!this.state.tutorialDone && (buildingId === 'taxi_co' || bDef.role === 'launderer')) this.advanceTutorial(4);
    this.onEvent({ type: 'built', slotId, buildingId });
    this.checkMissionsAndActs();
    this.save();
    return { ok: true };
  }

  upgradeSlot(slotId) {
    const slot = this.state.slots[slotId];
    if (!slot || !slot.buildingId) return { ok: false, reason: 'No facility on this lot.' };
    if (slot.level >= 3) return { ok: false, reason: 'Facility is already at maximum tier (Lv 3).' };
    const bDef = BUILDINGS[slot.buildingId];
    const costClean = bDef.upgradeCostClean[slot.level - 1] || 600;
    if (this.state.cleanCash < costClean) {
      return { ok: false, reason: `Requires $${costClean} Clean Cash (launder more via Fronts).` };
    }
    this.state.cleanCash -= costClean;
    slot.level += 1;
    this.log(`Upgraded ${bDef.name} to Tier ${slot.level} (+40% throughput).`, 'ok');
    this.onEvent({ type: 'upgraded', slotId, level: slot.level });
    this.checkMissionsAndActs();
    this.save();
    return { ok: true };
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
    if (this.state.cleanCash < regDef.unlockCostClean) {
      return { ok: false, reason: `Requires $${regDef.unlockCostClean} Clean Cash to bribe regional officials.` };
    }
    this.state.cleanCash -= regDef.unlockCostClean;
    reg.unlocked = true;
    // Auto-elevate act if unlocking region
    if (regionId === 'san_marco' && this.state.act < 2) this.state.act = 2;
    if (regionId === 'sierra_alta' && this.state.act < 3) this.state.act = 3;

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
    reg.heat = Math.min(95, reg.heat + 16);

    this.log(`Seized ${slotDef.label} from Los Lobos Syndicate!`, 'ok');
    this.onEvent({ type: 'rival_cleared', slotId });
    this.checkMissionsAndActs();
    this.save();
    return { ok: true };
  }

  hireLieutenant(ltId) {
    const ltDef = LIEUTENANTS.find((l) => l.id === ltId);
    const ltState = this.state.lieutenants[ltId];
    if (!ltDef || !ltState) return { ok: false, reason: 'Invalid lieutenant.' };
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

  assignLieutenant(ltId, regionId) {
    const ltState = this.state.lieutenants[ltId];
    const reg = this.state.regions[regionId];
    const ltDef = LIEUTENANTS.find((l) => l.id === ltId);
    const regDef = REGIONS.find((r) => r.id === regionId);
    if (!ltState || !ltState.hired || !reg) return { ok: false, reason: 'Cannot assign.' };
    if (!reg.unlocked) return { ok: false, reason: 'Unlock that region first.' };
    ltState.regionId = regionId;
    this.log(`${ltDef.name} stationed in ${regDef.name}.`, 'info');
    this.save();
    return { ok: true };
  }

  payLieutenantBonus(ltId) {
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
    const cleanCost = reg.raidActive ? 250 : 160;
    const dirtyCost = reg.raidActive ? 350 : 200;

    if (this.state.cleanCash >= cleanCost) {
      this.state.cleanCash -= cleanCost;
    } else if (this.state.dirtyCash >= dirtyCost) {
      this.state.dirtyCash -= dirtyCost;
    } else {
      return { ok: false, reason: `Need $${cleanCost} Clean Cash (or $${dirtyCost} Dirty Cash) to pay off ${regDef.townName} commandante.` };
    }

    reg.heat = Math.max(5, reg.heat - 48);
    reg.loyalty = Math.min(100, reg.loyalty + 10);
    if (reg.raidActive) {
      reg.raidActive = false;
      reg.raidTimer = 0;
      if (reg.raidTargetSlot && this.state.slots[reg.raidTargetSlot]) {
        this.state.slots[reg.raidTargetSlot].raidLocked = false;
      }
      reg.raidTargetSlot = null;
      this.log(`Commandante paid off in ${regDef.name} — federal raid called off!`, 'ok');
      this.onEvent({ type: 'raid_cleared', regionId });
    } else {
      this.log(`Donated civic funds in ${regDef.townName} (-48 Regional Heat).`, 'ok');
    }
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

      const mods = this.getRegionModifiers(slot.regionId);
      const levelMult = 1 + (slot.level - 1) * 0.4;
      let speedMult = mods.prodMult * levelMult * (slot.buildingId === 'plantation' ? strain.speedMult : 1.0);
      if (this.state.weather === 'rain') speedMult *= 0.84;
      if (this.state.weather === 'fog') speedMult *= 0.92;

      // Ambient heat contribution
      const night = this.state.timeOfDay > 0.72 || this.state.timeOfDay < 0.18;
      const heatDelta = (bDef.heatRate || 0) * effDt * mods.heatMult * (night ? 0.8 : 1) * (slot.buildingId === 'plantation' ? strain.heatMult : 1.0);
      reg.heat = Math.max(0, Math.min(100, (Number(reg.heat) || 0) + heatDelta * 0.35));

      if (bDef.role === 'producer') {
        const outCount = this.getStorageCount(slot.outputBuffer);
        if (outCount < bDef.storageCap) {
          slot.progress += (effDt * speedMult) / bDef.cycleSeconds;
          if (slot.progress >= 1) {
            slot.progress = 0;
            for (const [goodId, qty] of Object.entries(bDef.outputs)) {
              slot.outputBuffer[goodId] = Math.min(
                bDef.storageCap,
                (slot.outputBuffer[goodId] || 0) + qty
              );
            }
            this.onEvent({ type: 'produced', slotId: slot.slotId, buildingId: slot.buildingId });
          }
        }
      } else if (bDef.role === 'processor') {
        const hasInputs = Object.entries(bDef.inputs).every(
          ([goodId, reqQty]) => (slot.inputBuffer[goodId] || 0) >= reqQty
        );
        const outCount = this.getStorageCount(slot.outputBuffer);
        if (hasInputs && outCount < bDef.storageCap) {
          slot.progress += (effDt * speedMult) / bDef.cycleSeconds;
          if (slot.progress >= 1) {
            slot.progress = 0;
            for (const [goodId, reqQty] of Object.entries(bDef.inputs)) {
              slot.inputBuffer[goodId] = Math.max(0, (slot.inputBuffer[goodId] || 0) - reqQty);
            }
            for (const [goodId, outQty] of Object.entries(bDef.outputs)) {
              slot.outputBuffer[goodId] = Math.min(
                bDef.storageCap,
                (slot.outputBuffer[goodId] || 0) + outQty
              );
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
              earnedDirty += Math.round(take * gDef.unitValueDirty * bDef.priceMultiplier * strainPriceMult * seal * pilots * mood);
              earnedClean += Math.round(take * gDef.unitValueClean * bDef.priceMultiplier * mood);
              const manifest = this.state.research.manifests ? 0.7 : 1;
              reg.heat = Math.min(100, reg.heat + take * gDef.heatPerUnit * bDef.heatPerExport * mods.heatMult * manifest);
            }

            if (shippedUnits > 0) {
              this.state.dirtyCash += earnedDirty;
              this.state.cleanCash += earnedClean;
              this.state.totalDirtyEarned += earnedDirty;
              this.state.totalCleanEarned += earnedClean;
              this.state.totalExportedUnits += shippedUnits;
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
        if (this.state.dirtyCash >= 25) {
          slot.progress += (effDt * levelMult) / bDef.cycleSeconds;
          if (slot.progress >= 1) {
            slot.progress = 0;
            const dirtyToConvert = Math.min(Math.floor(this.state.dirtyCash), maxLaunder);
            if (dirtyToConvert > 0) {
              const cleanOut = Math.round(dirtyToConvert * bDef.launderRatio);
              this.state.dirtyCash -= dirtyToConvert;
              this.state.cleanCash += cleanOut;
              this.state.totalCleanEarned += cleanOut;
              reg.loyalty = Math.min(100, reg.loyalty + bDef.loyaltyBonus);
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
      const regDef = REGIONS.find((r) => r.id === reg.id);
      const mods = this.getRegionModifiers(reg.id);

      // Passive cooling from town loyalty & security lieutenants
      const cooling = (regDef.baseHeatDecay + (mods.defensePower >= 8 ? 0.55 : 0)) * effDt * 0.35;
      reg.heat = Math.max(0, reg.heat - cooling);

      if (!reg.raidActive && reg.heat >= 96) {
        this.triggerRegionalRaid(reg.id);
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
          this.log(`DEA raid seized stock and $${fineDirty} Dirty Cash in ${regDef.name}.`, 'danger');
          this.onEvent({ type: 'raid_seized', regionId: reg.id, fineDirty });
        }
      }
    }

    // 4. Autosave periodically
    this.saveTimer += dt;
    if (this.saveTimer >= 5) {
      this.saveTimer = 0;
      this.save();
    }
  }

  onDailyTick() {
    // Periodic upkeep & rival pressure
    this.state.rival.threatTimer = Math.max(0, this.state.rival.threatTimer - 4);
    if (this.state.rival.threatTimer <= 0) {
      this.state.rival.threatTimer = 55;
      // Check if rival still has outposts
      const rivalSlots = Object.values(this.state.slots).filter((s) => s.rivalControlled);
      if (rivalSlots.length > 0) {
        this.state.regions.rio_plata.heat = Math.min(95, this.state.regions.rio_plata.heat + 6);
        this.log('Los Lobos scouts spotted near the valley border (+6 Heat).', 'warn');
      }
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
          // Priority 1: Warehouse buffer (if source is not already a warehouse)
          else if (srcDef.role !== 'warehouse' && dstDef.role === 'warehouse' && dstOutCount < dstDef.storageCap - 2) {
            const p = 15;
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
          this.state.activeTrucks.push({
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
          });
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
            buf[t.goodId] = (buf[t.goodId] || 0) + t.qty;
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
      if (this.state.elapsedSeconds > 20 && this.state.tutorialStep < 1) this.state.tutorialStep = 1;
      if (this.state.elapsedSeconds > 70 && this.state.tutorialStep < 3) this.state.tutorialStep = 3;
      if (this.state.elapsedSeconds > 130 && this.state.tutorialStep < 4) this.state.tutorialStep = 4;
      if (this.state.elapsedSeconds > 170) this.state.tutorialDone = true;
    }
    if (this.state.event) return;
    this.state.eventCooldown -= effDt;
    if (this.state.eventCooldown > 0) return;
    if (!this.state.tutorialDone && this.state.elapsedSeconds < 45) return;
    const unseen = EVENTS.filter((card) => !this.state.eventsSeen.includes(card.id));
    const pool = unseen.length ? unseen : EVENTS;
    const card = pool[Math.floor(Math.random() * pool.length)];
    this.state.event = { id: card.id, title: card.title, body: card.body, choices: card.choices.map((c) => ({ label: c.label, effect: c.effect })) };
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
    const effect = choice.effect;
    const valley = this.state.regions.rio_plata;
    if (effect === 'fiesta_pay') {
      if (this.state.cleanCash < 220) return { ok: false, reason: 'Need $220 Clean Cash.' };
      this.state.cleanCash -= 220;
      valley.loyalty = Math.min(100, valley.loyalty + 12);
      valley.heat = Math.max(0, valley.heat - 8);
      this.log('The band plays. Puerto Plata stays friendly.', 'ok');
    } else if (effect === 'fiesta_skip') {
      valley.loyalty = Math.max(0, valley.loyalty - 6);
      this.log('The plaza notices the empty envelope.', 'warn');
    } else if (effect === 'checkpoint_pay') {
      if (this.state.dirtyCash < 180) return { ok: false, reason: 'Need $180 Dirty Cash.' };
      this.state.dirtyCash -= 180;
      valley.heat = Math.max(0, valley.heat - 10);
      this.log('The captain waves the next trucks through.', 'ok');
    } else if (effect === 'checkpoint_wait') {
      valley.heat = Math.min(100, valley.heat + 8);
      this.log('The line sits. Heat climbs while the tent stays up.', 'warn');
    } else if (effect === 'surge_on') {
      this.state.priceMood = 1.35;
      this.log('Coast buyers are paying 35% over list.', 'ok');
    } else if (effect === 'storm_on') {
      this.state.weather = 'rain';
      this.state.weatherTimer = 20;
      this.log('Crews stay on the plots through the rain.', 'info');
    } else if (effect === 'storm_hide') {
      this.state.weather = 'fog';
      this.state.weatherTimer = 16;
      valley.heat = Math.max(0, valley.heat - 12);
      this.log('Crews lay low. The valley cools under the fog.', 'ok');
    } else if (effect === 'informant_buy') {
      if (this.state.cleanCash < 300) return { ok: false, reason: 'Need $300 Clean Cash.' };
      this.state.cleanCash -= 300;
      const cesar = this.state.lieutenants.cesar;
      if (cesar) cesar.loyalty = Math.max(20, cesar.loyalty - 4);
      this.log('A gate on the ridge is marked. The assault will be cheaper.', 'ok');
      this.state.informant = true;
    }
    this.state.eventsSeen.push(card.id);
    this.state.event = null;
    this.state.eventCooldown = 24;
    this.onEvent({ type: 'event_resolved', id: card.id, effect });
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
    return MISSIONS[this.state.missionIndex] || null;
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
    const mission = this.getCurrentMission();
    if (!mission) return;
    const prog = this.getMissionProgress(mission);
    if (prog.done && !this.state.completedMissions.includes(mission.id)) {
      this.state.completedMissions.push(mission.id);
      this.state.cleanCash += mission.rewardClean;
      this.state.dirtyCash += mission.rewardDirty;
      this.state.totalCleanEarned += mission.rewardClean;
      this.state.totalDirtyEarned += mission.rewardDirty;
      this.state.missionIndex += 1;

      const nextM = this.getCurrentMission();
      if (nextM && nextM.act > this.state.act) {
        this.state.act = nextM.act;
      }
      this.log(`Objective Complete: ${mission.title} (+$${mission.rewardClean} Clean Cash)!`, 'ok');
      this.onEvent({ type: 'mission_completed', mission });
    }
  }
}
