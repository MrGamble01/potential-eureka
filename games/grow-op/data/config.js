// One switch for the supply-chain game. Heat, raids, events, crew,
// and street deals stay in the code. CORE_MODE true leaves them idle.
// Set CORE_MODE false and the full campaign comes back, with Act I
// still protected until a warning has been on screen.

export const SIM_CONFIG = {
  CORE_MODE: true
};

export function coreMode() {
  return SIM_CONFIG.CORE_MODE !== false;
}

// Act I of the full campaign does not punish the player.
export function tutorialGrace(state) {
  if (coreMode() || !state || state.mode === 'sandbox') return false;
  return (state.act || 1) <= 1;
}

// Raids, catches, and rival hits wait until the tutorial is over
// and the warning has been on screen. riskReadyAt 0 means live now
// (sandbox and tests). noSeizure stays the peace switch.
export function riskLive(state) {
  if (coreMode() || !state) return false;
  if (state.riskReadyAt === 0) return true;
  if (state.noSeizure) return false;
  if (tutorialGrace(state)) return false;
  if (state.riskReadyAt == null) return false;
  return state.elapsedSeconds >= state.riskReadyAt;
}
