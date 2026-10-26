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
    choices: card.choices.map((choice) => ({ label: choice.label, effect: choice.effect }))
  };
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
  return { ok: true };
}
