// UI hooks for the scene and HUD agents.
//
// Read sim.gameplayView(). Do not reimplement prices, fits, or gates.
// Call the methods. Every one returns { ok, reason }.
//
//   sim.unlockZone(zoneId)
//   sim.buyAndConvert(lotId, role)
//   sim.buyLot(lotId)
//   sim.startDemolish(lotId)
//   sim.buildNew(lotId, buildingId)
//   sim.buildOnPlot(lotId, buildingId)
//   sim.negotiate(lotId)
//   sim.intimidate(lotId, spendDirty)
//   sim.planRoute({ fromId, vehicleId, goodId, qty })
//   sim.hideFromPatrol(regionOrZoneId)
//   sim.bribeRegionAuthorities(regionId)
//   sim.startSandbox(difficultyId)   // casual | standard | brutal
//   sim.setDifficulty(difficultyId)  // sandbox only
//   sim.recommendedSlot()
//   sim.observeFrame(dt)
//
// Lots with slotId are the plots already on the map. Lots without a
// slotId are rural prizes and Puerto Sol properties waiting for a pin.
// Occupied lots: buyAndConvert (fast, type fit) or buyLot + startDemolish
// + buildNew (slower, any building the size allows). Open rural plots:
// buildOnPlot, cheaper, with build time. City zones have no open plots.

import { BUILDINGS } from '../data/buildings.js';
import { DIFFICULTIES, ZONES, zoneById } from '../data/zones.js';
import { VEHICLE_LIST } from '../data/routes.js';
import { RIVALS } from '../data/rivals.js';
import { LIEUTENANTS } from '../data/missions.js';
import { RESEARCH } from '../data/research.js';
import { PROPERTY_TYPES, ROLES, buildingFits, lotDef } from '../data/lots.js';
import { conversionMods, quote } from './lots.js';
import { unlockBlockers } from './zones.js';
import { chainReport } from './chains.js';
import { loyaltyScale } from './lieutenants.js';

function lotActions(state, def, lot) {
  const actions = [];
  if (!lot || !def) return actions;
  const zone = state.zones[def.zoneId];
  if (!zone || !zone.unlocked) return actions;
  if (def.kind === 'open' && lot.phase === 'wild') actions.push('buildOnPlot');
  if (def.kind === 'standing' && !lot.owned) {
    if (def.owner !== 'market' && lot.access === 'locked') {
      actions.push('negotiate', 'intimidate');
    }
    if (def.owner === 'market' || lot.access === 'negotiated' || lot.access === 'intimidated') {
      actions.push('buyAndConvert', 'buyLot');
    }
  }
  if (lot.phase === 'encumbered') actions.push('startDemolish');
  if (lot.phase === 'cleared') actions.push('buildNew');
  return actions;
}

export function gameplayView(sim) {
  const state = sim.state;
  const zones = ZONES.map((zone) => {
    const live = state.zones[zone.id];
    return {
      id: zone.id,
      name: zone.name,
      kind: zone.kind,
      city: zone.city,
      act: zone.act,
      starter: !!zone.starter,
      town: zone.town,
      desc: zone.desc,
      bonus: zone.bonus,
      rival: zone.rival,
      unlocked: !!(live && live.unlocked),
      heat: live ? Math.round(live.heat) : zone.baseHeat,
      control: live ? live.control : zone.baseControl,
      patrol: live && live.patrol ? live.patrol : null,
      raidActive: !!(live && live.raidActive),
      hidden: !!(live && live.hiddenUntil && state.elapsedSeconds < live.hiddenUntil),
      blockers: unlockBlockers(state, zone),
      unlock: zone.unlock
    };
  });
  const lots = (state.lots ? Object.values(state.lots) : []).map((lot) => {
    const def = lotDef(lot.id);
    const type = def && def.propertyType ? PROPERTY_TYPES[def.propertyType] : null;
    const fits = {};
    if (type) {
      for (const role of ROLES) fits[role] = conversionMods(def.propertyType, role);
    }
    const builds = Object.keys(BUILDINGS).filter((id) => def && buildingFits(def.size, id));
    return {
      id: lot.id,
      zoneId: lot.zoneId,
      slotId: lot.slotId,
      label: def ? def.label : lot.id,
      kind: lot.kind,
      size: lot.size,
      owner: lot.owner,
      access: lot.access,
      phase: lot.phase,
      role: lot.role,
      buildingId: lot.buildingId,
      propertyType: lot.propertyType,
      propertyLabel: type ? type.label : null,
      constructLeft: Math.max(0, Math.ceil(lot.constructLeft || 0)),
      demolishLeft: Math.max(0, Math.ceil(lot.demolishLeft || 0)),
      bonus: def && def.bonus ? def.bonus : null,
      buyPrice: def && def.kind === 'standing' ? Math.round(quote(state, def, 'buy') * (lot.priceMult || 1)) : 0,
      lotPrice: def && def.kind === 'standing' ? Math.round(quote(state, def, 'lot') * (lot.priceMult || 1)) : 0,
      demolishCost: def ? def.demolishCost : 0,
      fits,
      builds,
      actions: lotActions(state, def, lot)
    };
  });
  return {
    mapOpen: !!state.mapOpen,
    reputation: state.reputation || 0,
    difficulty: state.difficulty || 'standard',
    difficulties: Object.values(DIFFICULTIES),
    act: state.act,
    zones,
    lots,
    chains: chainReport(state),
    routes: {
      vehicles: VEHICLE_LIST,
      shipments: state.shipments || [],
      completed: state.routesCompleted || 0,
      lost: state.routesLost || 0
    },
    rivals: Object.values(RIVALS).map((rival) => ({
      id: rival.id,
      name: rival.name,
      threat: state.rivals && state.rivals[rival.id] ? state.rivals[rival.id].threat : rival.threatStart,
      attacks: state.rivals && state.rivals[rival.id] ? state.rivals[rival.id].attacks : 0
    })),
    lieutenants: LIEUTENANTS.map((lt) => {
      const row = state.lieutenants[lt.id];
      return {
        id: lt.id,
        name: lt.name,
        hired: !!(row && row.hired),
        loyalty: row ? row.loyalty : lt.loyalty,
        scale: row && row.hired ? loyaltyScale(row.loyalty) : 0,
        regionId: row ? row.regionId : null,
        traits: lt.traits || [],
        perk: lt.perkName
      };
    }),
    research: RESEARCH.map((node) => ({
      id: node.id,
      name: node.name,
      cost: node.cost,
      owned: !!state.research[node.id],
      locked: !!(node.requires && !state.research[node.requires]),
      requires: node.requires,
      desc: node.desc
    })),
    campaign: {
      mission: sim.getCurrentMission ? sim.getCurrentMission() : null,
      progress: sim.getCurrentMission ? sim.getMissionProgress(sim.getCurrentMission()) : null,
      chapters: chapters(state)
    },
    heatHandled: state.heatHandled || 0
  };
}

function chapters(state) {
  const rural = ['jungle_alta', 'river_delta', 'mesa_strip'].filter((id) => state.zones[id] && state.zones[id].unlocked).length;
  const cityLots = Object.values(state.lots || {}).filter((lot) => lot.owned && zoneById(lot.zoneId) && zoneById(lot.zoneId).kind === 'city').length;
  const bestControl = Math.max(0, ...Object.values(state.zones || {}).map((zone) => zone.control || 0));
  return [
    { id: 'valley', act: 1, title: 'Run farm, barn, warehouse, pier', done: state.totalExportedUnits >= 4 },
    { id: 'wash', act: 1, title: 'Launder once and face the heat', done: (state.heatHandled || 0) >= 1 && state.totalCleanEarned >= 80 },
    { id: 'rural', act: 2, title: 'Unlock another rural zone', done: rural >= 1 },
    { id: 'city', act: 2, title: 'Buy a Puerto Sol property', done: cityLots >= 1 },
    { id: 'hold', act: 3, title: 'Hold a neighborhood', done: bestControl >= 45 && cityLots >= 2 }
  ];
}
