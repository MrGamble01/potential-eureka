// UI hooks for the scene and HUD agents.
//
// Read sim.gameplayView(). Do not reimplement prices, fits, gates,
// betrayal, or mission progress. Call the methods. Every mutating
// method returns { ok, reason }.
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
//   sim.hireLieutenant(ltId)
//   sim.assignLieutenant(ltId, zoneOrRegionId)
//   sim.payLieutenantBonus(ltId)
//   sim.resolveEvent(choiceIndex)
//   sim.startSandbox(difficultyId)   // casual | standard | brutal
//   sim.setDifficulty(difficultyId)  // sandbox only
//   sim.recommendedSlot()
//   sim.observeFrame(dt)
//
// gameplayView() fields the scene can render without reading sim.state:
//
//   campaign.status       'playing' | 'failed' | 'complete'
//   campaign.failReason   sentence, or null
//   campaign.failId       indictment | valley_seized | betrayed | broke
//   campaign.act / actInfo
//   campaign.mission      current mission, with speaker id, beat, rewards
//   campaign.progress     { current, target, pct, done, progressText }
//   campaign.beat         the line to show under the objective
//   campaign.speaker      { id, name, title, side } or null
//   campaign.dea          { agent, case }  case is 0–100; 100 is the indictment
//   campaign.cast         named people (crew, Ruiz, Garza, Reina)
//   campaign.fails        the four fail states, with meter/limit when they have one
//   campaign.chapters     act 1 valley, act 2 rural expansion, act 3 Puerto Sol
//   card                  open event, or null. choices[].effect is for the sim.
//                         Pass the choice index to resolveEvent. speaker is CAST.
//   lieutenants[]         hired, loyalty, zoneId, regionId, traits, betrayed,
//                         betrayalRisk (0–100; 100 walks on the next day)
//   routes.boats          successful boat runs (the Act II objective)
//
// Failing the campaign sets status and does not stop the clock.
// Sandbox never fails. assignLieutenant accepts a zone id or a region id.
//
// presentEvent(audio, juice, evt, sim) and attachFeel(sim, audio, getJuice, getFrame)
// stay the map's sound and juice hooks. They are not campaign state.
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
import { ACTS, BUILD_SLOTS, CAST, FAIL_STATES, LIEUTENANTS } from '../data/missions.js';
import { LOT_POS } from '../map-layout.js';
import { RESEARCH } from '../data/research.js';
import { PROPERTY_TYPES, ROLES, buildingFits, lotDef } from '../data/lots.js';
import { conversionMods, quote } from './lots.js';
import { unlockBlockers } from './zones.js';
import { chainReport } from './chains.js';
import { betrayalRisk, loyaltyScale } from './lieutenants.js';
import { zoneAnchor, crossedControl } from '../audio/zones.js';

function castMember(id) {
  return CAST.find((person) => person.id === id) || null;
}

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
      lost: state.routesLost || 0,
      boats: state.boatRuns || 0
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
        role: lt.role,
        hired: !!(row && row.hired),
        betrayed: !!(row && row.betrayed),
        loyalty: row ? Math.round(row.loyalty) : lt.loyalty,
        scale: row && row.hired ? loyaltyScale(row.loyalty) : 0,
        betrayalRisk: betrayalRisk(lt, row),
        regionId: row ? row.regionId : null,
        zoneId: row ? (row.zoneId || row.regionId || null) : null,
        traits: lt.traits || [],
        perk: lt.perkName,
        hireCost: lt.hireCostClean
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
    campaign: campaignSnapshot(sim, state),
    card: openCard(state),
    heatHandled: state.heatHandled || 0
  };
}

function pointFor(evt, sim) {
  const id = evt && (evt.lotId || evt.slotId);
  if (id) {
    if (LOT_POS[id]) return { x: LOT_POS[id].x, y: LOT_POS[id].y };
    const slot = BUILD_SLOTS.find((row) => row.id === id);
    if (slot) return { x: slot.x, y: slot.y };
    const lot = sim && sim.state && sim.state.lots ? sim.state.lots[id] : null;
    const def = lotDef(id);
    const zoneId = (lot && lot.zoneId) || (def && def.zoneId) || evt.zoneId;
    const anchor = zoneAnchor(zoneId);
    return { x: anchor.x, y: anchor.y };
  }
  const anchor = zoneAnchor(evt && evt.zoneId);
  return { x: anchor.x, y: anchor.y };
}

function anyRaid(sim) {
  if (!sim || !sim.state) return false;
  const regions = sim.state.regions || {};
  const zones = sim.state.zones || {};
  return Object.values(regions).some((row) => row && row.raidActive)
    || Object.values(zones).some((row) => row && row.raidActive);
}

export function presentEvent(audio, juice, evt, sim) {
  if (!evt || !evt.type) return;
  if (audio && audio.cue) audio.cue(evt);
  if (audio && audio.setTension) audio.setTension(anyRaid(sim));
  if (!juice) return;
  if (evt.type === 'zone_unlocked') {
    const zone = zoneById(evt.zoneId);
    juice.unlockSweep(pointFor(evt, sim), zone ? zone.name : 'Zone open');
  } else if (evt.type === 'demolish_started') {
    juice.demolishDust(pointFor(evt, sim));
  } else if (evt.type === 'control_gained') {
    juice.controlFlash(pointFor(evt, sim));
  }
}

export function attachFeel(sim, audio, getJuice, getFrame) {
  if (!sim || sim._feelAttached) return;
  sim._feelAttached = true;
  const prevControl = {};
  const zones = sim.state && sim.state.zones ? sim.state.zones : {};
  for (const [id, zone] of Object.entries(zones)) prevControl[id] = zone.control;

  const originalObserve = sim.observeFrame.bind(sim);
  sim.observeFrame = function observeFrame(dt) {
    const result = originalObserve(dt);
    const frame = getFrame ? getFrame() : null;
    if (audio && frame && audio.followCamera) audio.followCamera(frame.x, frame.y, !!frame.night);
    let building = false;
    let demolishing = false;
    const lots = sim.state && sim.state.lots ? Object.values(sim.state.lots) : [];
    for (const lot of lots) {
      if (lot.phase === 'building') building = true;
      if (lot.phase === 'demolishing') demolishing = true;
    }
    if (audio && audio.setWork) audio.setWork(building, demolishing);
    const juice = getJuice ? getJuice() : null;
    const live = sim.state && sim.state.zones ? sim.state.zones : {};
    for (const [id, zone] of Object.entries(live)) {
      if (crossedControl(prevControl[id], zone.control)) {
        presentEvent(audio, juice, { type: 'control_gained', zoneId: id }, sim);
      }
      prevControl[id] = zone.control;
    }
    return result;
  };

  const originalNegotiate = sim.negotiate.bind(sim);
  sim.negotiate = function negotiate(lotId) {
    const result = originalNegotiate(lotId);
    const juice = getJuice ? getJuice() : null;
    presentEvent(audio, juice, { type: result && result.ok ? 'negotiate_ok' : 'negotiate_fail', lotId }, sim);
    return result;
  };

  const originalIntimidate = sim.intimidate.bind(sim);
  sim.intimidate = function intimidate(lotId, spendDirty) {
    const result = originalIntimidate(lotId, spendDirty);
    const juice = getJuice ? getJuice() : null;
    presentEvent(audio, juice, { type: result && result.ok ? 'intimidate_ok' : 'intimidate_fail', lotId }, sim);
    return result;
  };
}

function openCard(state) {
  const card = state.event;
  if (!card) return null;
  return {
    id: card.id,
    title: card.title,
    body: card.body,
    speaker: castMember(card.speaker),
    choices: (card.choices || []).map((choice) => ({ label: choice.label, effect: choice.effect }))
  };
}

function campaignSnapshot(sim, state) {
  const mission = sim.getCurrentMission ? sim.getCurrentMission() : null;
  const rows = Object.values(state.lieutenants || {});
  const betrayed = rows.filter((row) => row.betrayed).length;
  return {
    status: state.campaignStatus || 'playing',
    failReason: state.failReason || null,
    failId: state.failId || null,
    act: state.act,
    actInfo: ACTS[state.act] || null,
    mission,
    progress: mission && sim.getMissionProgress ? sim.getMissionProgress(mission) : null,
    beat: mission ? mission.beat : null,
    speaker: mission ? castMember(mission.speaker) : null,
    dea: {
      agent: state.dea && state.dea.agent ? state.dea.agent : 'Helen Ruiz',
      case: state.dea ? Math.max(0, Math.min(100, Math.round(state.dea.case || 0))) : 0
    },
    cast: CAST,
    fails: FAIL_STATES.map((fail) => ({
      id: fail.id,
      title: fail.title,
      text: fail.text,
      speaker: castMember(fail.speaker),
      active: state.failId === fail.id,
      meter: fail.id === 'indictment'
        ? (state.dea ? state.dea.case : 0)
        : fail.id === 'valley_seized'
          ? (state.valleySeizures || 0)
          : fail.id === 'betrayed'
            ? betrayed
            : null,
      limit: fail.id === 'indictment' ? 100 : fail.id === 'valley_seized' ? 5 : fail.id === 'betrayed' ? 1 : null
    })),
    chapters: chapters(state)
  };
}

function chapters(state) {
  const done = new Set(state.completedMissions || []);
  return [
    { id: 'export', act: 1, title: 'First river export', done: done.has('m1_first_export') },
    { id: 'heat', act: 1, title: 'Face Ruiz and the heat', done: done.has('m1_heat') },
    { id: 'front', act: 1, title: 'Open a legal front', done: done.has('m2_first_front') },
    { id: 'delta', act: 2, title: 'Open Boca del Río', done: done.has('m2_open_delta') },
    { id: 'work', act: 2, title: 'A rural site outside the valley', done: done.has('m2_delta_work') },
    { id: 'country', act: 2, title: 'A second stretch of country', done: done.has('m2_second_country') },
    { id: 'crew', act: 2, title: 'A lieutenant on the new ground', done: done.has('m2_second_lieutenant') },
    { id: 'boat', act: 2, title: 'Land a boat', done: done.has('m2_boat_run') },
    { id: 'barrio', act: 3, title: 'Take Barrio Sol', done: done.has('m3_barrio') },
    { id: 'docks', act: 3, title: 'Take the Docks', done: done.has('m3_docks') },
    { id: 'downtown', act: 3, title: 'Take Downtown', done: done.has('m3_downtown') },
    { id: 'beach', act: 3, title: 'Take the Beach', done: done.has('m3_beach') },
    { id: 'hold', act: 3, title: 'Hold Barrio Sol', done: done.has('m3_hold_barrio') },
    { id: 'hills', act: 3, title: 'Take the Hills', done: done.has('m3_hills') },
    { id: 'city', act: 3, title: 'Puerto Sol, neighborhood by neighborhood', done: done.has('m3_city') }
  ];
}
