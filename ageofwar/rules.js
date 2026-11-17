/* Age of War combat rules.
   The battle loop in ageofwar.js closes over the live war.
   These functions take that state as arguments so the numbers
   can be read on their own. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AowRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // Skirmish and shield are the lines that break the old melee/ranged/heavy
  // triangle. Every pair that is not listed still deals full damage.
  const COUNTER = {
    'skirmish>shield': 1.5,
    'skirmish>heavy': 1.35,
    'ranged>shield': 0.6,
    'ranged>skirmish': 1.4,
    'heavy>shield': 1.2,
    'shield>skirmish': 0.75,
    'shield>ranged': 1.25,
  };

  function counterFactor(atkLine, defLine) {
    const factor = COUNTER[atkLine + '>' + defLine];
    return factor === undefined ? 1 : factor;
  }

  function unitsForEra(units, era) {
    return Object.entries(units)
      .filter(([key, unit]) => unit.era === era && !key.startsWith('boss_') && unit.role !== 'companion')
      .map(([key]) => key);
  }

  function heavyKey(units, choices) {
    if (!choices || !choices.length) return null;
    for (let i = choices.length - 1; i >= 0; i--) {
      const unit = units[choices[i]];
      if (unit && unit.anchor) return choices[i];
    }
    return choices[choices.length - 1];
  }

  function trainingSeconds(cost, drums) {
    const t = Math.max(0.6, Math.min(7, cost / 500));
    return drums ? t * 0.85 : t;
  }

  function recruitCost(def, order) {
    if (!def) return 0;
    return order === 'levy' ? Math.round(def.cost * 1.1) : def.cost;
  }

  function orderGoldMult(order) {
    return order === 'levy' ? 1.18 : order === 'shield' ? 0.92 : 1;
  }

  function orderMitigate(order, unit, dmg) {
    if (order !== 'shield' || !unit || unit.side !== 'player' || unit.role) return dmg;
    return Math.max(1, Math.round(dmg * 0.88));
  }

  function nextAgeXp(upXP, order, era) {
    if (order === 'sapper' && era === 1) return Math.round(upXP * 1.15);
    return upXP;
  }

  function armorMult(tier) {
    return 1 - 0.1 * tier;
  }

  return {
    counterFactor: counterFactor,
    unitsForEra: unitsForEra,
    heavyKey: heavyKey,
    trainingSeconds: trainingSeconds,
    recruitCost: recruitCost,
    orderGoldMult: orderGoldMult,
    orderMitigate: orderMitigate,
    nextAgeXp: nextAgeXp,
    armorMult: armorMult,
  };
});
