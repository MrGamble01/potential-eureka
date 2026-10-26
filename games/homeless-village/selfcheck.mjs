// Node check for the camp rules. No browser, no localStorage required.
import { freshState, normalize, perform, tick, currentGoal, hudModel } from './src/sim.js';

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    process.exit(1);
  }
}

const g = freshState();
assert(currentGoal(g).id === 'survive3', 'first mission is survive 3 days');
assert(hudModel(g).hope === 54, 'hope is on the hud');

const poor = freshState();
const refused = perform(poor, 'craft:workbench');
assert(refused.ok === false, 'workbench refuses empty hands');
assert(!poor.structures.workbench, 'workbench not built');

const mid = Math.random;
const scav = perform(g, 'scavenge', () => 0.5);
assert(scav.ok !== false, 'scavenge runs');
assert(g.scraps > 0 || g.cans > 0 || scav.logs.some((l) => /empty/i.test(l)), 'scavenge changes the camp or says the bin is empty');

const builder = freshState();
builder.wood = 10;
builder.scraps = 10;
const started = perform(builder, 'craft:workbench');
assert(started.ok !== false && builder.activeCraft, 'workbench craft starts with materials');
builder.activeCraft.start = Date.now() - 60000;
const done = tick(builder, 20);
assert(builder.structures.workbench === true, 'workbench finishes');
assert(done.built, 'tick reports the build');

const night = freshState();
const warmBefore = night.warmth;
night.timeOfDay = 0.99;
const dawn = tick(night, 2000);
assert(dawn.dawn === true, 'dawn fires');
assert(night.days === 1, 'day count advances');
assert(night.warmth < warmBefore, 'dawn spends warmth');

const dog = freshState();
dog.days = 3;
dog.timeOfDay = 0.99;
tick(dog, 2000);
assert(dog.days === 4 && dog.dog === 1, 'biscuit watches from day 4');

const saved = normalize(JSON.parse(JSON.stringify(builder)));
assert(saved.structures.workbench === true, 'normalize keeps the bench');
assert(saved.hope === builder.hope, 'normalize keeps hope');

console.log('homeless village sim ok');
