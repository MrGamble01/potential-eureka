// Story cards. Effects are names on the card. This applies them.

import { EVENTS } from '../data/events.js';

export function eligibleEvents(state) {
  return EVENTS.filter((card) => {
    if (state.eventsSeen && state.eventsSeen.includes(card.id) && card.once) return false;
    if (card.requiresMap && !state.mapOpen) return false;
    if (card.minAct && state.act < card.minAct) return false;
    return true;
  });
}

export function nextEvent(state) {
  const unseen = eligibleEvents(state).filter((card) => !(state.eventsSeen || []).includes(card.id));
  const pool = unseen.length ? unseen : eligibleEvents(state);
  if (!pool.length) return null;
  const index = Math.floor(Math.random() * pool.length);
  const card = pool[index];
  return {
    id: card.id,
    title: card.title,
    body: card.body,
    speaker: card.speaker || null,
    choices: card.choices.map((choice) => ({ label: choice.label, effect: choice.effect }))
  };
}

function bumpCase(state, delta) {
  if (!state.dea) state.dea = { agent: 'Helen Ruiz', case: 0 };
  state.dea.case = Math.max(0, Math.min(100, (Number(state.dea.case) || 0) + delta));
}

function bumpHeat(state, id, delta) {
  const zone = state.zones && state.zones[id];
  const region = state.regions && state.regions[id];
  if (zone) zone.heat = Math.max(0, Math.min(100, (Number(zone.heat) || 0) + delta));
  if (region) region.heat = Math.max(0, Math.min(100, (Number(region.heat) || 0) + delta));
}

function bumpThreat(state, id, delta) {
  const row = state.rivals && state.rivals[id];
  if (!row) return;
  row.threat = Math.max(0, row.threat + delta);
}

function bumpLoyalty(state, id, delta) {
  const row = state.lieutenants && state.lieutenants[id];
  if (!row || !row.hired || row.betrayed) return;
  row.loyalty = Math.max(0, Math.min(100, row.loyalty + delta));
}

export function applyEffect(state, effect) {
  const valley = state.regions.rio_plata;
  if (effect === 'none') return { ok: true };
  if (effect === 'fiesta_pay') {
    if (state.cleanCash < 220) return { ok: false, reason: 'Need $220 Clean Cash.' };
    state.cleanCash -= 220;
    valley.loyalty = Math.min(100, valley.loyalty + 12);
    valley.heat = Math.max(0, valley.heat - 8);
    return { ok: true, text: 'The band plays. Puerto Plata stays friendly.' };
  }
  if (effect === 'fiesta_skip') {
    valley.loyalty = Math.max(0, valley.loyalty - 6);
    return { ok: true, text: 'The plaza notices the empty envelope.', kind: 'warn' };
  }
  if (effect === 'checkpoint_pay') {
    if (state.dirtyCash < 180) return { ok: false, reason: 'Need $180 Dirty Cash.' };
    state.dirtyCash -= 180;
    valley.heat = Math.max(0, valley.heat - 10);
    return { ok: true, text: 'The captain waves the next trucks through.' };
  }
  if (effect === 'checkpoint_wait') {
    valley.heat = Math.min(100, valley.heat + 8);
    return { ok: true, text: 'The line sits. Heat climbs while the tent stays up.', kind: 'warn' };
  }
  if (effect === 'surge_on') {
    state.priceMood = 1.35;
    return { ok: true, text: 'Coast buyers are paying 35% over list.' };
  }
  if (effect === 'storm_on') {
    state.weather = 'rain';
    state.weatherTimer = 20;
    return { ok: true, text: 'Crews stay on the plots through the rain.', kind: 'info' };
  }
  if (effect === 'storm_hide') {
    state.weather = 'fog';
    state.weatherTimer = 16;
    valley.heat = Math.max(0, valley.heat - 12);
    return { ok: true, text: 'Crews lay low. The valley cools under the fog.' };
  }
  if (effect === 'informant_buy') {
    if (state.cleanCash < 300) return { ok: false, reason: 'Need $300 Clean Cash.' };
    state.cleanCash -= 300;
    const cesar = state.lieutenants.cesar;
    if (cesar) cesar.loyalty = Math.max(20, cesar.loyalty - 4);
    state.informant = true;
    return { ok: true, text: 'A gate on the ridge is marked. The assault will be cheaper.' };
  }
  if (effect === 'widow_pay') {
    if (state.cleanCash < 200) return { ok: false, reason: 'Need $200 Clean Cash.' };
    state.cleanCash -= 200;
    const gas = state.lots && state.lots.lot_rp_gas;
    if (gas) {
      gas.access = 'negotiated';
      gas.priceMult = 0.7;
    }
    return { ok: true, text: 'The widow takes the envelope. The gas station is priced to move.' };
  }
  if (effect === 'widow_walk') {
    valley.loyalty = Math.max(0, valley.loyalty - 3);
    return { ok: true, text: 'You leave the pump. She will remember.', kind: 'warn' };
  }
  if (effect === 'army_pay') {
    if (state.dirtyCash < 260) return { ok: false, reason: 'Need $260 Dirty Cash.' };
    state.dirtyCash -= 260;
    valley.heat = Math.max(0, valley.heat - 14);
    if (valley.patrol) valley.patrol = null;
    state.heatHandled = (state.heatHandled || 0) + 1;
    return { ok: true, text: 'The column takes the side road.' };
  }
  if (effect === 'army_dark') {
    valley.hiddenUntil = state.elapsedSeconds + 20;
    valley.heat = Math.max(0, valley.heat - 8);
    return { ok: true, text: 'Lights off in the valley. The trucks wait.' };
  }
  if (effect === 'sol_rumor') {
    state.reputation = (state.reputation || 0) + 2;
    return { ok: true, text: 'A name in Puerto Sol gets you a nod. Reputation ticks up.' };
  }
  if (effect === 'inspection_pay') {
    if (state.cleanCash < 240) return { ok: false, reason: 'Need $240 Clean Cash.' };
    state.cleanCash -= 240;
    bumpHeat(state, 'ps_barrio', -12);
    bumpCase(state, -10);
    bumpLoyalty(state, 'nia', 2);
    return { ok: true, text: 'Ruiz pockets the inspection fee. The file gets thinner.' };
  }
  if (effect === 'inspection_refuse') {
    bumpHeat(state, 'ps_barrio', 14);
    bumpHeat(state, 'rio_plata', 6);
    bumpCase(state, 18);
    state.reputation = Math.max(0, (state.reputation || 0) - 1);
    return { ok: true, text: 'Ruiz writes the refusal into the case file. Barrio Sol gets hotter.', kind: 'warn' };
  }
  if (effect === 'turf_costa') {
    if (state.dirtyCash < 200) return { ok: false, reason: 'Need $200 Dirty Cash.' };
    state.dirtyCash -= 200;
    bumpThreat(state, 'costa', 18);
    bumpHeat(state, 'ps_beach', -6);
    bumpHeat(state, 'ps_barrio', -4);
    state.reputation = (state.reputation || 0) + 1;
    return { ok: true, text: 'Reina Solano takes the envelope. Costa Negra waits.' };
  }
  if (effect === 'turf_lobos') {
    if (state.dirtyCash < 200) return { ok: false, reason: 'Need $200 Dirty Cash.' };
    state.dirtyCash -= 200;
    bumpThreat(state, 'lobos', 18);
    bumpHeat(state, 'ps_hills', -6);
    bumpLoyalty(state, 'valeria', 2);
    return { ok: true, text: 'Don Emilio Garza takes the envelope. Los Lobos hold off.' };
  }
  if (effect === 'turf_ignore') {
    bumpThreat(state, 'costa', -12);
    bumpThreat(state, 'lobos', -12);
    bumpHeat(state, 'ps_barrio', 10);
    bumpCase(state, 5);
    return { ok: true, text: 'Both crews take the silence as a clock. They will not wait.', kind: 'warn' };
  }
  if (effect === 'witness_pay') {
    if (state.cleanCash < 280) return { ok: false, reason: 'Need $280 Clean Cash.' };
    state.cleanCash -= 280;
    bumpCase(state, -16);
    bumpLoyalty(state, 'nia', -3);
    bumpHeat(state, 'ps_downtown', -4);
    return { ok: true, text: 'Ruiz\'s witness goes quiet. Nia hates paying a fed.' };
  }
  if (effect === 'books_buy') {
    if (state.dirtyCash < 220) return { ok: false, reason: 'Need $220 Dirty Cash.' };
    state.dirtyCash -= 220;
    bumpThreat(state, 'costa', 12);
    bumpCase(state, 6);
    state.reputation = (state.reputation || 0) + 2;
    bumpLoyalty(state, 'cesar', 2);
    return { ok: true, text: 'Costa\'s books name Ruiz\'s source. She notices the books moved.', kind: 'warn' };
  }
  if (effect === 'informants_talk') {
    bumpCase(state, 14);
    bumpThreat(state, 'costa', -8);
    state.reputation = Math.max(0, (state.reputation || 0) - 2);
    bumpHeat(state, 'ps_barrio', 8);
    return { ok: true, text: 'Both informants talk. The case file and Costa Negra get louder.', kind: 'danger' };
  }
  if (effect === 'hurricane_secure') {
    if (state.dirtyCash < 300) return { ok: false, reason: 'Need $300 Dirty Cash.' };
    state.dirtyCash -= 300;
    bumpHeat(state, 'ps_docks', -10);
    bumpLoyalty(state, 'cesar', 4);
    state.reputation = (state.reputation || 0) + 1;
    for (const lot of Object.values(state.lots || {})) {
      if (lot.zoneId === 'ps_docks') lot.stormTimer = 0;
    }
    return { ok: true, text: 'The docks are boarded. César\'s crews stay dry.' };
  }
  if (effect === 'hurricane_ride') {
    bumpHeat(state, 'ps_docks', 16);
    bumpHeat(state, 'ps_beach', 8);
    bumpLoyalty(state, 'cesar', -5);
    state.reputation = Math.max(0, (state.reputation || 0) - 1);
    const loss = Math.floor((state.dirtyCash || 0) * 0.08);
    state.dirtyCash = Math.max(0, state.dirtyCash - loss);
    for (const lot of Object.values(state.lots || {})) {
      if (lot.zoneId === 'ps_docks' && lot.phase === 'operating') lot.stormTimer = 25;
    }
    return { ok: true, text: 'The hurricane takes a cut of the docks and the street cash.', kind: 'danger' };
  }
  if (effect === 'election_donate') {
    if (state.cleanCash < 350) return { ok: false, reason: 'Need $350 Clean Cash.' };
    state.cleanCash -= 350;
    bumpCase(state, -12);
    state.reputation = (state.reputation || 0) + 1;
    for (const zone of Object.values(state.zones || {})) {
      if (String(zone.id).startsWith('ps_')) zone.heat = Math.max(0, (Number(zone.heat) || 0) - 8);
    }
    return { ok: true, text: 'The mayor\'s dinner buys a quieter month. Ruiz hates the optics.' };
  }
  if (effect === 'election_dark') {
    bumpCase(state, 8);
    state.reputation = Math.max(0, (state.reputation || 0) - 4);
    bumpThreat(state, 'costa', -10);
    bumpThreat(state, 'lobos', -10);
    bumpLoyalty(state, 'valeria', -4);
    for (const zone of Object.values(state.zones || {})) {
      if (!String(zone.id).startsWith('ps_')) continue;
      zone.heat = Math.max(0, (Number(zone.heat) || 0) - 6);
      zone.hiddenUntil = (state.elapsedSeconds || 0) + 30;
    }
    return { ok: true, text: 'The city goes dark. Cooler streets, a thicker file, and both crews move up their clocks.', kind: 'warn' };
  }
  return { ok: true };
}
