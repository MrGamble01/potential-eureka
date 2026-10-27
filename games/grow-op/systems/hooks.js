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
//   sim.recommendedLotId()
//   sim.observeFrame(dt)
//
// gameplayView() fields the scene can render without reading sim.state:
//
//   campaign.status       'playing' | 'failed' | 'complete'
//   campaign.failReason   sentence, or null
//   campaign.failId       indictment | valley_seized | betrayed | broke
//   campaign.act / actInfo
//   campaign.goals.main   the one current mission, or null when the campaign is done
//   campaign.goals.side   at most one threat: cool a hot district, or pay a shaky
//                         lieutenant. Null when nothing is pressing.
//                         Omitted entirely while CORE_MODE is on.
//   campaign.mission      same mission as goals.main, with speaker id, beat, rewards
//   campaign.progress     { current, target, pct, done, progressText }
//   campaign.beat         the line to show under the objective
//   campaign.speaker      { id, name, title, side } or null
//   campaign.dea          { agent, case }  case is 0–100; 100 is the indictment
//   campaign.cast         named people (crew, Ruiz, Garza, Reina)
//   campaign.fails        the four fail states, with meter/limit when they have one
//   Show goals.main and goals.side. Do not list every mission at once.
//   card                  the one open event, or null. The next card waits
//                         three minutes after this one closes. choices[].effect
//                         is for the sim. Pass the choice index to resolveEvent.
//   lieutenants[]         hired, loyalty, zoneId, regionId, traits, betrayed,
//                         betrayalRisk (0–100; 100 walks on the next day)
//   routes.boats          successful boat runs (the Act II objective)
//   buildings[]           catalog card for every building: thumbnailKey, roleIcon,
//                         output, heat, storage
//   lots[].builds         building ids that fit the lot (unchanged)
//   lots[].buildCards     the same ids, with thumbnailKey, roleIcon, output, heat, storage
//   lots[].recommended    true on the one lot the current goal points at
//
//   thumbnailKey is a stable art id (bldg_<buildingId>). roleIcon is the
//   category SVG from data/icons.js. output is units, export slots, or
//   dirty cash washed per cycle. heat is heatRate (negative cools).
//   storage is the building's storage cap.
//
// CORE_MODE (data/config.js, default on) is the supply-chain game.
// gameplayView() then sets coreMode true and omits zone heat, patrol,
// raidActive, and hidden, plus lieutenants, card, heatHandled, and
// goals.side. lossWarning is null. Flag off sets coreMode false and
// restores those fields. lossWarning is the sentence shown for the
// twenty seconds after Act I, before anything can be seized.
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
import { iconForCategory } from '../data/icons.js';
import { DIFFICULTIES, ZONES, zoneById } from '../data/zones.js';
import { VEHICLE_LIST } from '../data/routes.js';
import { RIVALS } from '../data/rivals.js';
import { ACTS, BUILD_SLOTS, CAST, FAIL_STATES, LIEUTENANTS } from '../data/missions.js';
import { coreMode } from '../data/config.js';
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

function buildingCard(id) {
  const def = BUILDINGS[id];
  if (!def) return null;
  const produced = Object.values(def.outputs || {}).reduce((sum, qty) => sum + qty, 0);
  let output = produced;
  if (def.role === 'launderer') output = def.launderPerCycle || 0;
  else if (def.role === 'smuggling') output = def.exportCapPerCycle || 0;
  return {
    id,
    thumbnailKey: `bldg_${id}`,
    roleIcon: iconForCategory(def.category),
    output,
    heat: def.heatRate || 0,
    storage: def.storageCap || 0
  };
}

function sideGoal(state) {
  const places = [...Object.values(state.regions || {}), ...Object.values(state.zones || {})];
  const hot = places.find((row) => row && (row.raidActive || row.patrol || (row.heat || 0) >= 40));
  if (hot) {
    return {
      id: 'cool',
      title: 'Cool the district',
      detail: hot.raidActive ? 'A raid is on the block.' : hot.patrol ? 'A patrol is in the district.' : 'Heat is climbing.',
      place: hot.id
    };
  }
  const crew = Object.entries(state.lieutenants || {}).find(([, row]) => row && row.hired && !row.betrayed && row.loyalty < 40);
  if (crew) {
    return {
      id: 'pay',
      title: 'Pay the crew',
      detail: 'A lieutenant is close to walking.',
      place: crew[0]
    };
  }
  return null;
}

function lotActions(state, def, lot) {
  const actions = [];
  if (!lot || !def) return actions;
  const zone = state.zones[def.zoneId];
  if (!zone || !zone.unlocked) return actions;
  if (def.kind === 'open' && lot.phase === 'wild') actions.push('buildOnPlot');
  if (coreMode() && def.kind === 'standing' && !lot.owned) {
    actions.push('buyAndConvert', 'buyLot');
    return actions;
  }
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
  const recommendId = sim.recommendedLotId ? sim.recommendedLotId() : null;
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
      buildCards: builds.map(buildingCard).filter(Boolean),
      recommended: lot.id === recommendId,
      actions: lotActions(state, def, lot)
    };
  });
  const view = {
    coreMode: coreMode(),
    mapOpen: !!state.mapOpen,
    reputation: state.reputation || 0,
    difficulty: state.difficulty || 'standard',
    difficulties: Object.values(DIFFICULTIES),
    act: state.act,
    zones,
    lots,
    buildings: Object.keys(BUILDINGS).map(buildingCard),
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
  if (coreMode()) {
    for (const zone of view.zones) {
      delete zone.heat;
      delete zone.patrol;
      delete zone.raidActive;
      delete zone.hidden;
    }
    delete view.lieutenants;
    delete view.card;
    delete view.heatHandled;
    if (view.campaign && view.campaign.goals) view.campaign.goals = { main: view.campaign.goals.main };
    view.lossWarning = null;
  } else {
    view.lossWarning = state.lossWarning || null;
  }
  return view;
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
    goals: {
      main: mission ? {
        id: mission.id,
        act: mission.act,
        title: mission.title,
        desc: mission.desc,
        speaker: mission.speaker,
        progress: sim.getMissionProgress ? sim.getMissionProgress(mission) : null
      } : null,
      side: sideGoal(state)
    },
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
    }))
  };
}
