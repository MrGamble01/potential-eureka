/* Living world — day, night, and weather rules.
 *
 * The clock is pure: no page, no save, no audio context.
 * A clear morning leaves every modifier at 1, which is
 * what keeps an existing war and an existing corner on
 * the numbers they already had. Rain, fog, storm, snow,
 * and night move those numbers on purpose.
 */
const fs = require('fs');
const path = require('path');
const World = require('../../js/living-world.js');
const AI = require('../../js/ai/arcade-ai.js');

let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };

const root = path.join(__dirname, '..', '..');
const src = fs.readFileSync(path.join(root, 'js/living-world.js'), 'utf8');

ok(!/localStorage/.test(src), 'the sky is not written into a save');
ok(src.indexOf('particleBudget') >= 0 && src.indexOf('reduced') >= 0, 'reduced motion is part of the painter');

ok(World.PROFILES.ageofwar.holdClear >= 90, 'a war stays a clear morning long enough for a short visit');
ok(World.PROFILES.growop.holdClear >= 90, 'the corner stays a clear morning long enough for a short visit');
ok(World.PROFILES.tycoon && World.PROFILES.tycoon.holdClear >= 90, 'the office stays a clear morning long enough for a short visit');
ok(Array.isArray(World.PROFILES.tycoon.show) && World.PROFILES.tycoon.show.length === 0, 'the office sky lists no deal effects');
ok(World.WEATHER.rain.growth === 1.45, 'rain feeds crops');
ok(World.PHASE.night.foe === 1.24, 'night makes foes hit harder');
ok(World.WEATHER.storm.move === 0.72, 'a storm slows the march');
ok(World.WEATHER.storm.heavy === 1.25, 'a storm favors heavies');
ok(World.WEATHER.fog.vision === 0.52, 'fog cuts sight');
ok(World.WEATHER.snow.growth === 0.58, 'snow stalls crops');
ok(World.PHASE.night.price === 1.18, 'the street pays more after dark');

function morning() {
  return World.create({ profile: 'ageofwar', seed: 4, query: '' });
}

function steps(w, seconds) {
  for (let i = 0; i < seconds; i++) w.tick(1);
}

{
  const w = morning();
  const s = w.snapshot();
  ok(s.phase === 'day' && s.weather === 'clear', `a new sky is a clear day (${s.key})`);
  ok(s.mods.move === 1 && s.mods.foe === 1 && s.mods.vision === 1 && s.mods.heavy === 1 && s.mods.growth === 1 && s.mods.price === 1,
    'clear daylight changes nothing');
  ok(s.mood === 'calm', 'clear daylight is the calm bed');
  ok(w.unitDamage(20, { side: 'enemy', line: 'melee', range: 26 }) === 20, 'enemy damage is untouched at noon');
  ok(w.moveStep(50) === 50, 'march speed is untouched at noon');
  ok(w.unitSees(400, 26) === true, 'a clear field still sees the far line');
  ok(w.limitRange(200) === 200, 'turret range is untouched at noon');
  ok(w.growSeconds(18) === 18, 'a crop timer is untouched at noon');
  ok(w.saleValue(25) === 25, 'a sale is untouched at noon');
  ok(w.heatGain(6) === 6, 'heat gain is untouched at noon');
  steps(w, 30);
  const later = w.snapshot();
  ok(later.phase === 'day' && later.weather === 'clear', 'thirty seconds in, the morning is still clear');
}

{
  const a = World.create({ profile: 'ageofwar', seed: 9, holdClear: 10, dayLength: 1000 });
  const b = World.create({ profile: 'ageofwar', seed: 9, holdClear: 10, dayLength: 1000 });
  steps(a, 9);
  ok(a.snapshot().weather === 'clear', 'the hold keeps the first roll clear');
  a.tick(1);
  steps(b, 10);
  ok(a.snapshot().weather === b.snapshot().weather, `the same seed rolls the same sky (${a.snapshot().weather})`);
  let wild = false;
  for (let i = 0; i < 8; i++) {
    a.tick(1);
    if (a.snapshot().weather !== 'clear') wild = true;
  }
  ok(wild, 'weather does leave clear once the hold ends');
}

{
  const w = World.create({ profile: 'ageofwar', seed: 1, query: '?world=night-storm' });
  const s = w.snapshot();
  ok(s.phase === 'night' && s.weather === 'storm', `a pinned query sticks (${s.key})`);
  ok(s.mods.foe > 1.2 && s.mods.move < 0.8 && s.mods.heavy === 1.25, `night storm is meaner and slower (${s.mods.foe}, ${s.mods.move})`);
  ok(s.mood === 'tense', 'a storm takes the tense bed');
  const foe = w.unitDamage(20, { side: 'enemy', line: 'melee', range: 26 });
  const heavy = w.unitDamage(20, { side: 'player', line: 'heavy', range: 30 });
  const bow = w.unitDamage(21, { side: 'player', line: 'ranged', range: 150 });
  ok(foe > 20, `enemy blows land harder at night (${foe})`);
  ok(heavy > 20, `heavies hit harder in the storm (${heavy})`);
  ok(bow < 21, `ranged fire is worse in the wet (${bow})`);
  ok(w.unitSees(200, 150) === false, 'fog-or-storm sight drops a far target');
  ok(w.limitRange(200) < 200, 'a turret cannot see as far');
  w.tick(80);
  ok(w.snapshot().key === 'night|storm', 'a pin does not wander off');
  ok(/foes/.test(s.label) && /heavies/.test(s.label), `the field label names the rule (${s.label})`);
}

{
  const w = World.create({ profile: 'growop', seed: 3, query: '?world=day-rain' });
  const s = w.snapshot();
  ok(s.mods.growth === 1.45, 'rain shortens a grow');
  ok(Math.abs(w.growSeconds(18) - 18 / 1.45) < 1e-6, 'grow seconds follow the rain');
  ok(s.mods.heatDrain === 1.45, 'rain cools the block');
  ok(s.mods.move === 0.9, 'rain slows a walk');
  ok(/crops/.test(s.label), `the corner label names the crop (${s.label})`);
  w.force({ phase: 'day', weather: 'snow' });
  const snow = w.snapshot();
  ok(snow.mods.growth === 0.58 && w.growSeconds(18) > 18, 'snow stretches a grow');
  w.force({ phase: 'night', weather: 'clear' });
  const night = w.snapshot();
  ok(night.mods.price === 1.18 && w.saleValue(100) === 118, 'night marks the street price up');
  ok(night.mods.heatGain === 1.28, 'night makes heat climb');
  ok(night.mods.buyers < 1, 'buyers come sooner after dark');
  ok(night.mood === 'tense', 'night is tense on the score');
}

{
  const w = World.create({ profile: 'tycoon', seed: 2, query: '?world=night-storm' });
  const s = w.snapshot();
  ok(s.phase === 'night' && s.weather === 'storm', `the office can pin a night storm (${s.key})`);
  ok(s.effect === 'open sky', `a night storm over the office is still an open sky (${s.effect})`);
  ok(s.mods.price > 1 && s.mods.foe > 1, 'the clock still knows the night storm');
  ok(!/foes|street|heat|crops|buyers|heavies/.test(s.label), `the office label stays off the deal sheet (${s.label})`);
}

{
  const w = World.create({ profile: 'growop', seed: 1, query: '?world=tour', tourEvery: 5 });
  const first = w.snapshot().key;
  ok(first === 'day|clear', `a tour opens on a clear day (${first})`);
  steps(w, 5);
  const next = w.snapshot().key;
  ok(next === 'day|rain', `the tour steps into rain (${next})`);
  steps(w, 5);
  ok(w.snapshot().key === 'dusk|fog', 'the tour steps into fog');
  steps(w, 5);
  ok(w.snapshot().key === 'night|clear', 'the tour steps into night');
  steps(w, 5);
  ok(w.snapshot().key === 'night|storm', 'the tour steps into a storm');
}

ok(World.paintCap('storm', true, 1280) === 0, 'reduced motion paints no storm drops');
ok(World.paintCap('rain', false, 1280) === 40, 'rain stays on a phone-sized budget');
ok(World.paintCap('storm', false, 390) <= 22, 'a narrow screen paints fewer drops');
ok(World.paintCap('clear', false, 1280) === 0, 'clear sky paints nothing');
ok(World.moodFor({ phase: 'day', weather: 'rain' }) === 'busy', 'rain is the busy bed');
ok(World.moodFor({ phase: 'day', weather: 'clear' }) === 'calm', 'clear day is calm');

{
  const pages = {
    'ageofwar/index.html': ['/js/living-world.js', 'id="aow-sky"'],
    'drug-lab.html': ['/js/living-world.js', 'id="lab-sky"'],
    'tycoon/play.html': ['/js/living-world.js', 'id="tyc-sky"', "profile: 'tycoon'"],
  };
  Object.keys(pages).forEach((file) => {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    pages[file].forEach((needle) => {
      ok(text.indexOf(needle) >= 0, file + ' includes ' + needle);
    });
  });
  const war = fs.readFileSync(path.join(root, 'ageofwar/ageofwar.js'), 'utf8');
  ok(war.indexOf('aowWorld.unitDamage') >= 0, 'Age of War damage goes through the sky');
  ok(war.indexOf('aowWorld.moveStep') >= 0, 'Age of War march speed goes through the sky');
  ok(war.indexOf('aowWorld.unitSees') >= 0, 'Age of War sight goes through the sky');
  ok(war.indexOf('aowWorld.spawnGap') >= 0, 'Age of War waves go through the sky');
  const lab = fs.readFileSync(path.join(root, 'drug-lab.html'), 'utf8');
  ok(lab.indexOf('labWorld.growSeconds') >= 0, 'Grow Op crops go through the sky');
  ok(lab.indexOf('labWorld.saleValue') >= 0, 'Grow Op prices go through the sky');
  ok(lab.indexOf('labWorld.heatGain') >= 0, 'Grow Op heat goes through the sky');
  const office = fs.readFileSync(path.join(root, 'tycoon/play.html'), 'utf8');
  ok(office.indexOf('officeWorld.saleValue') < 0, 'the office does not price deals from the sky');
  ok(office.indexOf('officeWorld.heatGain') < 0, 'the office does not take heat from the sky');
  ok(office.indexOf('officeWorld.growSeconds') < 0, 'the office does not time crops from the sky');
  ok(office.indexOf('officeWorld.unitDamage') < 0, 'the office does not scale hits from the sky');
  ok(office.indexOf('paintOfficeSky') >= 0, 'the office paints the shared sky');
  const boot = fs.readFileSync(path.join(root, 'js/ai/boot.js'), 'utf8');
  ok(boot.indexOf("#aow-sky") >= 0 && boot.indexOf("#lab-sky") >= 0, 'the announcer watches both skies');
}

(async () => {
  const stub = AI.createStubProvider();
  const war = await stub.announce({ game: 'ageofwar', event: { type: 'weather', detail: 'Night storm — march 68%' } });
  const room = await stub.announce({ game: 'growop', event: { type: 'weather', detail: 'Day rain — crops 145%' } });
  ok(/Sky over the field/.test(war.line) && /Night storm/.test(war.line), `the field announcer calls the sky (${war.line})`);
  ok(/Sky over the block/.test(room.line) && /Day rain/.test(room.line), `dispatch calls the sky (${room.line})`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(1); });
