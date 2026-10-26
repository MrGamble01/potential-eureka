// Planned truck, boat, and plane runs. Risk is resolved when the clock hits zero.

import { GOODS } from '../data/goods.js';
import { VEHICLES } from '../data/routes.js';
import { lotDef } from '../data/lots.js';
import { zoneById } from '../data/zones.js';
import { coreMode, riskLive } from '../data/config.js';

function source(state, id) {
  if (state.slots && state.slots[id]) return { kind: 'slot', row: state.slots[id] };
  if (state.lots && state.lots[id]) return { kind: 'lot', row: state.lots[id] };
  return null;
}

function pile(row) {
  const out = row.outputBuffer || {};
  const inn = row.inputBuffer || {};
  return { out, inn };
}

export function routeMods(state) {
  let risk = 0;
  let boatCap = 0;
  let planeCap = 0;
  const research = state.research || {};
  if (research.decoys) risk -= 0.06;
  if (research.hulls) boatCap += 4;
  if (research.night_ops) {
    risk -= 0.05;
    planeCap += 2;
  }
  const seenZones = new Set();
  for (const lot of Object.values(state.lots || {})) {
    if (!lot.owned || lot.phase !== 'operating') continue;
    const def = lotDef(lot.id);
    const bonus = (def && def.bonus) || {};
    const zone = def && zoneById(def.zoneId);
    if (lot.role === 'export' || lot.buildingId === 'river_pier' || lot.propertyType === 'river_dock') {
      boatCap += bonus.boatCapacity || 0;
      risk += bonus.boatRisk || 0;
    }
    if (lot.buildingId === 'aerodrome' || lot.propertyType === 'airstrip' || lot.propertyType === 'hangar') {
      planeCap += bonus.planeCapacity || 0;
      risk += bonus.planeRisk || 0;
    }
    if (zone && !seenZones.has(zone.id) && state.zones && state.zones[zone.id] && state.zones[zone.id].unlocked) {
      seenZones.add(zone.id);
      const zoneBonus = zone.bonus || {};
      boatCap += zoneBonus.boatCapacity || 0;
      planeCap += zoneBonus.planeCapacity || 0;
      risk += zoneBonus.boatRisk || 0;
      risk += zoneBonus.planeRisk || 0;
    }
  }
  return { risk, boatCap, planeCap };
}

function hasPier(state) {
  for (const slot of Object.values(state.slots || {})) {
    if (slot.buildingId === 'river_pier' && !slot.raidLocked && !(slot.constructLeft > 0)) return true;
  }
  for (const lot of Object.values(state.lots || {})) {
    if (lot.phase !== 'operating') continue;
    if (lot.buildingId === 'river_pier' || lot.role === 'export' || lot.propertyType === 'river_dock') return true;
  }
  return false;
}

function hasStrip(state) {
  for (const slot of Object.values(state.slots || {})) {
    if (slot.buildingId === 'aerodrome' && !slot.raidLocked) return true;
  }
  for (const lot of Object.values(state.lots || {})) {
    if (lot.phase !== 'operating') continue;
    if (lot.buildingId === 'aerodrome' || lot.propertyType === 'airstrip' || lot.propertyType === 'hangar') return true;
  }
  return false;
}

export function planRoute(state, request) {
  const vehicle = VEHICLES[request && request.vehicleId];
  const from = source(state, request && request.fromId);
  const good = GOODS[request && request.goodId];
  if (!vehicle || !from || !good) return { ok: false, reason: 'Name a vehicle, a lot, and a good.' };
  if (vehicle.needs === 'pier' && !hasPier(state)) return { ok: false, reason: 'Boats need a pier or a dock you operate.' };
  if (vehicle.needs === 'strip' && !hasStrip(state)) return { ok: false, reason: 'Planes need an airstrip, hangar, or aerodrome.' };
  const mods = routeMods(state);
  const cap = vehicle.capacity + (vehicle.id === 'boat' ? mods.boatCap : vehicle.id === 'plane' ? mods.planeCap : 0);
  const buffers = pile(from.row);
  const have = (buffers.out[good.id] || 0) + (buffers.inn[good.id] || 0);
  const qty = Math.min(cap, Math.floor(request.qty || cap), have);
  if (qty < 1) return { ok: false, reason: 'Nothing on that lot to move.' };
  let left = qty;
  for (const buf of [buffers.out, buffers.inn]) {
    const n = buf[good.id] || 0;
    const take = Math.min(n, left);
    buf[good.id] = n - take;
    left -= take;
  }
  const risk = Math.max(0.02, Math.min(0.85, vehicle.risk + mods.risk));
  const shipment = {
    id: state.nextTruckId || 1,
    vehicleId: vehicle.id,
    fromId: request.fromId,
    goodId: good.id,
    qty,
    left: vehicle.seconds * (state.research && state.research.night_ops && vehicle.id === 'plane' ? 0.85 : 1),
    risk,
    pay: vehicle.pay,
    heat: vehicle.heat
  };
  state.nextTruckId = (state.nextTruckId || 1) + 1;
  state.shipments = state.shipments || [];
  state.shipments.push(shipment);
  return { ok: true, shipment };
}

export function tickShipments(state, dt) {
  const stay = [];
  let arrived = null;
  for (const shipment of state.shipments || []) {
    shipment.left -= dt;
    if (shipment.left > 0) {
      stay.push(shipment);
      continue;
    }
    const luck = Number.isFinite(state.routeLuck) ? state.routeLuck : Math.random();
    const caught = riskLive(state) && luck < shipment.risk;
    const good = GOODS[shipment.goodId];
    const zoneId = (state.slots[shipment.fromId] && state.slots[shipment.fromId].regionId)
      || (state.lots[shipment.fromId] && state.lots[shipment.fromId].zoneId)
      || 'rio_plata';
    const reg = state.regions[zoneId] || state.zones[zoneId];
    if (caught) {
      state.routesLost = (state.routesLost || 0) + 1;
      if (!coreMode() && reg) reg.heat = Math.min(100, (Number(reg.heat) || 0) + shipment.heat);
      if (!state.dea) state.dea = { agent: 'Helen Ruiz', case: 0 };
      state.dea.case = Math.min(100, (Number(state.dea.case) || 0) + 4);
      arrived = { ok: false, caught: true, shipment };
    } else {
      const mood = state.priceMood || 1;
      const seal = state.research && state.research.seal ? 1.2 : 1;
      const earned = Math.round(shipment.qty * (good ? good.unitValueDirty : 40) * shipment.pay * mood * seal);
      const clean = Math.round(shipment.qty * (good ? good.unitValueClean : 0) * shipment.pay * mood);
      state.dirtyCash += earned;
      state.cleanCash += clean;
      state.totalDirtyEarned += earned;
      state.totalCleanEarned += clean;
      state.totalExportedUnits += shipment.qty;
      state.routesCompleted = (state.routesCompleted || 0) + 1;
      if (shipment.vehicleId === 'boat') state.boatRuns = (state.boatRuns || 0) + 1;
      state.reputation = (state.reputation || 0) + 1;
      if (!coreMode() && reg) reg.heat = Math.min(100, (Number(reg.heat) || 0) + shipment.heat * 0.45);
      arrived = { ok: true, earned, clean, shipment };
    }
  }
  state.shipments = stay;
  return arrived;
}
