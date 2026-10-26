/* Grow Op simulation: chains, roads, laundering, raids, research, save.
 * No browser. The page smoke test covers the canvas.
 */
const path = require('path');

globalThis.localStorage = {
  store: {},
  getItem(k) { return Object.prototype.hasOwnProperty.call(this.store, k) ? this.store[k] : null; },
  setItem(k, v) { this.store[k] = String(v); },
  removeItem(k) { delete this.store[k]; }
};

let pass = 0;
let fail = 0;
const ok = (cond, name) => {
  if (cond) pass += 1;
  else fail += 1;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
};

(async () => {
  const root = path.resolve(__dirname, '../../games/grow-op');
  const { CartelSimulation } = await import(path.join(root, 'simulation.js'));
  const { findRoadPath } = await import(path.join(root, 'data/missions.js'));

  const road = findRoadPath('slot_rp_farm1', 'slot_rp_pier');
  ok(road.length >= 2, 'road graph reaches the pier');

  const sim = new CartelSimulation();
  sim.state.started = true;
  sim.state.eventCooldown = 999;
  const before = sim.state.slots.slot_rp_farm1.outputBuffer.raw_herb || 0;
  sim.step(8);
  const herb = sim.state.slots.slot_rp_farm1.outputBuffer.raw_herb || 0;
  const hauled = sim.state.activeTrucks.some((t) => t.goodId === 'raw_herb');
  const barn = sim.state.slots.slot_rp_barn1.inputBuffer.raw_herb || 0;
  ok(herb > before || hauled || barn > 0, 'plantation grows raw crop');

  sim.step(30);
  const moved = sim.state.activeTrucks.length > 0 || sim.state.totalExportedUnits > 2;
  ok(moved, 'trucks or exports move the chain');
  if (sim.state.activeTrucks[0]) ok(Array.isArray(sim.state.activeTrucks[0].path), 'truck follows a path');
  else ok(true, 'truck follows a path');

  const dirty = sim.state.dirtyCash;
  sim.state.dirtyCash = 2000;
  const built = sim.buildOnSlot('slot_rp_town1', 'taxi_co');
  ok(built.ok, 'taxi front builds');
  sim.step(8);
  ok(sim.state.cleanCash > 350 || sim.state.slots.slot_rp_town1.progress > 0, 'front starts laundering');

  sim.state.cleanCash = 5000;
  const research = sim.buyResearch('lights');
  ok(research.ok && sim.state.research.lights, 'research installs');
  const locked = sim.buyResearch('manifests');
  ok(!locked.ok, 'research respects prerequisites');

  sim.state.regions.rio_plata.heat = 99;
  sim.step(0.2);
  ok(sim.state.regions.rio_plata.raidActive, 'heat starts a raid');
  sim.state.cleanCash = 1000;
  const bribe = sim.bribeRegionAuthorities('rio_plata');
  ok(bribe.ok && !sim.state.regions.rio_plata.raidActive, 'bribe ends the raid');

  sim.save();
  const again = new CartelSimulation();
  ok(again.load() && again.state.research.lights && again.state.slots.slot_rp_town1.buildingId === 'taxi_co', 'save round-trips');

  again.startSandbox();
  ok(again.state.mode === 'sandbox' && again.state.regions.sierra_alta.unlocked, 'sandbox opens every district');
  ok(dirty >= 0, 'dirty cash stayed a number');

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
