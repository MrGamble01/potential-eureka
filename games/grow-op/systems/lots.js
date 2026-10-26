// Buy, convert, demolish, and build. City and rural use the same
// occupied-lot choice. Rural zones also have open plots.

import { BUILDINGS } from '../data/buildings.js';
import { LIEUTENANTS } from '../data/missions.js';
import { zoneById } from '../data/zones.js';
import {
  BUILDING_SIZE,
  PROPERTY_TYPES,
  buildingFits,
  lotDef,
  roleForBuilding
} from '../data/lots.js';

export function conversionMods(propertyType, role) {
  const type = PROPERTY_TYPES[propertyType];
  if (!type) return { allowed: false, fit: 'no', speed: 1, capacity: 1, heat: 1, suspicion: 0.2, note: 'Unknown building.' };
  const fit = type.roles[role] || 'no';
  if (fit === 'boost') {
    return { allowed: true, fit, speed: 1.25, capacity: 1.25, heat: 0.85, suspicion: type.suspicion * 0.85, note: `${type.label} suits a ${role}.` };
  }
  if (fit === 'ok') {
    return { allowed: true, fit, speed: 1, capacity: 1, heat: 1, suspicion: type.suspicion, note: `${type.label} can run as a ${role}.` };
  }
  if (fit === 'limit') {
    return { allowed: true, fit, speed: 0.75, capacity: 0.7, heat: 1.15, suspicion: type.suspicion * 1.25, note: `${type.label} is a poor ${role}.` };
  }
  return { allowed: false, fit: 'no', speed: 1, capacity: 1, heat: 1, suspicion: type.suspicion, note: `${type.label} cannot run as a ${role}.` };
}

export function quote(state, def, which) {
  const zone = zoneById(def.zoneId);
  const live = state.zones[def.zoneId];
  const heat = live ? Number(live.heat) || 0 : 0;
  const control = live && Number.isFinite(live.control) ? live.control : (zone ? zone.baseControl : 40);
  const base = which === 'lot' ? def.baseLot : def.baseBuy;
  const heatMult = 1 + Math.max(0, heat) / 180;
  const controlMult = 1 + Math.max(0, 40 - control) / 160;
  const prices = state.difficultyMods && state.difficultyMods.prices ? state.difficultyMods.prices : 1;
  return Math.max(40, Math.round(base * heatMult * controlMult * prices));
}

function purse(zone) {
  return zone && zone.kind === 'city' ? 'cleanCash' : 'dirtyCash';
}

function pay(state, zone, amount) {
  const key = purse(zone);
  if (state[key] < amount) {
    const label = key === 'cleanCash' ? 'Clean' : 'Dirty';
    return { ok: false, reason: `Need $${amount - Math.floor(state[key])} more ${label} Cash.` };
  }
  state[key] -= amount;
  return { ok: true, purse: key, amount };
}

export function zonePressure(state, zoneId) {
  let power = 0;
  for (const lt of LIEUTENANTS) {
    const row = state.lieutenants && state.lieutenants[lt.id];
    if (!row || !row.hired) continue;
    const here = row.regionId === zoneId || row.zoneId === zoneId;
    power += here ? lt.power : Math.ceil(lt.power / 3);
  }
  return power;
}

function accessOpen(lot) {
  return lot.access === 'open' || lot.access === 'negotiated' || lot.access === 'intimidated';
}

export function negotiate(state, lotId) {
  const def = lotDef(lotId);
  const lot = state.lots[lotId];
  const zone = def && zoneById(def.zoneId);
  if (!def || !lot || !zone) return { ok: false, reason: 'Unknown lot.' };
  if (lot.owned) return { ok: false, reason: 'You already own it.' };
  if (def.owner === 'market') return { ok: false, reason: 'The owner will sell. No meeting required.' };
  const live = state.zones[def.zoneId];
  if (!live || !live.unlocked) return { ok: false, reason: 'Unlock the zone first.' };
  const rival = def.owner === 'rival';
  let cost = rival ? 480 : 180;
  if (rival && live.control < 30) cost *= 2;
  const paid = pay(state, { kind: 'city' }, cost);
  if (!paid.ok) return paid;
  lot.access = 'negotiated';
  lot.priceMult = 0.8;
  return { ok: true, cost, priceMult: lot.priceMult };
}

export function intimidate(state, lotId, spendDirty = 0) {
  const def = lotDef(lotId);
  const lot = state.lots[lotId];
  const zone = def && zoneById(def.zoneId);
  if (!def || !lot || !zone) return { ok: false, reason: 'Unknown lot.' };
  if (lot.owned) return { ok: false, reason: 'You already own it.' };
  const live = state.zones[def.zoneId];
  if (!live || !live.unlocked) return { ok: false, reason: 'Unlock the zone first.' };
  const extra = Math.max(0, Math.floor(Number(spendDirty) || 0));
  const fee = 120 + extra;
  if (state.dirtyCash < fee) return { ok: false, reason: `Need $${fee - Math.floor(state.dirtyCash)} more Dirty Cash.` };
  state.dirtyCash -= fee;
  const need = def.owner === 'rival' ? 8 : 3;
  const power = zonePressure(state, def.zoneId) + Math.floor(extra / 150);
  if (power < need) {
    live.heat = Math.min(100, (Number(live.heat) || 0) + 8);
    return { ok: false, reason: 'They laughed the crew off the lot.', heat: live.heat };
  }
  lot.access = 'intimidated';
  lot.priceMult = 0.65;
  live.heat = Math.min(100, (Number(live.heat) || 0) + 6);
  return { ok: true, priceMult: lot.priceMult };
}

function mustAccess(lot, def) {
  if (def.owner === 'market' || lot.access === 'negotiated' || lot.access === 'intimidated') return null;
  if (def.owner === 'player') return null;
  return { ok: false, reason: 'Talk to the owner, or lean on them, before you buy.' };
}

export function buyAndConvert(state, lotId, role) {
  const def = lotDef(lotId);
  const lot = state.lots[lotId];
  const zone = def && zoneById(def.zoneId);
  const live = def && state.zones[def.zoneId];
  if (!def || !lot || !zone || !live) return { ok: false, reason: 'Unknown lot.' };
  if (!live.unlocked) return { ok: false, reason: 'Unlock the zone first.' };
  if (def.kind !== 'standing') return { ok: false, reason: 'This is an open plot. Build on it.' };
  if (lot.owned && lot.phase === 'operating' && lot.role) return { ok: false, reason: 'Already converted.' };
  const blocked = mustAccess(lot, def);
  if (blocked) return blocked;
  const mods = conversionMods(def.propertyType, role);
  if (!mods.allowed) return { ok: false, reason: mods.note };
  const price = Math.round(quote(state, def, 'buy') * (lot.priceMult || 1));
  const paid = pay(state, zone, price);
  if (!paid.ok) return paid;
  const bonus = def.bonus || {};
  lot.owned = true;
  lot.owner = 'player';
  lot.phase = 'operating';
  lot.role = role;
  lot.propertyType = def.propertyType;
  lot.level = bonus.level || 1;
  lot.constructLeft = 0;
  lot.demolishLeft = 0;
  lot.progress = 0;
  lot.buildingId = null;
  return { ok: true, price, role, fit: mods.fit, instant: true, bonus };
}

export function buyLot(state, lotId) {
  const def = lotDef(lotId);
  const lot = state.lots[lotId];
  const zone = def && zoneById(def.zoneId);
  const live = def && state.zones[def.zoneId];
  if (!def || !lot || !zone || !live) return { ok: false, reason: 'Unknown lot.' };
  if (!live.unlocked) return { ok: false, reason: 'Unlock the zone first.' };
  if (def.kind !== 'standing') return { ok: false, reason: 'Open plots are claimed by building, not by a land sale.' };
  if (lot.owned) return { ok: false, reason: 'You already hold the deed.' };
  const blocked = mustAccess(lot, def);
  if (blocked) return blocked;
  const price = Math.round(quote(state, def, 'lot') * (lot.priceMult || 1));
  const paid = pay(state, zone, price);
  if (!paid.ok) return paid;
  lot.owned = true;
  lot.owner = 'player';
  lot.phase = 'encumbered';
  lot.role = null;
  lot.buildingId = null;
  return { ok: true, price };
}

export function startDemolish(state, lotId) {
  const def = lotDef(lotId);
  const lot = state.lots[lotId];
  if (!def || !lot) return { ok: false, reason: 'Unknown lot.' };
  if (!lot.owned || lot.phase !== 'encumbered') {
    return { ok: false, reason: 'Buy the lot before you tear the building down.' };
  }
  if (state.dirtyCash < def.demolishCost) {
    return { ok: false, reason: `Demolition needs $${def.demolishCost} Dirty Cash.` };
  }
  state.dirtyCash -= def.demolishCost;
  lot.phase = 'demolishing';
  lot.demolishLeft = def.demolishSeconds;
  lot.role = null;
  lot.buildingId = null;
  return { ok: true, seconds: def.demolishSeconds, cost: def.demolishCost };
}

export function buildSeconds(def, buildingId, starterSlot) {
  if (starterSlot) return 3;
  const need = BUILDING_SIZE[buildingId] || 'small';
  const base = need === 'large' ? 12 : need === 'medium' ? 8 : 5;
  return def && def.kind === 'standing' ? Math.round(base * 1.15) : base;
}

export function buildOnPlot(state, lotId, buildingId) {
  const def = lotDef(lotId);
  const lot = state.lots[lotId];
  const zone = def && zoneById(def.zoneId);
  const live = def && state.zones[def.zoneId];
  const building = BUILDINGS[buildingId];
  if (!def || !lot || !zone || !live || !building) return { ok: false, reason: 'Unknown lot or building.' };
  if (!live.unlocked) return { ok: false, reason: 'Unlock the zone first.' };
  if (zone.kind === 'city') return { ok: false, reason: 'In the city, buy the building or buy the lot and clear it.' };
  if (def.kind !== 'open') return { ok: false, reason: 'This lot already has a building.' };
  if (lot.phase === 'operating' || lot.phase === 'building') return { ok: false, reason: 'Something is already on this plot.' };
  if (!buildingFits(def.size, buildingId)) return { ok: false, reason: `${building.shortName} does not fit a ${def.size} lot.` };
  const dirty = Math.round(building.buildCostDirty * 0.85);
  const clean = Math.round(building.buildCostClean * 0.85);
  if (state.dirtyCash < dirty) return { ok: false, reason: `Need $${dirty - Math.floor(state.dirtyCash)} more Dirty Cash.` };
  if (state.cleanCash < clean) return { ok: false, reason: `Need $${clean - Math.floor(state.cleanCash)} more Clean Cash.` };
  state.dirtyCash -= dirty;
  state.cleanCash -= clean;
  const seconds = buildSeconds(def, buildingId, false);
  lot.owned = true;
  lot.owner = 'player';
  lot.phase = 'building';
  lot.buildingId = buildingId;
  lot.role = roleForBuilding(buildingId);
  lot.constructLeft = seconds;
  lot.pendingBuildingId = buildingId;
  return { ok: true, seconds, dirty, clean };
}

export function buildNew(state, lotId, buildingId) {
  const def = lotDef(lotId);
  const lot = state.lots[lotId];
  const building = BUILDINGS[buildingId];
  if (!def || !lot || !building) return { ok: false, reason: 'Unknown lot or building.' };
  if (lot.phase !== 'cleared') return { ok: false, reason: 'Demolish the old building first.' };
  if (!buildingFits(def.size, buildingId)) return { ok: false, reason: `${building.shortName} does not fit a ${def.size} lot.` };
  if (state.dirtyCash < building.buildCostDirty) return { ok: false, reason: `Need $${building.buildCostDirty} Dirty Cash.` };
  if (state.cleanCash < building.buildCostClean) return { ok: false, reason: `Need $${building.buildCostClean} Clean Cash.` };
  state.dirtyCash -= building.buildCostDirty;
  state.cleanCash -= building.buildCostClean;
  const seconds = buildSeconds(def, buildingId, false);
  lot.phase = 'building';
  lot.buildingId = buildingId;
  lot.role = roleForBuilding(buildingId);
  lot.propertyType = null;
  lot.constructLeft = seconds;
  lot.pendingBuildingId = buildingId;
  return { ok: true, seconds };
}

export function tickLots(state, dt) {
  for (const lot of Object.values(state.lots || {})) {
    if (lot.phase === 'demolishing') {
      lot.demolishLeft -= dt;
      if (lot.demolishLeft <= 0) {
        lot.demolishLeft = 0;
        lot.phase = 'cleared';
        lot.propertyType = null;
        lot.role = null;
        lot.buildingId = null;
      }
      continue;
    }
    if (lot.phase === 'building') {
      lot.constructLeft -= dt;
      if (lot.constructLeft <= 0) {
        lot.constructLeft = 0;
        lot.phase = 'operating';
        lot.buildingId = lot.pendingBuildingId || lot.buildingId;
        lot.pendingBuildingId = null;
      }
      continue;
    }
    if (lot.phase === 'operating' && !lot.slotId) tickOperation(state, lot, dt);
  }
}

function bufferCount(buffer) {
  let sum = 0;
  for (const value of Object.values(buffer || {})) sum += value || 0;
  return sum;
}

function takeRural(state, goodId, qty) {
  let left = qty;
  const piles = [];
  for (const slot of Object.values(state.slots || {})) {
    piles.push(slot.outputBuffer, slot.inputBuffer);
  }
  for (const lot of Object.values(state.lots || {})) {
    if (lot.slotId) continue;
    const def = lotDef(lot.id);
    const zone = def && zoneById(def.zoneId);
    if (!zone || zone.kind !== 'rural') continue;
    piles.push(lot.outputBuffer);
  }
  let taken = 0;
  for (const pile of piles) {
    if (!pile || left <= 0) continue;
    const have = pile[goodId] || 0;
    if (have <= 0) continue;
    const grab = Math.min(have, left);
    pile[goodId] = have - grab;
    left -= grab;
    taken += grab;
  }
  return taken;
}

function tickOperation(state, lot, dt) {
  const def = lotDef(lot.id);
  if (!def) return;
  const type = PROPERTY_TYPES[lot.propertyType] || null;
  const mods = type ? conversionMods(lot.propertyType, lot.role) : { speed: 1, capacity: 1, heat: 1, suspicion: 0.1 };
  const bonus = def.bonus || {};
  const live = state.zones[lot.zoneId];
  if (live && type) {
    const heat = (type.upkeep ? 0.02 : 0.01) * mods.heat * (bonus.heatMult || 1) * dt;
    live.heat = Math.max(0, Math.min(100, (Number(live.heat) || 0) + heat));
  }
  if (type && state.dirtyCash > 0) {
    state.dirtyCash = Math.max(0, state.dirtyCash - (type.upkeep * dt) / 20);
  }
  const speed = (mods.speed || 1) * (bonus.growMult || 1);
  if (lot.role === 'launder' && state.dirtyCash >= 20) {
    lot.progress += (dt * speed) / 5;
    if (lot.progress >= 1) {
      lot.progress = 0;
      const cap = Math.round((type ? type.capacity : 12) * (mods.capacity || 1));
      const dirty = Math.min(Math.floor(state.dirtyCash), cap * 8);
      const clean = Math.round(dirty * 0.9 * (mods.fit === 'boost' ? 1.1 : mods.fit === 'limit' ? 0.8 : 1));
      state.dirtyCash -= dirty;
      state.cleanCash += clean;
      state.totalCleanEarned += clean;
    }
  } else if (lot.role === 'distribution') {
    lot.progress += (dt * speed) / 6;
    if (lot.progress >= 1) {
      lot.progress = 0;
      const goods = ['cured_pack', 'smuggled_coffee', 'refined_extract', 'coffee_cherry', 'raw_herb'];
      for (const goodId of goods) {
        const taken = takeRural(state, goodId, 2);
        if (taken <= 0) continue;
        lot.inputBuffer[goodId] = (lot.inputBuffer[goodId] || 0) + taken;
        break;
      }
      const sell = ['cured_pack', 'smuggled_coffee', 'refined_extract', 'coffee_cherry', 'raw_herb'];
      for (const goodId of sell) {
        const have = lot.inputBuffer[goodId] || 0;
        if (have <= 0) continue;
        lot.inputBuffer[goodId] = 0;
        const prices = { cured_pack: 90, smuggled_coffee: 160, refined_extract: 220, coffee_cherry: 30, raw_herb: 20 };
        const earned = have * (prices[goodId] || 25);
        state.dirtyCash += earned;
        state.totalDirtyEarned += earned;
        state.totalExportedUnits += have;
        break;
      }
    }
  } else if (lot.role === 'produce') {
    const cap = Math.round((type ? type.capacity : 10) * (mods.capacity || 1) + (bonus.storage || 0));
    if (bufferCount(lot.outputBuffer) < cap) {
      lot.progress += (dt * speed) / 6;
      if (lot.progress >= 1) {
        lot.progress = 0;
        lot.outputBuffer.raw_herb = Math.min(cap, (lot.outputBuffer.raw_herb || 0) + 2);
      }
    }
  } else if (lot.role === 'stash' || lot.role === 'warehouse') {
    lot.capacity = Math.round((type ? type.capacity : 12) * (mods.capacity || 1) + (bonus.storage || 0));
  }
}

