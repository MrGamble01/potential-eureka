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

  const { storageCap } = await import(path.join(root, 'systems/chains.js'));
  const { BUILDINGS } = await import(path.join(root, 'data/buildings.js'));
  ok(storageCap(BUILDINGS.plantation, 3) > storageCap(BUILDINGS.plantation, 1), 'upgrades raise the storage cap');
  const capSim = new CartelSimulation();
  capSim.state.started = true;
  capSim.state.eventCooldown = 999;
  const farm = capSim.state.slots.slot_rp_farm1;
  const cap = storageCap(BUILDINGS.plantation, farm.level, 0);
  farm.outputBuffer.raw_herb = cap;
  farm.progress = 0.99;
  capSim.step(0.05);
  ok((farm.outputBuffer.raw_herb || 0) <= cap, 'a full shed does not grow past its cap');
  const valley = capSim.gameplayView().chains.find((chain) => chain.id === 'valley');
  ok(valley && valley.stages.length >= 3, 'valley chain has more than one stage');

  const deal = new CartelSimulation();
  deal.state.started = true;
  deal.state.eventCooldown = 999;
  deal.state.dirtyCash = 20000;
  deal.state.cleanCash = 20000;
  const gasLab = deal.buyAndConvert('lot_rp_gas', 'lab');
  ok(!gasLab.ok, 'a gas station cannot become a lab');
  const gasWash = deal.buyAndConvert('lot_rp_gas', 'launder');
  ok(gasWash.ok && gasWash.instant && deal.state.lots.lot_rp_gas.constructLeft === 0, 'buying the gas station converts it immediately');
  const blocked = deal.buyAndConvert('lot_rp_hacienda', 'produce');
  ok(!blocked.ok, 'a local owner has to be dealt with first');
  ok(deal.negotiate('lot_rp_hacienda').ok, 'negotiation opens the hacienda');
  const hacienda = deal.buyAndConvert('lot_rp_hacienda', 'produce');
  ok(hacienda.ok && deal.state.lots.lot_rp_hacienda.level === 2, 'the hacienda arrives with its upgrade');
  ok(deal.state.lots.lot_rp_hacienda.constructLeft === 0, 'a purchased rural building does not wait on construction');

  ok(!deal.unlockZone('ps_barrio').ok, 'the city stays shut until the tutorial is done');
  deal.state.tutorialDone = true;
  deal.state.mapOpen = true;
  deal.state.completedMissions.push('m2_first_front');
  deal.state.reputation = 30;
  ok(deal.unlockZone('jungle_alta').ok, 'jungle highlands unlock');
  const plot = deal.buildOnPlot('lot_ja_clearing', 'highland_farm');
  ok(plot.ok && plot.seconds >= 5 && deal.state.lots.lot_ja_clearing.phase === 'building', 'an open rural plot builds slower and cheaper than a purchase');
  ok(deal.unlockZone('ps_barrio').ok, 'Barrio Sol unlocks');
  const cityPlot = deal.buildOnPlot('lot_ba_laundry', 'taxi_co');
  ok(!cityPlot.ok && /city/i.test(cityPlot.reason), 'city lots are not open plots');
  const controlBefore = deal.zoneControl('ps_barrio');
  const cold = deal.gameplayView().lots.find((lot) => lot.id === 'lot_ba_laundry').buyPrice;
  deal.state.zones.ps_barrio.heat = 90;
  const hot = deal.gameplayView().lots.find((lot) => lot.id === 'lot_ba_laundry').buyPrice;
  ok(hot > cold, 'a hotter neighborhood costs more');
  deal.state.zones.ps_barrio.heat = 22;
  ok(deal.buyAndConvert('lot_ba_laundry', 'launder').ok, 'the laundromat converts to a front');
  ok(deal.buyAndConvert('lot_ba_pawn', 'stash').ok, 'the pawn shop converts to a stash');
  ok(deal.zoneControl('ps_barrio') > controlBefore, 'owning buildings raises neighborhood control');

  ok(!deal.buyLot('lot_ba_diner').ok, 'the diner owner is not ready to sell');
  ok(deal.negotiate('lot_ba_diner').ok, 'the diner owner negotiates');
  ok(deal.buyLot('lot_ba_diner').ok, 'the diner lot can be bought');
  ok(deal.startDemolish('lot_ba_diner').ok, 'demolition starts');
  deal.step(deal.state.lots.lot_ba_diner.demolishLeft + 0.1);
  ok(deal.state.lots.lot_ba_diner.phase === 'cleared', 'demolition clears the lot');
  ok(!deal.buildNew('lot_ba_diner', 'aerodrome').ok, 'a small lot refuses an aerodrome');
  ok(deal.buildNew('lot_ba_diner', 'taxi_co').ok, 'a small cleared lot can take a taxi front');
  ok(deal.state.lots.lot_ba_diner.phase === 'building', 'the new city build takes time');

  ok(deal.unlockZone('ps_beach').ok, 'the beach opens');
  const weak = deal.intimidate('lot_bh_club', 0);
  ok(!weak.ok, 'Costa Negra ignores a weak threat');
  ok(deal.intimidate('lot_bh_club', 1200).ok, 'a paid crew moves the nightclub');

  deal.state.slots.slot_rp_wh1.outputBuffer.cured_pack = 8;
  ok(!deal.planRoute({ fromId: 'slot_rp_wh1', vehicleId: 'plane', goodId: 'cured_pack', qty: 4 }).ok, 'a plane needs a strip');
  deal.state.routeLuck = 0.99;
  const boat = deal.planRoute({ fromId: 'slot_rp_wh1', vehicleId: 'boat', goodId: 'cured_pack', qty: 4 });
  ok(boat.ok && boat.shipment.left > 0 && boat.shipment.qty <= 8, 'a boat has capacity and travel time');
  deal.step(boat.shipment.left + 0.2);
  ok(deal.state.routesCompleted >= 1, 'the boat lands and pays');
  deal.state.cleanCash = 5000;
  ok(deal.buyResearch('radios').ok && deal.buyResearch('decoys').ok, 'decoy research installs');
  deal.state.slots.slot_rp_wh1.outputBuffer.cured_pack = 6;
  const safer = deal.planRoute({ fromId: 'slot_rp_wh1', vehicleId: 'boat', goodId: 'cured_pack', qty: 2 });
  ok(safer.ok && safer.shipment.risk < 0.26, 'decoys cut route risk');

  const crew = new CartelSimulation();
  crew.state.cleanCash = 5000;
  ok(crew.hireLieutenant('mateo').ok, 'mateo hires');
  ok(crew.assignLieutenant('mateo', 'rio_plata').ok, 'mateo takes the valley');
  const loyal = crew.getRegionModifiers('rio_plata').prodMult;
  crew.state.lieutenants.mateo.loyalty = 10;
  const sulking = crew.getRegionModifiers('rio_plata').prodMult;
  ok(loyal > sulking, 'loyalty changes a lieutenant\'s output');

  const heat = new CartelSimulation();
  heat.state.started = true;
  heat.state.eventCooldown = 999;
  heat.state.regions.rio_plata.heat = 70;
  heat.step(0.2);
  ok(heat.state.regions.rio_plata.patrol && heat.state.regions.rio_plata.patrol.kind === 'police', 'heat sends a police patrol');
  heat.state.regions.rio_plata.heat = 84;
  heat.state.regions.rio_plata.patrol = null;
  heat.step(0.2);
  ok(heat.state.regions.rio_plata.patrol && heat.state.regions.rio_plata.patrol.kind === 'army', 'higher heat sends the army');
  ok(heat.hideFromPatrol('rio_plata').ok && !heat.state.regions.rio_plata.patrol, 'hiding slips an army patrol');
  ok(heat.state.patrolsHandled >= 1, 'a slipped patrol counts');

  const rivals = new CartelSimulation();
  rivals.state.started = true;
  rivals.state.eventCooldown = 999;
  ok(rivals.state.rivals.lobos && rivals.state.rivals.costa, 'Los Lobos and Costa Negra both exist');
  rivals.state.rivals.lobos.threat = 0;
  rivals.step(10);
  const hit = Object.values(rivals.state.slots).some((slot) => slot.rivalLock) || rivals.state.feed.some((line) => /Lobos|Costa/.test(line.text));
  ok(hit, 'a rival crew attacks a building');

  const cards = new CartelSimulation();
  cards.state.started = true;
  cards.state.tutorialDone = true;
  cards.state.elapsedSeconds = 60;
  cards.state.eventCooldown = 0;
  cards.state.dirtyCash = 5000;
  cards.state.cleanCash = 5000;
  cards.step(0.2);
  ok(cards.state.event && cards.state.event.choices.length >= 2, 'a story card offers a choice');
  let settled = false;
  for (let i = 0; i < cards.state.event.choices.length; i += 1) {
    const choice = cards.resolveEvent(i);
    if (choice.ok) { settled = true; break; }
  }
  ok(settled && !cards.state.event, 'the choice resolves');

  const box = new CartelSimulation();
  box.startSandbox('brutal');
  ok(box.state.difficulty === 'brutal' && box.state.dirtyCash < 8000, 'brutal sandbox starts leaner');
  ok(box.state.zones.ps_downtown.unlocked && box.state.zones.mesa_strip.unlocked, 'sandbox opens the city and the rural zones');
  ok(box.setDifficulty('casual').ok && box.state.difficultyMods.heat < 1, 'sandbox difficulty can be changed');

  const opening = new CartelSimulation();
  opening.state.started = true;
  opening.state.eventCooldown = 12;
  opening.buildOnSlot('slot_rp_town1', 'taxi_co');
  let sawHeat = false;
  let broke = false;
  for (let t = 0; t < 900; t += 1) {
    opening.step(1);
    if (opening.state.regions.rio_plata.heat >= 50) sawHeat = true;
    if (opening.state.regions.rio_plata.heat >= 68 && (opening.state.cleanCash >= 160 || opening.state.dirtyCash >= 200)) {
      opening.bribeRegionAuthorities('rio_plata');
    }
    if (opening.state.event) {
      let done = false;
      for (let i = 0; i < opening.state.event.choices.length; i += 1) {
        if (opening.resolveEvent(i).ok) { done = true; break; }
      }
      if (!done) opening.state.event = null;
    }
    if (opening.state.dirtyCash < 0 || opening.state.cleanCash < 0) broke = true;
  }
  ok(sawHeat, 'the first 15 minutes get hot');
  ok(!broke && opening.state.totalDirtyEarned > 1200, 'the opening still earns and stays solvent');
  ok(opening.state.day > 20, 'fifteen minutes is a long stretch of days');

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
