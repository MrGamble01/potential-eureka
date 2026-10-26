// Campaign fail checks. They flag the run. They do not stop the clock.
// Sandbox never fails. A finished campaign is not overwritten.

import { FAIL_STATES } from '../data/missions.js';

function spec(id) {
  return FAIL_STATES.find((row) => row.id === id) || null;
}

function operationAlive(state) {
  for (const region of Object.values(state.regions || {})) {
    if (region.raidActive) return true;
  }
  for (const slot of Object.values(state.slots || {})) {
    if (slot.buildingId && !slot.rivalControlled) return true;
  }
  for (const lot of Object.values(state.lots || {})) {
    if (lot.owned && (lot.phase === 'operating' || lot.phase === 'building' || lot.phase === 'demolishing')) return true;
  }
  return false;
}

export function campaignFailure(state) {
  if (!state || state.mode === 'sandbox') return null;
  if (state.campaignStatus === 'failed' || state.campaignStatus === 'complete') return null;
  if (state.dea && state.dea.case >= 100) return spec('indictment');
  if ((state.valleySeizures || 0) >= 5) return spec('valley_seized');
  const rows = Object.values(state.lieutenants || {});
  const betrayed = rows.filter((row) => row.betrayed).length;
  const hired = rows.filter((row) => row.hired && !row.betrayed).length;
  if (betrayed > 0 && hired === 0) return spec('betrayed');
  if (state.day > 8 && state.dirtyCash < 20 && state.cleanCash < 20 && !operationAlive(state)) {
    return spec('broke');
  }
  return null;
}
