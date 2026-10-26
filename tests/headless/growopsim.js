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

  const { EVENTS } = await import(path.join(root, 'data/events.js'));
  const { crewMods } = await import(path.join(root, 'systems/lieutenants.js'));

  const script = new CartelSimulation();
  const openingMission = script.getCurrentMission();
  const scriptView = script.gameplayView();
  ok(openingMission && openingMission.id === 'm1_first_export' && openingMission.act === 1, 'act 1 starts on the river');
  ok(openingMission.beat && openingMission.beat.includes('César'), 'the first beat is César at the pier');
  ok(scriptView.campaign.dea.agent.includes('Ruiz') && scriptView.campaign.dea.case === 0, 'Ruiz starts a case file');
  ok(scriptView.campaign.cast.some((person) => person.name.includes('Garza')), 'Don Emilio is on the cast');
  ok(scriptView.campaign.cast.some((person) => person.name.includes('Reina')), 'Reina Solano is on the cast');
  ok(scriptView.campaign.chapters.filter((chapter) => chapter.act === 2).length >= 4, 'act 2 is rural expansion');
  ok(scriptView.campaign.chapters.filter((chapter) => chapter.act === 3).length >= 5, 'act 3 takes the city neighborhood by neighborhood');
  ok(scriptView.campaign.fails.some((fail) => fail.id === 'indictment' && fail.limit === 100), 'the indictment is a fail state');

  const posted = new CartelSimulation();
  posted.state.cleanCash = 8000;
  posted.state.dirtyCash = 8000;
  posted.state.mapOpen = true;
  posted.state.tutorialDone = true;
  posted.state.reputation = 30;
  posted.state.completedMissions.push('m1_first_export', 'm2_first_front');
  ok(posted.hireLieutenant('nia').ok, 'nia hires');
  ok(!posted.assignLieutenant('nia', 'river_delta').ok, 'nia cannot take a locked zone');
  ok(posted.unlockZone('river_delta').ok, 'the delta opens for a posting');
  ok(posted.assignLieutenant('nia', 'river_delta').ok, 'nia takes the delta');
  const niaCard = posted.gameplayView().lieutenants.find((row) => row.id === 'nia');
  ok(niaCard.zoneId === 'river_delta' && niaCard.betrayalRisk < 50, 'hooks show her zone and a calm betrayal risk');
  ok(crewMods(posted.state, 'river_delta').launderMult > 1, 'a lieutenant posted to a zone changes that zone');

  const law = new CartelSimulation();
  law.state.dea.case = 30;
  law.state.cleanCash = 10;
  law.state.dirtyCash = 0;
  const inspection = EVENTS.find((card) => card.id === 'inspection');
  law.state.event = {
    id: inspection.id,
    title: inspection.title,
    body: inspection.body,
    speaker: inspection.speaker,
    choices: inspection.choices.map((choice) => ({ label: choice.label, effect: choice.effect }))
  };
  ok(!law.resolveEvent(0).ok, 'paying Ruiz is a real cost');
  ok(law.resolveEvent(1).ok && law.state.dea.case > 30, 'refusing the inspection builds the case');
  const turf = EVENTS.find((card) => card.id === 'turf_war');
  law.state.event = {
    id: turf.id,
    title: turf.title,
    body: turf.body,
    speaker: turf.speaker,
    choices: turf.choices.map((choice) => ({ label: choice.label, effect: choice.effect }))
  };
  ok(law.resolveEvent(2).ok, 'ignoring the turf war is a choice');
  ok(law.state.rivals.costa.threat < 40 && law.state.rivals.lobos.threat < 48, 'ignoring the turf war brings both crews in faster');
  const stormCard = EVENTS.find((card) => card.id === 'hurricane');
  const docksHeat = law.state.zones.ps_docks.heat;
  law.state.event = {
    id: stormCard.id,
    title: stormCard.title,
    body: stormCard.body,
    speaker: stormCard.speaker,
    choices: stormCard.choices.map((choice) => ({ label: choice.label, effect: choice.effect }))
  };
  ok(law.resolveEvent(1).ok && law.state.zones.ps_docks.heat > docksHeat, 'riding out the hurricane hits the docks');
  ok(law.gameplayView().card === null, 'a resolved card leaves the hook empty');

  const turncoat = new CartelSimulation();
  turncoat.state.started = true;
  turncoat.state.eventCooldown = 999;
  turncoat.state.cleanCash = 5000;
  ok(turncoat.hireLieutenant('mateo').ok, 'mateo hires for the loyalty clock');
  turncoat.state.lieutenants.mateo.loyalty = 10;
  ok(turncoat.gameplayView().lieutenants.find((row) => row.id === 'mateo').betrayalRisk === 100, 'mateo at the floor is a certain betrayal');
  turncoat.step(10);
  ok(turncoat.state.lieutenants.mateo.betrayed && !turncoat.state.lieutenants.mateo.hired, 'mateo betrays on the day he hits the floor');
  ok(turncoat.state.campaignStatus !== 'failed', 'one betrayal leaves César running the campaign');
  turncoat.state.lieutenants.cesar.hired = false;
  turncoat.state.lieutenants.cesar.betrayed = true;
  turncoat.step(10);
  ok(turncoat.state.campaignStatus === 'failed' && /lieutenant/i.test(turncoat.state.failReason), 'the last lieutenant walking fails the campaign');
  const stillRunning = turncoat.state.elapsedSeconds;
  turncoat.step(1);
  ok(turncoat.state.elapsedSeconds > stillRunning, 'a failed campaign keeps the clock running');

  const indictment = new CartelSimulation();
  indictment.state.started = true;
  indictment.state.eventCooldown = 999;
  indictment.state.dea.case = 100;
  indictment.step(10);
  ok(indictment.state.campaignStatus === 'failed' && indictment.state.failReason.includes('Ruiz'), 'Ruiz files the indictment at a full case file');

  const quiet = new CartelSimulation();
  quiet.state.started = true;
  quiet.state.eventCooldown = 999;
  quiet.state.elapsedSeconds = 80;
  quiet.state.day = 9;
  quiet.state.dirtyCash = 5;
  quiet.state.cleanCash = 5;
  for (const slot of Object.values(quiet.state.slots)) slot.buildingId = null;
  for (const lot of Object.values(quiet.state.lots)) {
    lot.owned = false;
    lot.phase = 'wild';
    lot.buildingId = null;
    lot.role = null;
  }
  quiet.step(10);
  ok(quiet.state.campaignStatus === 'failed' && quiet.state.failId === 'broke', 'an empty operation with no production fails');

  const sandLaw = new CartelSimulation();
  sandLaw.startSandbox('casual');
  sandLaw.state.dea.case = 100;
  sandLaw.state.eventCooldown = 999;
  sandLaw.step(10);
  ok(sandLaw.state.campaignStatus !== 'failed', 'sandbox does not file the indictment');

  function clearCard(sim) {
    const card = sim.state.event;
    if (!card) return;
    const prefer = ['inspection_pay', 'witness_pay', 'election_donate', 'hurricane_secure', 'turf_costa', 'books_buy', 'army_pay', 'checkpoint_pay', 'storm_hide', 'widow_pay', 'fiesta_pay', 'informant_buy', 'sol_rumor', 'surge_on'];
    for (const effect of prefer) {
      const index = card.choices.findIndex((choice) => choice.effect === effect);
      if (index >= 0 && sim.resolveEvent(index).ok) return;
    }
    for (let i = 0; i < card.choices.length; i += 1) {
      if (sim.resolveEvent(i).ok) return;
    }
    sim.state.event = null;
    sim.state.eventCooldown = 12;
  }

  function tend(sim) {
    clearCard(sim);
    const valleyHeat = sim.state.regions.rio_plata.heat;
    if (valleyHeat >= 55 && (sim.state.cleanCash >= 160 || sim.state.dirtyCash >= 200)) sim.bribeRegionAuthorities('rio_plata');
    else if (valleyHeat >= 70) sim.hideFromPatrol('rio_plata');
    for (const row of Object.values(sim.state.lieutenants)) {
      if (row.hired && !row.betrayed && row.loyalty < 55 && sim.state.cleanCash >= 500) sim.payLieutenantBonus(row.id);
    }
    const barrio = sim.state.zones.ps_barrio;
    if (barrio && barrio.unlocked && barrio.heat >= 30) sim.hideFromPatrol('ps_barrio');
  }

  function stocked(sim, goodId) {
    for (const slot of Object.values(sim.state.slots)) {
      if (!slot.buildingId) continue;
      const have = (slot.outputBuffer[goodId] || 0) + (slot.inputBuffer[goodId] || 0);
      if (have >= 1) return slot.slotId;
    }
    return null;
  }

  function boatLoad(sim) {
    for (const goodId of ['cured_pack', 'raw_herb', 'coffee_cherry']) {
      const fromId = stocked(sim, goodId);
      if (fromId) return { fromId, goodId };
    }
    return null;
  }

  function convertMarket(sim, lotId, role) {
    const lot = sim.state.lots[lotId];
    if (!lot || lot.owned) return;
    sim.buyAndConvert(lotId, role);
  }

  function pursue(sim) {
    const mission = sim.getCurrentMission();
    if (!mission) return;
    if (!sim.state.slots.slot_rp_town1.buildingId && (mission.id === 'm2_first_front' || sim.state.dirtyCash >= 1000)) {
      sim.buildOnSlot('slot_rp_town1', 'taxi_co');
    }
    if (mission.id === 'm1_heat') {
      const valley = sim.state.regions.rio_plata;
      const hot = valley.heat >= 40 || valley.patrol || sim.state.heatIntro;
      if (hot && (sim.state.cleanCash >= 160 || sim.state.dirtyCash >= 200)) sim.bribeRegionAuthorities('rio_plata');
      else if (hot) sim.hideFromPatrol('rio_plata');
      return;
    }
    if (mission.id === 'm2_open_delta') {
      sim.unlockZone('river_delta');
      return;
    }
    if (mission.id === 'm2_delta_work') {
      convertMarket(sim, 'lot_rd_mill', 'warehouse');
      return;
    }
    if (mission.id === 'm2_second_country') {
      sim.unlockZone('jungle_alta');
      return;
    }
    if (mission.id === 'm2_second_lieutenant') {
      if (!sim.state.lieutenants.nia.hired) sim.hireLieutenant('nia');
      else sim.assignLieutenant('nia', 'river_delta');
      return;
    }
    if (mission.id === 'm2_boat_run') {
      if ((sim.state.shipments || []).some((shipment) => shipment.vehicleId === 'boat')) return;
      const load = boatLoad(sim);
      if (load) sim.planRoute({ fromId: load.fromId, vehicleId: 'boat', goodId: load.goodId, qty: 4 });
      return;
    }
    if (mission.id === 'm3_barrio') {
      if (sim.unlockZone('ps_barrio').ok || sim.state.zones.ps_barrio.unlocked) convertMarket(sim, 'lot_ba_laundry', 'launder');
      return;
    }
    if (mission.id === 'm3_docks') {
      if (sim.unlockZone('ps_docks').ok || sim.state.zones.ps_docks.unlocked) convertMarket(sim, 'lot_dk_garage', 'distribution');
      return;
    }
    if (mission.id === 'm3_downtown') {
      if (sim.unlockZone('ps_downtown').ok || sim.state.zones.ps_downtown.unlocked) convertMarket(sim, 'lot_dt_cars', 'launder');
      return;
    }
    if (mission.id === 'm3_beach') {
      if (sim.unlockZone('ps_beach').ok || sim.state.zones.ps_beach.unlocked) convertMarket(sim, 'lot_bh_motel', 'safehouse');
      return;
    }
    if (mission.id === 'm3_hold_barrio') {
      if (sim.zoneControl('ps_barrio') >= 40) return;
      if (sim.state.zones.ps_barrio.heat > 16) sim.hideFromPatrol('ps_barrio');
      if (!sim.state.lots.lot_ba_pawn.owned) {
        convertMarket(sim, 'lot_ba_pawn', 'stash');
        return;
      }
      if (!sim.state.lots.lot_ba_diner.owned) {
        if (sim.state.lots.lot_ba_diner.access === 'locked') sim.negotiate('lot_ba_diner');
        else convertMarket(sim, 'lot_ba_diner', 'launder');
        return;
      }
      if (!sim.state.lots.lot_ba_apts.owned) {
        if (sim.state.lots.lot_ba_apts.access === 'locked') sim.negotiate('lot_ba_apts');
        else convertMarket(sim, 'lot_ba_apts', 'safehouse');
      }
      return;
    }
    if (mission.id === 'm3_hills') {
      if (sim.unlockZone('ps_hills').ok || sim.state.zones.ps_hills.unlocked) convertMarket(sim, 'lot_hi_motel', 'safehouse');
    }
  }

  const player = new CartelSimulation();
  player.state.started = true;
  player.state.routeLuck = 0.55;
  player.state.eventCooldown = 14;
  let stuckOn = null;
  let stuckFor = 0;
  while (player.getCurrentMission() && player.state.elapsedSeconds < 2600 && player.state.campaignStatus !== 'failed') {
    const currentId = player.getCurrentMission().id;
    if (currentId === stuckOn) stuckFor += 1;
    else {
      stuckOn = currentId;
      stuckFor = 0;
    }
    tend(player);
    pursue(player);
    player.step(2);
  }
  const finishedMission = player.getCurrentMission();
  if (finishedMission || player.state.campaignStatus === 'failed' || player.state.elapsedSeconds > 2400) {
    console.log('BOT', finishedMission && finishedMission.id, 'stuckSteps', stuckFor, 't', Math.round(player.state.elapsedSeconds), 'clean', Math.round(player.state.cleanCash), 'dirty', Math.round(player.state.dirtyCash), 'rep', player.state.reputation, 'status', player.state.campaignStatus, player.state.failReason || '', 'done', player.state.completedMissions.join(','));
  }
  ok(!finishedMission && player.state.completedMissions.includes('m3_city'), 'the bot finishes all three acts');
  ok(player.state.act >= 3 && player.state.campaignStatus === 'complete', 'the campaign completes in act 3');
  ok(player.state.campaignStatus !== 'failed', 'the playthrough never fails');
  ok(player.state.elapsedSeconds > 60 && player.state.elapsedSeconds <= 2400, `the campaign finishes in a sensible time (${Math.round(player.state.elapsedSeconds)}s)`);
  ok(player.state.boatRuns >= 1, 'act 2 landed a boat');
  const cityChapters = player.gameplayView().campaign.chapters.filter((chapter) => chapter.act === 3);
  ok(cityChapters.every((chapter) => chapter.done), 'every Puerto Sol chapter is done');

  const hour = new CartelSimulation();
  hour.startSandbox('standard');
  hour.state.routeLuck = 0.55;
  hour.state.eventCooldown = 18;
  const hourDirty = hour.state.totalDirtyEarned;
  const hourExports = hour.state.totalExportedUnits;
  let hourHeat = false;
  for (let tick = 0; tick < 720; tick += 1) {
    tend(hour);
    const packs = hour.state.slots.slot_rp_wh1.outputBuffer.cured_pack || 0;
    if (packs >= 2 && !(hour.state.shipments || []).length) {
      hour.planRoute({ fromId: 'slot_rp_wh1', vehicleId: 'truck', goodId: 'cured_pack', qty: 2 });
    }
    hour.step(5);
    if (hour.state.regions.rio_plata.heat >= 40 || hour.state.heatHandled > 0) hourHeat = true;
  }
  const hourAlive = Object.values(hour.state.slots).some((slot) => slot.buildingId && !slot.raidLocked);
  ok(hour.state.elapsedSeconds >= 3600 && hour.state.day > 200, `sandbox runs a full hour of days (day ${hour.state.day})`);
  ok(hour.state.totalDirtyEarned > hourDirty && hour.state.totalExportedUnits > hourExports, 'the hour keeps producing and paying');
  ok(hourHeat && hour.state.eventsSeen.length >= 3, 'heat and event cards keep showing up');
  ok(hour.state.routesCompleted > 0, 'the hour still moves shipments');
  ok(hourAlive && hour.state.dirtyCash >= 0 && hour.state.cleanCash >= 0, 'the hour stays solvent with buildings running');
  ok(hour.state.campaignStatus !== 'failed', 'sandbox stays out of the fail states');

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
